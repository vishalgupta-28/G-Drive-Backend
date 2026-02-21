import { Request, Response, NextFunction } from 'express';
import { UploadService } from '../services/upload.service.js';
import { z } from 'zod';

const presignSchema = z.object({
    file_name: z.string().min(1),
    file_type: z.string().min(1),
    file_size: z.number().positive(),
});

const completeSchema = z.object({
    upload_id: z.string().uuid(),
    file_name: z.string().min(1),
    file_type: z.string().min(1),
    folder_id: z.string().uuid().optional().nullable(),
});

export class UploadController {
    constructor(private readonly uploadService: UploadService) { }

    async presign(req: Request, res: Response, next: NextFunction) {
        try {
            const user = req.user as any;
            const payload = presignSchema.parse(req.body);

            const result = await this.uploadService.createPresignedUrl(
                user.id,
                payload.file_name,
                payload.file_type,
                payload.file_size
            );

            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }

    async complete(req: Request, res: Response, next: NextFunction) {
        try {
            const user = req.user as any;
            const payload = completeSchema.parse(req.body);

            const result = await this.uploadService.completeUpload(
                user.id,
                payload.upload_id,
                payload.file_name,
                payload.file_type,
                payload.folder_id
            );

            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }
}
