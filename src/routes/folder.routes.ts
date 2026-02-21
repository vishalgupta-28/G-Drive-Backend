import { Router } from 'express';
import { FolderController } from '../controllers/folder.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export function setupFolderRoutes(folderController: FolderController) {
    const router = Router();

    router.use(requireAuth);
    router.get('/', folderController.getFolders.bind(folderController));
    router.post('/', folderController.createFolder.bind(folderController));
    router.delete('/:folderId', folderController.deleteFolder.bind(folderController));
    router.patch('/:folderId', folderController.renameFolder.bind(folderController));
    router.patch('/:folderId/restore', folderController.restoreFolder.bind(folderController));

    return router;
}
