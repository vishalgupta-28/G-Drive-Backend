import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema/schema.js';
import { logger } from '../utils/logger.js';

export class UserRepository {
    constructor(private readonly db: NodePgDatabase<typeof schema>) { }

    async findById(id: string) {
        try {
            const users = await this.db.select().from(schema.usersTable).where(eq(schema.usersTable.id, id));
            return users[0] || null;
        } catch (error) {
            logger.error({ err: error, userId: id }, 'UserRepository.findById failed');
            throw error;
        }
    }

    async findByEmail(email: string) {
        try {
            const users = await this.db.select().from(schema.usersTable).where(eq(schema.usersTable.email, email));
            return users[0] || null;
        } catch (error) {
            logger.error({ err: error, email }, 'UserRepository.findByEmail failed');
            throw error;
        }
    }

    async create(data: { email: string; name: string; profile_image?: string }) {
        try {
            const result = await this.db.insert(schema.usersTable).values({
                email: data.email,
                name: data.name,
                profile_image: data.profile_image,
            }).returning();
            return result[0];
        } catch (error) {
            logger.error({ err: error, email: data.email }, 'UserRepository.create failed');
            throw error;
        }
    }

    async updateProfileImage(id: string, imageUrl: string) {
        try {
            const result = await this.db.update(schema.usersTable).set({ profile_image: imageUrl }).where(eq(schema.usersTable.id, id)).returning();
            return result[0];
        } catch (error) {
            logger.error({ err: error, userId: id }, 'UserRepository.updateProfileImage failed');
            throw error;
        }
    }

    async updateQuota(id: string, newQuota: number) {
        try {
            const result = await this.db.update(schema.usersTable).set({ quota: newQuota }).where(eq(schema.usersTable.id, id)).returning();
            return result[0];
        } catch (error) {
            logger.error({ err: error, userId: id }, 'UserRepository.updateQuota failed');
            throw error;
        }
    }
}
