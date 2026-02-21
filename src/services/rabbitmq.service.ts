import amqp from 'amqplib';
import { Config } from '../config/config.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/AppError.js';

class RabbitMQService {
    private connection: any = null;
    private channel: any = null;
    private readonly queueName = 'PROCESS_THUMBNAIL';

    async connect(): Promise<void> {
        try {
            this.connection = await amqp.connect(Config.rabbitMqUrl);
            this.channel = await this.connection.createChannel();

            // Ensure the queue exists
            await this.channel.assertQueue(this.queueName, {
                durable: true // Survive RabbitMQ restarts
            });

            logger.info(`🐰 Connected to RabbitMQ on queue: ${this.queueName}`);
        } catch (error) {
            logger.error({ err: error }, 'Failed to connect to RabbitMQ');
            // In a robust app, we might retry or crash here
            throw new AppError('Failed to connect to message broker', 500);
        }
    }

    async publishThumbnailJob(jobData: { fileId: string; blobId: string; s3Key: string; type: string }): Promise<boolean> {
        if (!this.channel) {
            logger.error('RabbitMQ channel not initialized. Cannot publish job.');
            return false;
        }

        try {
            const buffer = Buffer.from(JSON.stringify(jobData));
            // Publish to queue (persistent message)
            const result = this.channel.sendToQueue(this.queueName, buffer, {
                persistent: true
            });
            logger.info(`🐰 Published thumbnail job for blobId: ${jobData.blobId}`);
            return result;
        } catch (error) {
            logger.error({ err: error, blobId: jobData.blobId }, 'Error publishing to RabbitMQ');
            return false;
        }
    }

    async close(): Promise<void> {
        try {
            if (this.channel) await this.channel.close();
            if (this.connection) await this.connection.close();
            logger.info('RabbitMQ connection closed');
        } catch (error) {
            logger.error({ err: error }, 'Error closing RabbitMQ connection');
        }
    }
}

// Export a singleton instance
export const rabbitMQService = new RabbitMQService();
