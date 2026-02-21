import { eq, and, gt } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema/schema.js';
import { logger } from '../utils/logger.js';

export class FileShareRepository {
    constructor(private readonly db: NodePgDatabase<typeof schema>) { }

    async create(data: { user_id: string; file_id: string; token: string; expiry: number }) {
        try {
            const result = await this.db.insert(schema.fileShareTable).values(data).returning();
            return result[0];
        } catch (error) {
            logger.error({ err: error, fileId: data.file_id }, 'FileShareRepository.create failed');
            throw error;
        }
    }

    async findValidByToken(token: string) {
        try {
            const now = Date.now();
            const results = await this.db.select().from(schema.fileShareTable).where(
                and(
                    eq(schema.fileShareTable.token, token),
                    gt(schema.fileShareTable.expiry, now)
                )
            );
            return results[0] || null;
        } catch (error) {
            logger.error({ err: error }, 'FileShareRepository.findValidByToken failed');
            throw error;
        }
    }

    async revokeShareByFileId(fileId: string) {
        try {
            await this.db.delete(schema.fileShareTable).where(eq(schema.fileShareTable.file_id, fileId));
        } catch (error) {
            logger.error({ err: error, fileId }, 'FileShareRepository.revokeShareByFileId failed');
            throw error;
        }
    }
}
