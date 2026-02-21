import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema/schema.js';
import { logger } from '../utils/logger.js';

export class UploadRepository {
    constructor(private readonly db: NodePgDatabase<typeof schema>) { }

    async findById(id: string) {
        try {
            const uploads = await this.db.select().from(schema.uploadsTable).where(eq(schema.uploadsTable.id, id));
            return uploads[0] || null;
        } catch (error) {
            logger.error({ err: error, uploadId: id }, 'UploadRepository.findById failed');
            throw error;
        }
    }

    async create(data: { user_id: string; presign_url: string; expiry: number; status?: any }) {
        try {
            const result = await this.db.insert(schema.uploadsTable).values(data).returning();
            return result[0];
        } catch (error) {
            logger.error({ err: error, userId: data.user_id }, 'UploadRepository.create failed');
            throw error;
        }
    }

    async updateStatus(id: string, status: 'pending' | 'completed' | 'failed') {
        try {
            const result = await this.db.update(schema.uploadsTable).set({ status }).where(eq(schema.uploadsTable.id, id)).returning();
            return result[0];
        } catch (error) {
            logger.error({ err: error, uploadId: id, status }, 'UploadRepository.updateStatus failed');
            throw error;
        }
    }
}
