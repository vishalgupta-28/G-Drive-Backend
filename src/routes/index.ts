import { Router } from 'express';
import { setupAuthRoutes } from './auth.routes.js';
import { setupUploadRoutes } from './upload.routes.js';
import { setupFileRoutes } from './file.routes.js';
import { setupFolderRoutes } from './folder.routes.js';
import { AuthController } from '../controllers/auth.controller.js';
import { UploadController } from '../controllers/upload.controller.js';
import { FileController } from '../controllers/file.controller.js';
import { FolderController } from '../controllers/folder.controller.js';

export function setupRoutes(
    authController: AuthController,
    uploadController: UploadController,
    fileController: FileController,
    folderController: FolderController
) {
    const router = Router();

    router.use('/auth', setupAuthRoutes(authController));
    router.use('/uploads', setupUploadRoutes(uploadController));
    router.use('/files', setupFileRoutes(fileController));
    router.use('/folders', setupFolderRoutes(folderController));

    return router;
}
