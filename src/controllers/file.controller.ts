import { Request, Response, NextFunction } from 'express';
import { FileService } from '../services/file.service.js';

export class FileController {
    constructor(private readonly fileService: FileService) { }

    async listFiles(req: Request, res: Response, next: NextFunction) {
        try {
            const user = req.user as any;
            const folderId = (req.query.folder_id as string) || null;
            const files = await this.fileService.listFiles(user.id, folderId);
            res.status(200).json(files);
        } catch (error) {
            next(error);
        }
    }
    async getFile(req: Request, res: Response, next: NextFunction) {
        try {
            const user = req.user as any;
            const fileId = req.params.fileId as string;
            const result = await this.fileService.getFileDownloadUrl(user.id, fileId);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }

    async deleteFile(req: Request, res: Response, next: NextFunction) {
        try {
            const user = req.user as any;
            const fileId = req.params.fileId as string;
            await this.fileService.deleteFile(user.id, fileId);
            res.status(200).json({ success: true });
        } catch (error) {
            next(error);
        }
    }

    async getTrash(req: Request, res: Response, next: NextFunction) {
        try {
            const user = req.user as any;
            const trashedFiles = await this.fileService.getTrash(user.id);
            res.status(200).json(trashedFiles);
        } catch (error) {
            next(error);
        }
    }

    async restoreFile(req: Request, res: Response, next: NextFunction) {
        try {
            const user = req.user as any;
            const fileId = req.params.fileId as string;
            const restored = await this.fileService.restoreFile(user.id, fileId);
            res.status(200).json(restored);
        } catch (error) {
            next(error);
        }
    }

    async permanentDeleteFile(req: Request, res: Response, next: NextFunction) {
        try {
            const user = req.user as any;
            const fileId = req.params.fileId as string;
            await this.fileService.permanentDeleteFile(user.id, fileId);
            res.status(200).json({ success: true });
        } catch (error) {
            next(error);
        }
    }

    async renameFile(req: Request, res: Response, next: NextFunction) {
        try {
            const user = req.user as any;
            const fileId = req.params.fileId as string;
            const newName = req.query.newname as string;

            if (!newName) {
                return res.status(400).json({ error: 'newname query param required' });
            }

            const updated = await this.fileService.renameFile(user.id, fileId, newName);
            res.status(200).json(updated);
        } catch (error) {
            next(error);
        }
    }

    async searchFiles(req: Request, res: Response, next: NextFunction) {
        try {
            const user = req.user as any;
            const qs = req.query.querystring;
            const queryString = (Array.isArray(qs) ? qs[0] : qs) as string || '';

            const off = req.query.offset;
            const offsetStr = (Array.isArray(off) ? off[0] : off) as string;
            const offset = parseInt(offsetStr, 10) || 0;

            const lim = req.query.limit;
            const limitStr = (Array.isArray(lim) ? lim[0] : lim) as string;
            const limit = parseInt(limitStr, 10) || 20;

            const files = await this.fileService.searchFiles(user.id, queryString, offset, limit);
            res.status(200).json(files);
        } catch (error) {
            next(error);
        }
    }

    async shareFile(req: Request, res: Response, next: NextFunction) {
        try {
            const user = req.user as any;
            const fileId = req.params.fileId as string;
            const result = await this.fileService.shareFile(user.id, fileId);
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    }

    async revokeShareFile(req: Request, res: Response, next: NextFunction) {
        try {
            const user = req.user as any;
            const fileId = req.params.fileId as string;
            await this.fileService.revokeShareFile(user.id, fileId);
            res.status(200).json({ success: true });
        } catch (error) {
            next(error);
        }
    }

    async getSharedFile(req: Request, res: Response, next: NextFunction) {
        try {
            const token = req.params.token as string;
            const result = await this.fileService.getSharedFileDownloadUrl(token);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }
}
