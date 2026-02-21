import { Router } from 'express';
import { UploadController } from '../controllers/upload.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export function setupUploadRoutes(uploadController: UploadController) {
    const router = Router();

    router.use(requireAuth);
    router.post('/presign', uploadController.presign.bind(uploadController));
    router.post('/complete', uploadController.complete.bind(uploadController));

    return router;
}
