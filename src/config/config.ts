import * as dotenv from 'dotenv';
import { z } from 'zod';
dotenv.config();

const envSchema = z.object({
    PORT: z.string().default('3000'),
    DATABASE_URL: z.string(),
    GOOGLE_CLIENT_ID: z.string(),
    GOOGLE_CLIENT_SECRET: z.string(),
    JWT_SECRET: z.string(),
    API_URL: z.string(),
    FRONTEND_URL: z.string(),
    REDIS_URL: z.string().default('redis://localhost:6379'),
    RABBITMQ_URL: z.string().default('amqp://localhost:5672'),
    DO_REGION: z.string().default('blr1'),
    DO_ENDPOINT: z.string().url(),
    DO_ACCESS_KEY: z.string(),
    DO_SECRET_KEY: z.string(),
    DO_BUCKET_NAME: z.string(),
});

const env = envSchema.parse(process.env);

export const Config = {
    port: parseInt(env.PORT, 10),
    dbUrl: env.DATABASE_URL,
    googleClientId: env.GOOGLE_CLIENT_ID,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    jwtSecret: env.JWT_SECRET,
    apiUrl: env.API_URL,
    frontendUrl: env.FRONTEND_URL,
    redisUrl: env.REDIS_URL,
    rabbitMqUrl: env.RABBITMQ_URL,
    awsRegion: env.DO_REGION,
    doEndpoint: env.DO_ENDPOINT,
    doAccessKeyId: env.DO_ACCESS_KEY,
    doSecretAccessKey: env.DO_SECRET_KEY,
    doBucket: env.DO_BUCKET_NAME,
};