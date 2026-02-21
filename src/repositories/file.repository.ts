import { eq, and, isNull, isNotNull, ilike, count, sum } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema/schema.js';
import { logger } from '../utils/logger.js';

export class FileRepository {
    constructor(private readonly db: NodePgDatabase<typeof schema>) { }

    async findByIdAndUser(id: string, userId: string) {
        try {
            const files = await this.db.select().from(schema.filesTable).where(
                and(eq(schema.filesTable.id, id), isNull(schema.filesTable.deleted_at))
            );
            const file = files[0];
            if (file && file.user_id === userId) {
                return file;
            }
            return null;
        } catch (error) {
            logger.error({ err: error, fileId: id, userId }, 'FileRepository.findByIdAndUser failed');
            throw error;
        }
    }

    async findById(id: string) {
        try {
            const files = await this.db.select().from(schema.filesTable).where(
                and(eq(schema.filesTable.id, id), isNull(schema.filesTable.deleted_at))
            );
            return files[0] || null;
        } catch (error) {
            logger.error({ err: error, fileId: id }, 'FileRepository.findById failed');
            throw error;
        }
    }

    async create(data: { name: string; blob_id: string; user_id: string; size: number; type: any; folder_id?: string | null }) {
        try {
            const result = await this.db.insert(schema.filesTable).values(data).returning();
            return result[0];
        } catch (error) {
            logger.error({ err: error, fileName: data.name, userId: data.user_id }, 'FileRepository.create failed');
            throw error;
        }
    }

    async softDelete(id: string) {
        try {
            const result = await this.db.update(schema.filesTable)
                .set({ deleted_at: new Date() })
                .where(eq(schema.filesTable.id, id))
                .returning();
            return result[0];
        } catch (error) {
            logger.error({ err: error, fileId: id }, 'FileRepository.softDelete failed');
            throw error;
        }
    }

    async restore(id: string) {
        try {
            const result = await this.db.update(schema.filesTable)
                .set({ deleted_at: null })
                .where(eq(schema.filesTable.id, id))
                .returning();
            return result[0];
        } catch (error) {
            logger.error({ err: error, fileId: id }, 'FileRepository.restore failed');
            throw error;
        }
    }

    async permanentDelete(id: string) {
        try {
            const result = await this.db.delete(schema.filesTable).where(eq(schema.filesTable.id, id)).returning();
            return result[0];
        } catch (error) {
            logger.error({ err: error, fileId: id }, 'FileRepository.permanentDelete failed');
            throw error;
        }
    }

    async permanentDeleteWithCallback(id: string, s3DeleteCallback: (blobId: string, s3Key: string, hasThumbnail: boolean, isLast: boolean) => Promise<void>) {
        try {
            return await this.db.transaction(async (tx) => {
                // grab the file
                const fileRes = await tx.select().from(schema.filesTable).where(eq(schema.filesTable.id, id));
                const file = fileRes[0];
                if (!file) throw new Error("File not found");

                // delete the file
                await tx.delete(schema.filesTable).where(eq(schema.filesTable.id, id));

                // check if other files use the same blob
                const countRes = await tx.select({ value: count() }).from(schema.filesTable).where(eq(schema.filesTable.blob_id, file.blob_id));
                const remaining = Number(countRes[0].value);
                const isLast = remaining === 0;

                const blobRes = await tx.select().from(schema.blobsTable).where(eq(schema.blobsTable.id, file.blob_id));
                const blob = blobRes[0];

                if (isLast && blob) {
                    // delete the blob from db
                    await tx.delete(schema.blobsTable).where(eq(schema.blobsTable.id, blob.id));
                }

                // execute S3 callback BEFORE committing the transaction
                // if it throws, the transaction rolls back
                if (blob) {
                    await s3DeleteCallback(blob.id, blob.s3_key, !!blob.has_thumbnail, isLast);
                }
            });
        } catch (error) {
            logger.error({ err: error, fileId: id }, 'FileRepository.permanentDeleteWithCallback failed');
            throw error;
        }
    }

    async findTrashedByUser(userId: string) {
        try {
            return await this.db.select().from(schema.filesTable).where(
                and(
                    eq(schema.filesTable.user_id, userId),
                    isNotNull(schema.filesTable.deleted_at)
                )
            );
        } catch (error) {
            logger.error({ err: error, userId }, 'FileRepository.findTrashedByUser failed');
            throw error;
        }
    }

    async findTrashedById(id: string, userId: string) {
        try {
            const files = await this.db.select().from(schema.filesTable).where(
                and(
                    eq(schema.filesTable.id, id),
                    eq(schema.filesTable.user_id, userId),
                    isNotNull(schema.filesTable.deleted_at)
                )
            );
            return files[0] || null;
        } catch (error) {
            logger.error({ err: error, fileId: id, userId }, 'FileRepository.findTrashedById failed');
            throw error;
        }
    }

    async rename(id: string, newName: string) {
        try {
            const result = await this.db.update(schema.filesTable).set({ name: newName }).where(eq(schema.filesTable.id, id)).returning();
            return result[0];
        } catch (error) {
            logger.error({ err: error, fileId: id, newName }, 'FileRepository.rename failed');
            throw error;
        }
    }

    async searchByUser(userId: string, query: string, limit: number, offset: number) {
        try {
            const files = await this.db.select()
                .from(schema.filesTable)
                .where(
                    and(
                        eq(schema.filesTable.user_id, userId),
                        ilike(schema.filesTable.name, `%${query}%`),
                        isNull(schema.filesTable.deleted_at)
                    )
                )
                .limit(limit)
                .offset(offset);
            return files;
        } catch (error) {
            logger.error({ err: error, userId, query }, 'FileRepository.searchByUser failed');
            throw error;
        }
    }

    async findByUser(userId: string) {
        try {
            return await this.db.select().from(schema.filesTable).where(
                and(eq(schema.filesTable.user_id, userId), isNull(schema.filesTable.deleted_at))
            );
        } catch (error) {
            logger.error({ err: error, userId }, 'FileRepository.findByUser failed');
            throw error;
        }
    }

    async findByFolderAndUser(userId: string, folderId: string | null) {
        try {
            const allFiles = await this.db.select().from(schema.filesTable).where(
                and(eq(schema.filesTable.user_id, userId), isNull(schema.filesTable.deleted_at))
            );
            if (folderId) {
                return allFiles.filter(f => f.folder_id === folderId);
            }
            return allFiles.filter(f => f.folder_id === null);
        } catch (error) {
            logger.error({ err: error, userId, folderId }, 'FileRepository.findByFolderAndUser failed');
            throw error;
        }
    }

    async getUsedStorageByUser(userId: string): Promise<number> {
        try {
            const result = await this.db.select({ total: sum(schema.filesTable.size) })
                .from(schema.filesTable)
                .where(
                    and(
                        eq(schema.filesTable.user_id, userId),
                        isNull(schema.filesTable.deleted_at)
                    )
                );
            return Number(result[0]?.total) || 0;
        } catch (error) {
            logger.error({ err: error, userId }, 'FileRepository.getUsedStorageByUser failed');
            throw error;
        }
    }
}
