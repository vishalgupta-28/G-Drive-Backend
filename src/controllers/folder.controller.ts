import { Request, Response, NextFunction } from 'express';
import { FolderService } from '../services/folder.service.js';
import { z } from 'zod';

const createFolderSchema = z.object({
    name: z.string().min(1),
    parent_id: z.string().uuid().optional().nullable(),
});

const renameFolderSchema = z.object({
    name: z.string().min(1),
});

export class FolderController {
    constructor(private readonly folderService: FolderService) { }

    async getFolders(req: Request, res: Response, next: NextFunction) {
        try {
            const user = req.user as any;
            const parentId = req.query.parent_id as string;

            let folders;
            if (parentId) {
                folders = await this.folderService.getChildrens(user.id, parentId);
            } else {
                folders = await this.folderService.getRootFolders(user.id);
            }
            res.status(200).json(folders);
        } catch (error) {
            next(error);
        }
    }

    async createFolder(req: Request, res: Response, next: NextFunction) {
        try {
            const user = req.user as any;
            const payload = createFolderSchema.parse(req.body);

            const folder = await this.folderService.createFolder(
                user.id,
                payload.name,
                payload.parent_id
            );

            res.status(201).json(folder);
        } catch (error) {
            next(error);
        }
    }

    async deleteFolder(req: Request, res: Response, next: NextFunction) {
        try {
            const user = req.user as any;
            const folderId = req.params.folderId as string;
            await this.folderService.deleteFolder(user.id, folderId);
            res.status(200).json({ success: true });
        } catch (error) {
            next(error);
        }
    }

    async renameFolder(req: Request, res: Response, next: NextFunction) {
        try {
            const user = req.user as any;
            const folderId = req.params.folderId as string;
            const payload = renameFolderSchema.parse(req.body);

            const updated = await this.folderService.renameFolder(user.id, folderId, payload.name);
            res.status(200).json(updated);
        } catch (error) {
            next(error);
        }
    }

    async restoreFolder(req: Request, res: Response, next: NextFunction) {
        try {
            const user = req.user as any;
            const folderId = req.params.folderId as string;
            const restored = await this.folderService.restoreFolder(user.id, folderId);
            res.status(200).json(restored);
        } catch (error) {
            next(error);
        }
    }
}
