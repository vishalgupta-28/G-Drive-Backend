import { PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { UploadRepository } from '../repositories/upload.repository.js';
import { BlobRepository } from '../repositories/blob.repository.js';
import { FileRepository } from '../repositories/file.repository.js';
import { s3Client } from '../config/aws.js';
import { Config } from '../config/config.js';
import { rabbitMQService } from './rabbitmq.service.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

export class UploadService {
    constructor(
        private readonly uploadRepository: UploadRepository,
        private readonly blobRepository: BlobRepository,
        private readonly fileRepository: FileRepository
    ) { }

    async createPresignedUrl(userId: string, fileName: string, fileType: string, fileSize: number) {
        try {
            const s3Key = uuidv4();
            const command = new PutObjectCommand({
                Bucket: Config.doBucket,
                Key: s3Key,
                ContentType: fileType,
                ContentLength: fileSize,
            });

            // Expires in 1 hour
            const presignUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
            const expiry = Date.now() + 3600 * 1000;

            const upload = await this.uploadRepository.create({
                user_id: userId,
                presign_url: s3Key, // Store the s3Key instead of full URL for later verification
                expiry,
            });

            return {
                upload_id: upload.id,
                presign_url: presignUrl,
                expiry,
            };
        } catch (error) {
            logger.error({ err: error, userId, fileName }, 'Failed to create presigned URL');
            throw new AppError('Failed to initialize upload', 500);
        }
    }

    private mapMimeToEnum(mime: string): 'pdf' | 'txt' | 'doc' | 'jpg' | 'png' | 'mp3' | 'mp4' | 'other' {
        const lower = mime.toLowerCase();
        if (lower.includes('pdf')) return 'pdf';
        if (lower.includes('text/plain')) return 'txt';
        if (lower.includes('word') || lower.includes('document')) return 'doc';
        if (lower.includes('jpeg') || lower.includes('jpg')) return 'jpg';
        if (lower.includes('png')) return 'png';
        if (lower.includes('mp3') || lower.includes('audio')) return 'mp3';
        if (lower.includes('mp4') || lower.includes('video')) return 'mp4';
        return 'other';
    }

    async completeUpload(userId: string, uploadId: string, fileName: string, fileType: string, folderId?: string | null) {
        try {
            const upload = await this.uploadRepository.findById(uploadId);

            if (!upload || upload.user_id !== userId || upload.status !== 'pending') {
                throw new AppError('Invalid upload', 400);
            }

            const s3Key = upload.presign_url; // We stored s3Key here

            // Verify file in S3
            const command = new HeadObjectCommand({ Bucket: Config.doBucket, Key: s3Key });
            const s3Meta = await s3Client.send(command).catch(() => null);

            if (!s3Meta) {
                await this.uploadRepository.updateStatus(uploadId, 'failed');
                throw new AppError('File not found in S3', 400);
            }

            const size = s3Meta.ContentLength || 0;
            const dbFileType = this.mapMimeToEnum(fileType);

            // Create Blob
            const blob = await this.blobRepository.create({
                s3_key: s3Key,
                size,
            });

            // Create File
            const file = await this.fileRepository.create({
                name: fileName,
                blob_id: blob.id,
                user_id: userId,
                folder_id: folderId,
                size,
                type: dbFileType, // database strictly expects one of the enum values
            });

            await this.uploadRepository.updateStatus(uploadId, 'completed');

            // Fire & Forget: Dispatch Thumbnail Job for renderable documents, video, and images
            const thumbnailTypes = ['pdf', 'doc', 'mp4', 'jpg', 'png'];
            if (thumbnailTypes.includes(dbFileType)) {
                rabbitMQService.publishThumbnailJob({
                    fileId: file.id,
                    blobId: blob.id,
                    s3Key: s3Key,
                    type: dbFileType
                }).catch(err => logger.error({ err, uploadId }, 'Failed to dispatch thumbnail job'));
            }

            return file;
        } catch (error) {
            if (error instanceof AppError) throw error;
            logger.error({ err: error, uploadId, userId }, 'Failed to complete upload');
            throw new AppError('Failed to complete upload processing', 500);
        }
    }
}
