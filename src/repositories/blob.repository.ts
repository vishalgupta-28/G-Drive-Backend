import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema/schema.js';
import { logger } from '../utils/logger.js';

export class BlobRepository {
    constructor(private readonly db: NodePgDatabase<typeof schema>) { }

    async findById(id: string) {
        try {
            const blobs = await this.db.select().from(schema.blobsTable).where(eq(schema.blobsTable.id, id));
            return blobs[0] || null;
        } catch (error) {
            logger.error({ err: error, blobId: id }, 'BlobRepository.findById failed');
            throw error;
        }
    }

    async findByKey(s3Key: string) {
        try {
            const blobs = await this.db.select().from(schema.blobsTable).where(eq(schema.blobsTable.s3_key, s3Key));
            return blobs[0] || null;
        } catch (error) {
            logger.error({ err: error, s3Key }, 'BlobRepository.findByKey failed');
            throw error;
        }
    }

    async create(data: { s3_key: string; size: number }) {
        try {
            const result = await this.db.insert(schema.blobsTable).values(data).returning();
            return result[0];
        } catch (error) {
            logger.error({ err: error, s3Key: data.s3_key }, 'BlobRepository.create failed');
            throw error;
        }
    }

    async delete(id: string) {
        try {
            const result = await this.db.delete(schema.blobsTable).where(eq(schema.blobsTable.id, id)).returning();
            return result[0];
        } catch (error) {
            logger.error({ err: error, blobId: id }, 'BlobRepository.delete failed');
            throw error;
        }
    }
}
