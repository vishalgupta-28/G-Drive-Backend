import { FolderRepository } from '../repositories/folder.repository.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

export class FolderService {
    constructor(private readonly folderRepository: FolderRepository) { }

    async getRootFolders(userId: string) {
        try {
            return await this.folderRepository.getRootFoldersByUser(userId);
        } catch (error) {
            logger.error({ err: error, userId }, 'Failed to get root folders');
            throw new AppError('Failed to retrieve root folders', 500);
        }
    }

    async getChildrens(userId: string, parentId: string) {
        try {
            return await this.folderRepository.getChildrensByParentId(parentId, userId);
        } catch (error) {
            logger.error({ err: error, userId, parentId }, 'Failed to get children folders');
            throw new AppError('Failed to retrieve children folders', 500);
        }
    }

    async createFolder(userId: string, name: string, parentId?: string | null) {
        try {
            if (parentId) {
                const parent = await this.folderRepository.findByIdAndUser(parentId, userId);
                if (!parent) throw new AppError('Parent folder not found', 404);
            }

            return await this.folderRepository.create({
                name,
                user_id: userId,
                parent_id: parentId,
            });
        } catch (error) {
            if (error instanceof AppError) throw error;
            logger.error({ err: error, userId, name, parentId }, 'Failed to create folder');
            throw new AppError('Failed to create folder', 500);
        }
    }

    async deleteFolder(userId: string, folderId: string) {
        try {
            const folder = await this.folderRepository.findByIdAndUser(folderId, userId);
            if (!folder) throw new AppError('Folder not found', 404);

            await this.folderRepository.softDelete(folderId);
            return true;
        } catch (error) {
            if (error instanceof AppError) throw error;
            logger.error({ err: error, userId, folderId }, 'Failed to delete folder');
            throw new AppError('Failed to delete folder', 500);
        }
    }

    async restoreFolder(userId: string, folderId: string) {
        try {
            const folder = await this.folderRepository.findTrashedById(folderId, userId);
            if (!folder) throw new AppError('Folder not found in trash', 404);

            return await this.folderRepository.restore(folderId);
        } catch (error) {
            if (error instanceof AppError) throw error;
            logger.error({ err: error, userId, folderId }, 'Failed to restore folder');
            throw new AppError('Failed to restore folder', 500);
        }
    }

    async renameFolder(userId: string, folderId: string, newName: string) {
        try {
            const folder = await this.folderRepository.findByIdAndUser(folderId, userId);
            if (!folder) throw new AppError('Folder not found', 404);

            return await this.folderRepository.rename(folderId, newName);
        } catch (error) {
            if (error instanceof AppError) throw error;
            logger.error({ err: error, userId, folderId, newName }, 'Failed to rename folder');
            throw new AppError('Failed to rename folder', 500);
        }
    }
}
