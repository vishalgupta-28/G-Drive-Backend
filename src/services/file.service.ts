import { GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomBytes } from 'crypto';
import { FileRepository } from '../repositories/file.repository.js';
import { BlobRepository } from '../repositories/blob.repository.js';
import { FileShareRepository } from '../repositories/file_share.repository.js';
import { s3Client } from '../config/aws.js';
import { Config } from '../config/config.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

export class FileService {
    constructor(
        private readonly fileRepository: FileRepository,
        private readonly blobRepository: BlobRepository,
        private readonly fileShareRepository: FileShareRepository
    ) { }

    async shareFile(userId: string, fileId: string, expiresInDays: number = 30) {
        try {
            const file = await this.fileRepository.findByIdAndUser(fileId, userId);
            if (!file) throw new AppError('File not found', 404);

            // Check if an active token already exists, to avoid DB clutter
            const db = this.fileRepository['db'];
            const schema = await import('../db/schema/schema.js');
            const { eq, and, gt } = await import('drizzle-orm');

            const existingShares = await db.select().from(schema.fileShareTable).where(
                and(
                    eq(schema.fileShareTable.file_id, fileId),
                    gt(schema.fileShareTable.expiry, Date.now())
                )
            );
            if (existingShares.length > 0) {
                return { shareUrl: `${Config.apiUrl}/api/files/shared/${existingShares[0].token}`, token: existingShares[0].token };
            }

            const token = randomBytes(32).toString('hex');
            const expiry = Date.now() + expiresInDays * 24 * 60 * 60 * 1000;

            await this.fileShareRepository.create({
                user_id: userId,
                file_id: fileId,
                token,
                expiry,
            });

            return { shareUrl: `${Config.apiUrl}/api/files/shared/${token}`, token };
        } catch (error) {
            if (error instanceof AppError) throw error;
            logger.error({ err: error, userId, fileId }, 'Failed to share file');
            throw new AppError('Failed to share file', 500);
        }
    }

    async revokeShareFile(userId: string, fileId: string) {
        try {
            const file = await this.fileRepository.findByIdAndUser(fileId, userId);
            if (!file) throw new AppError('Unauthorized or file not found', 404);

            await this.fileShareRepository.revokeShareByFileId(fileId);
        } catch (error) {
            if (error instanceof AppError) throw error;
            logger.error({ err: error, userId, fileId }, 'Failed to revoke file share');
            throw new AppError('Failed to revoke file share', 500);
        }
    }

    async getSharedFileDownloadUrl(token: string) {
        try {
            const share = await this.fileShareRepository.findValidByToken(token);
            if (!share) throw new AppError('Invalid or expired share link', 404);

            const file = await this.fileRepository.findById(share.file_id);
            if (!file) throw new AppError('Shared file no longer exists', 404);

            const blob = await this.blobRepository.findById(file.blob_id);
            if (!blob) throw new AppError('Shared file content missing', 404);

            const command = new GetObjectCommand({
                Bucket: Config.doBucket,
                Key: blob.s3_key,
            });

            const presignUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
            return { file, download_url: presignUrl };
        } catch (error) {
            if (error instanceof AppError) throw error;
            logger.error({ err: error, token }, 'Failed to get shared file download URL');
            throw new AppError('Failed to retrieve shared file', 500);
        }
    }

    async getFileDownloadUrl(userId: string, fileId: string) {
        try {
            const file = await this.fileRepository.findByIdAndUser(fileId, userId);
            if (!file) throw new AppError('File not found', 404);

            const blob = await this.blobRepository.findById(file.blob_id);
            if (!blob) throw new AppError('Blob not found', 404);

            const command = new GetObjectCommand({
                Bucket: Config.doBucket,
                Key: blob.s3_key,
            });

            const presignUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
            return { file, download_url: presignUrl };
        } catch (error) {
            if (error instanceof AppError) throw error;
            logger.error({ err: error, userId, fileId }, 'Failed to get file download URL');
            throw new AppError('Failed to retrieve file', 500);
        }
    }

    async deleteFile(userId: string, fileId: string) {
        try {
            const file = await this.fileRepository.findByIdAndUser(fileId, userId);
            if (!file) throw new AppError('File not found', 404);

            await this.fileRepository.softDelete(fileId);
            return true;
        } catch (error) {
            if (error instanceof AppError) throw error;
            logger.error({ err: error, userId, fileId }, 'Failed to delete file');
            throw new AppError('Failed to delete file', 500);
        }
    }

    async restoreFile(userId: string, fileId: string) {
        try {
            const file = await this.fileRepository.findTrashedById(fileId, userId);
            if (!file) throw new AppError('File not found in trash', 404);

            return await this.fileRepository.restore(fileId);
        } catch (error) {
            if (error instanceof AppError) throw error;
            logger.error({ err: error, userId, fileId }, 'Failed to restore file');
            throw new AppError('Failed to restore file', 500);
        }
    }

    async permanentDeleteFile(userId: string, fileId: string) {
        try {
            const file = await this.fileRepository.findTrashedById(fileId, userId);
            if (!file) throw new AppError('File not found in trash', 404);

            await this.fileRepository.permanentDeleteWithCallback(fileId, async (blobId, s3Key, hasThumbnail, isLast) => {
                if (isLast) {
                    logger.info({ s3Key }, 'Deleting S3 blob');
                    const deleteBlobCmd = new DeleteObjectCommand({
                        Bucket: Config.doBucket,
                        Key: s3Key,
                    });
                    await s3Client.send(deleteBlobCmd);

                    if (hasThumbnail) {
                        const thumbKey = `thumbnails/${blobId}.jpg`;
                        logger.info({ thumbKey }, 'Deleting S3 thumbnail');
                        const deleteThumbCmd = new DeleteObjectCommand({
                            Bucket: Config.doBucket,
                            Key: thumbKey,
                        });
                        await s3Client.send(deleteThumbCmd);
                    }
                }
            });

            return true;
        } catch (error) {
            if (error instanceof AppError) throw error;
            logger.error({ err: error, userId, fileId }, 'Failed to permanently delete file');
            throw new AppError('Failed to permanently delete file', 500);
        }
    }

    async getTrash(userId: string) {
        try {
            const files = await this.fileRepository.findTrashedByUser(userId);

            // Enrich with thumbnail URLs
            const enriched = await Promise.all(files.map(async (file) => {
                const blob = await this.blobRepository.findById(file.blob_id);
                let thumbnail_url: string | null = null;

                if (blob?.has_thumbnail) {
                    const thumbCommand = new GetObjectCommand({
                        Bucket: Config.doBucket,
                        Key: `thumbnails/${blob.id}.jpg`,
                    });
                    thumbnail_url = await getSignedUrl(s3Client, thumbCommand, { expiresIn: 3600 });
                }

                return { ...file, thumbnail_url };
            }));

            return enriched;
        } catch (error) {
            logger.error({ err: error, userId }, 'Failed to get trash');
            throw new AppError('Failed to retrieve trash', 500);
        }
    }

    async renameFile(userId: string, fileId: string, newName: string) {
        try {
            const file = await this.fileRepository.findByIdAndUser(fileId, userId);
            if (!file) throw new AppError('File not found', 404);

            return await this.fileRepository.rename(fileId, newName);
        } catch (error) {
            if (error instanceof AppError) throw error;
            logger.error({ err: error, userId, fileId, newName }, 'Failed to rename file');
            throw new AppError('Failed to rename file', 500);
        }
    }

    async searchFiles(userId: string, queryString: string, offset: number, limit: number) {
        try {
            return await this.fileRepository.searchByUser(userId, queryString, limit, offset);
        } catch (error) {
            logger.error({ err: error, userId, queryString }, 'Failed to search files');
            throw new AppError('Failed to search files', 500);
        }
    }

    async listFiles(userId: string, folderId?: string | null) {
        try {
            const files = await this.fileRepository.findByFolderAndUser(userId, folderId || null);
            logger.debug({ count: files.length, userId, folderId }, 'Listed files');

            // Enrich each file with a thumbnail_url if its blob has_thumbnail
            const enriched = await Promise.all(files.map(async (file) => {
                const blob = await this.blobRepository.findById(file.blob_id);
                let thumbnail_url: string | null = null;

                if (blob?.has_thumbnail) {
                    const thumbKey = `thumbnails/${blob.id}.jpg`;
                    const thumbCommand = new GetObjectCommand({
                        Bucket: Config.doBucket,
                        Key: thumbKey,
                    });
                    thumbnail_url = await getSignedUrl(s3Client, thumbCommand, { expiresIn: 3600 });
                }

                return { ...file, thumbnail_url };
            }));

            return enriched;
        } catch (error) {
            logger.error({ err: error, userId, folderId }, 'Failed to list files');
            throw new AppError('Failed to list files', 500);
        }
    }
}
