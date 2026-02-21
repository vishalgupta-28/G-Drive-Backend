import jwt from 'jsonwebtoken';
import { Redis } from 'ioredis';
import { UserRepository } from '../repositories/user.repository.js';
import { FileRepository } from '../repositories/file.repository.js';
import { Config } from '../config/config.js';
import { v4 as uuidv4 } from 'uuid';
import { s3Client } from '../config/aws.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

export class AuthService {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly redisClient: Redis,
        private readonly fileRepository: FileRepository
    ) { }

    async handleGoogleLogin(profile: { email: string; name: string; googleImageUrl?: string }) {
        try {
            let user = await this.userRepository.findByEmail(profile.email);

            logger.info({ email: profile.email }, '[Google Auth] Starting login');
            if (profile.googleImageUrl) {
                logger.debug({ url: profile.googleImageUrl }, '[Google Auth] Profile Image from Google');
            }

            let profile_image: string | undefined = undefined;

            if (profile.googleImageUrl && (!user || !user.profile_image)) {
                try {
                    logger.debug('[Google Auth] Downloading image buffer...');
                    const response = await fetch(profile.googleImageUrl);
                    if (response.ok) {
                        const arrayBuffer = await response.arrayBuffer();
                        const buffer = Buffer.from(arrayBuffer);
                        const s3Key = `profiles/${uuidv4()}.jpg`;

                        logger.debug({ bucket: Config.doBucket, key: s3Key }, '[Google Auth] Uploading image buffer to S3');
                        await s3Client.send(new PutObjectCommand({
                            Bucket: Config.doBucket,
                            Key: s3Key,
                            Body: buffer,
                            ContentType: response.headers.get('content-type') || 'image/jpeg',
                            ACL: 'public-read'
                        }));

                        profile_image = `https://${Config.doBucket}.${Config.awsRegion}.digitaloceanspaces.com/${s3Key}`;
                        logger.info({ profile_image }, '[Google Auth] Successfully mapped S3 URL to profile_image');
                    } else {
                        logger.warn({ status: response.status }, '[Google Auth] Failed to fetch image');
                    }
                } catch (error) {
                    logger.error({ err: error }, '[Google Auth] Unexpected error while fetching or uploading profile image');
                }
            } else {
                logger.debug({
                    hasGoogleImage: !!profile.googleImageUrl,
                    userExists: !!user,
                    userHasImage: !!user?.profile_image
                }, '[Google Auth] Skipping image fetch');
            }

            if (!user) {
                user = await this.userRepository.create({
                    email: profile.email,
                    name: profile.name,
                    profile_image,
                });
            } else if (profile_image && !user.profile_image) {
                user = await this.userRepository.updateProfileImage(user.id, profile_image);
            }

            return user;
        } catch (error) {
            logger.error({ err: error, profile }, 'Failed to handle Google login');
            throw new AppError('Authentication failed', 500);
        }
    }

    async createSession(user: { id: string; email: string }) {
        try {
            const sessionId = uuidv4();

            // Store session in Redis for 7 days
            await this.redisClient.set(`session:${sessionId}`, JSON.stringify({ id: user.id }), 'EX', 7 * 24 * 60 * 60);

            // JWT token will carry just the sessionId payload
            return jwt.sign(
                { sessionId },
                Config.jwtSecret,
                { expiresIn: '7d' }
            );
        } catch (error) {
            logger.error({ err: error, userId: user.id }, 'Failed to create session');
            throw new AppError('Failed to create session', 500);
        }
    }

    async deleteSession(token: string) {
        try {
            const decoded = jwt.verify(token, Config.jwtSecret) as { sessionId: string };
            await this.redisClient.del(`session:${decoded.sessionId}`);
            return true;
        } catch (error) {
            logger.error({ err: error }, 'Failed to delete session (invalid token or redis error)');
            return false;
        }
    }

    async getUserById(id: string) {
        try {
            const user = await this.userRepository.findById(id);
            if (!user) throw new AppError('User not found', 404);

            const used_storage = await this.fileRepository.getUsedStorageByUser(id);

            return { ...user, used_storage };
        } catch (error) {
            if (error instanceof AppError) throw error;
            logger.error({ err: error, userId: id }, 'Failed to get user by id');
            throw new AppError('Failed to retrieve user', 500);
        }
    }
}
