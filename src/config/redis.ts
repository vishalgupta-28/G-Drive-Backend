import { Redis } from 'ioredis';
import { Config } from '../config/config.js';
import { logger } from '../utils/logger.js';

export class RedisClient {
    private static instance: Redis;

    private constructor() { }

    public static getInstance(): Redis {
        try {
            if (!this.instance) {
                this.instance = new Redis(Config.redisUrl, { maxRetriesPerRequest: null });
                this.instance.on('error', (err) => logger.error({ err }, 'Redis Error'));
                this.instance.on('connect', () => {
                    logger.info('Redis connected');
                    logger.info('Connected to Redis successfully');
                });
            }
            return this.instance;
        } catch (error) {
            logger.error({ error }, 'Failed to create Redis client instance');
            throw error;
        }
    }
}
