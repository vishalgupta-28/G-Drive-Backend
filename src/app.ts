import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import passport from 'passport';
import { connectToDB } from './db/db.js';
import { Config } from './config/config.js';
import { errorHandler } from './middleware/error.middleware.js';
import { configurePassport } from './config/passport.js';

import { UserRepository } from './repositories/user.repository.js';
import { BlobRepository } from './repositories/blob.repository.js';
import { UploadRepository } from './repositories/upload.repository.js';
import { FileRepository } from './repositories/file.repository.js';
import { FolderRepository } from './repositories/folder.repository.js';
import { FileShareRepository } from './repositories/file_share.repository.js';
import { RedisClient } from './config/redis.js';

import { AuthService } from './services/auth.service.js';
import { UploadService } from './services/upload.service.js';
import { FileService } from './services/file.service.js';
import { FolderService } from './services/folder.service.js';

import { AuthController } from './controllers/auth.controller.js';
import { UploadController } from './controllers/upload.controller.js';
import { FileController } from './controllers/file.controller.js';
import { FolderController } from './controllers/folder.controller.js';

import { setupRoutes } from './routes/index.js';

export async function createApp() {
    const app = express();

    // Middleware
    app.use(cors());
    app.use(helmet());
    app.use(morgan('dev'));
    app.use(express.json());
    app.use(passport.initialize());

    // Database & Redis & RabbitMQ
    const db = await connectToDB(Config.dbUrl);
    const redis = RedisClient.getInstance();

    // Import and connect RabbitMQ
    const { rabbitMQService } = await import('./services/rabbitmq.service.js');
    await rabbitMQService.connect();

    // Dependency Injection Setup
    // Repositories
    const userRepository = new UserRepository(db);
    const blobRepository = new BlobRepository(db);
    const uploadRepository = new UploadRepository(db);
    const fileRepository = new FileRepository(db);
    const folderRepository = new FolderRepository(db);
    const fileShareRepository = new FileShareRepository(db);

    // Services
    const authService = new AuthService(userRepository, redis, fileRepository);
    const uploadService = new UploadService(uploadRepository, blobRepository, fileRepository);
    const fileService = new FileService(fileRepository, blobRepository, fileShareRepository);
    const folderService = new FolderService(folderRepository);

    // Passport Configure
    configurePassport(authService);

    // Controllers
    const authController = new AuthController(authService);
    const uploadController = new UploadController(uploadService);
    const fileController = new FileController(fileService);
    const folderController = new FolderController(folderService);

    // Routes
    app.use('/api', setupRoutes(authController, uploadController, fileController, folderController));

    // Health Check
    app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

    // Global Error Handler
    app.use(errorHandler);

    return app;
}