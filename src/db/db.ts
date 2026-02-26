import { NodePgDatabase, drizzle } from 'drizzle-orm/node-postgres';
import { logger } from '../utils/logger.js';
import * as schema from './schema/schema.js';

export async function connectToDB(databaseUrl: string): Promise<NodePgDatabase<typeof schema>> {
    try {
        const db = drizzle(databaseUrl, { schema });
        logger.info('Connected to the database successfully.');
        return db;
    } catch (error) {
        logger.error({ error }, 'Failed to connect to the database');
        throw error;
    }

}