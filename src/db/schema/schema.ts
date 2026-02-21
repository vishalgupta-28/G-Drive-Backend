import { pgTable, uuid, varchar, text, timestamp, bigint, pgEnum, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const uploadStatusEnum = pgEnum('upload_status', ['pending', 'completed', 'failed']);
export const fileTypeEnum = pgEnum('file_type', ['pdf', 'txt', 'doc', 'jpg', 'png', 'mp3', 'mp4', 'other']);

export const usersTable = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    profile_image: varchar('profile_image', { length: 512 }),
    quota: bigint('quota', { mode: 'number' }).notNull().default(10737418240), // Default 10GB
});

export const blobsTable = pgTable('blobs', {
    id: uuid('id').defaultRandom().primaryKey(),
    s3_key: varchar('s3_key', { length: 255 }).notNull().unique(),
    size: bigint('size', { mode: 'number' }).notNull(),
    has_thumbnail: boolean('has_thumbnail').default(false).notNull(),
});

export const uploadsTable = pgTable('uploads', {
    id: uuid('id').defaultRandom().primaryKey(),
    user_id: uuid('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
    presign_url: text('presign_url').notNull(),
    expiry: bigint('expiry', { mode: 'number' }).notNull(), // Epoch timestamp in ms
    status: uploadStatusEnum('status').default('pending').notNull(),
    created_at: timestamp('created_at').defaultNow().notNull(),
});

export const foldersTable = pgTable('folders', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    user_id: uuid('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
    parent_id: uuid('parent_id'), // Self-referencing foreign key setup later in relations
    created_at: timestamp('created_at').defaultNow().notNull(),
    deleted_at: timestamp('deleted_at'),
});

export const filesTable = pgTable('files', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    blob_id: uuid('blob_id').notNull().references(() => blobsTable.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
    folder_id: uuid('folder_id').references(() => foldersTable.id, { onDelete: 'cascade' }),
    size: bigint('size', { mode: 'number' }).notNull(),
    type: fileTypeEnum('type').notNull(),
    created_at: timestamp('created_at').defaultNow().notNull(),
    deleted_at: timestamp('deleted_at'),
});

export const fileShareTable = pgTable('file_share', {
    id: uuid('id').defaultRandom().primaryKey(),
    user_id: uuid('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
    file_id: uuid('file_id').notNull().references(() => filesTable.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 255 }).notNull().unique(),
    expiry: bigint('expiry', { mode: 'number' }).notNull(), // Epoch timestamp in ms
    created_at: timestamp('created_at').defaultNow().notNull(),
});

// Relationships
export const usersRelations = relations(usersTable, ({ many }) => ({
    files: many(filesTable),
    folders: many(foldersTable),
    uploads: many(uploadsTable),
    fileShares: many(fileShareTable),
}));

export const blobsRelations = relations(blobsTable, ({ many }) => ({
    files: many(filesTable),
}));

export const uploadsRelations = relations(uploadsTable, ({ one }) => ({
    user: one(usersTable, {
        fields: [uploadsTable.user_id],
        references: [usersTable.id],
    }),
}));

export const foldersRelations = relations(foldersTable, ({ one, many }) => ({
    user: one(usersTable, {
        fields: [foldersTable.user_id],
        references: [usersTable.id],
    }),
    parent: one(foldersTable, {
        fields: [foldersTable.parent_id],
        references: [foldersTable.id],
    }),
    children: many(foldersTable),
    files: many(filesTable),
}));

export const filesRelations = relations(filesTable, ({ one, many }) => ({
    user: one(usersTable, {
        fields: [filesTable.user_id],
        references: [usersTable.id],
    }),
    blob: one(blobsTable, {
        fields: [filesTable.blob_id],
        references: [blobsTable.id],
    }),
    folder: one(foldersTable, {
        fields: [filesTable.folder_id],
        references: [foldersTable.id],
    }),
    shares: many(fileShareTable),
}));

export const fileSharesRelations = relations(fileShareTable, ({ one }) => ({
    user: one(usersTable, {
        fields: [fileShareTable.user_id],
        references: [usersTable.id],
    }),
    file: one(filesTable, {
        fields: [fileShareTable.file_id],
        references: [filesTable.id],
    }),
}));
