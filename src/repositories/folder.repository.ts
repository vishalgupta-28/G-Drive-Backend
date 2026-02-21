import { eq, and, isNull, isNotNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema/schema.js';
import { logger } from '../utils/logger.js';

export class FolderRepository {
    constructor(private readonly db: NodePgDatabase<typeof schema>) { }

    async findByIdAndUser(id: string, userId: string) {
        try {
            const folders = await this.db.select().from(schema.foldersTable).where(
                and(eq(schema.foldersTable.id, id), isNull(schema.foldersTable.deleted_at))
            );
            const folder = folders[0];
            if (folder && folder.user_id === userId) {
                return folder;
            }
            return null;
        } catch (error) {
            logger.error({ err: error, folderId: id, userId }, 'FolderRepository.findByIdAndUser failed');
            throw error;
        }
    }

    async getRootFoldersByUser(userId: string) {
        try {
            const folders = await this.db.select().from(schema.foldersTable).where(
                and(eq(schema.foldersTable.user_id, userId), isNull(schema.foldersTable.deleted_at))
            );
            return folders.filter(f => f.parent_id === null);
        } catch (error) {
            logger.error({ err: error, userId }, 'FolderRepository.getRootFoldersByUser failed');
            throw error;
        }
    }

    async getChildrensByParentId(parentId: string, userId: string) {
        try {
            const folders = await this.db.select().from(schema.foldersTable).where(
                and(eq(schema.foldersTable.parent_id, parentId), isNull(schema.foldersTable.deleted_at))
            );
            return folders.filter(f => f.user_id === userId);
        } catch (error) {
            logger.error({ err: error, parentId, userId }, 'FolderRepository.getChildrensByParentId failed');
            throw error;
        }
    }

    async create(data: { name: string; user_id: string; parent_id?: string | null }) {
        try {
            const result = await this.db.insert(schema.foldersTable).values(data).returning();
            return result[0];
        } catch (error) {
            logger.error({ err: error, folderName: data.name, userId: data.user_id }, 'FolderRepository.create failed');
            throw error;
        }
    }

    async softDelete(id: string) {
        try {
            const result = await this.db.update(schema.foldersTable)
                .set({ deleted_at: new Date() })
                .where(eq(schema.foldersTable.id, id))
                .returning();
            return result[0];
        } catch (error) {
            logger.error({ err: error, folderId: id }, 'FolderRepository.softDelete failed');
            throw error;
        }
    }

    async restore(id: string) {
        try {
            const result = await this.db.update(schema.foldersTable)
                .set({ deleted_at: null })
                .where(eq(schema.foldersTable.id, id))
                .returning();
            return result[0];
        } catch (error) {
            logger.error({ err: error, folderId: id }, 'FolderRepository.restore failed');
            throw error;
        }
    }

    async findTrashedByUser(userId: string) {
        try {
            return await this.db.select().from(schema.foldersTable).where(
                and(
                    eq(schema.foldersTable.user_id, userId),
                    isNotNull(schema.foldersTable.deleted_at)
                )
            );
        } catch (error) {
            logger.error({ err: error, userId }, 'FolderRepository.findTrashedByUser failed');
            throw error;
        }
    }

    async findTrashedById(id: string, userId: string) {
        try {
            const folders = await this.db.select().from(schema.foldersTable).where(
                and(
                    eq(schema.foldersTable.id, id),
                    eq(schema.foldersTable.user_id, userId),
                    isNotNull(schema.foldersTable.deleted_at)
                )
            );
            return folders[0] || null;
        } catch (error) {
            logger.error({ err: error, folderId: id, userId }, 'FolderRepository.findTrashedById failed');
            throw error;
        }
    }

    async rename(id: string, newName: string) {
        try {
            const result = await this.db.update(schema.foldersTable).set({ name: newName }).where(eq(schema.foldersTable.id, id)).returning();
            return result[0];
        } catch (error) {
            logger.error({ err: error, folderId: id, newName }, 'FolderRepository.rename failed');
            throw error;
        }
    }
}
