import { Router } from 'express';
import { FileController } from '../controllers/file.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export function setupFileRoutes(fileController: FileController) {
    const router = Router();

    // Public routes
    router.get('/shared/:token', fileController.getSharedFile.bind(fileController));

    router.use(requireAuth);
    router.get('/', fileController.listFiles.bind(fileController));
    router.get('/trash', fileController.getTrash.bind(fileController));
    router.get('/search', fileController.searchFiles.bind(fileController));
    router.get('/:fileId', fileController.getFile.bind(fileController));
    router.delete('/:fileId/permanent', fileController.permanentDeleteFile.bind(fileController));
    router.delete('/:fileId', fileController.deleteFile.bind(fileController));
    router.patch('/:fileId/rename', fileController.renameFile.bind(fileController));
    router.patch('/:fileId/restore', fileController.restoreFile.bind(fileController));
    router.post('/:fileId/share', fileController.shareFile.bind(fileController));
    router.delete('/:fileId/share', fileController.revokeShareFile.bind(fileController));

    return router;
}
