-- ============================================================================
-- Blog tables (M16) — surgical DDL to create ONLY the blog schema.
--
-- Use this if you want to create the blog tables WITHOUT running
-- `prisma db push` (which would also sync the two pending nullable User
-- columns microsoftId / facebookId). Generated from prisma/schema.prisma via
-- `prisma migrate diff` — it is the exact DDL Prisma would produce.
--
-- Run ONCE on the database (the tables do not exist yet). Recommended:
--   1. Back up first:  npm run backup
--   2. Apply this file: mysql -h <host> -u <user> -p <db> < prisma/blog-tables.sql
--      (or paste into Hostinger phpMyAdmin → SQL tab)
--   3. Seed content:   npm run seed:blog
-- ============================================================================

CREATE TABLE `BlogCategory` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `accent` VARCHAR(191) NOT NULL DEFAULT '#5D3FD3',
    `description` TEXT NULL,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `isVisible` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BlogCategory_slug_key`(`slug`),
    INDEX `BlogCategory_isVisible_displayOrder_idx`(`isVisible`, `displayOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BlogTag` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BlogTag_slug_key`(`slug`),
    INDEX `BlogTag_slug_idx`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BlogPost` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `excerpt` TEXT NOT NULL,
    `body` JSON NOT NULL,
    `cover` VARCHAR(512) NULL,
    `readMinutes` INTEGER NOT NULL DEFAULT 5,
    `status` ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
    `isFeatured` BOOLEAN NOT NULL DEFAULT false,
    `publishedAt` DATETIME(3) NULL,
    `metaTitle` VARCHAR(191) NULL,
    `metaDescription` TEXT NULL,
    `authorUserId` VARCHAR(191) NULL,
    `authorName` VARCHAR(191) NOT NULL DEFAULT 'Mustapha Ukizuru',
    `authorRole` VARCHAR(191) NOT NULL DEFAULT 'IT Manager · Full-Stack Developer · CS Educator',
    `authorAvatar` VARCHAR(191) NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BlogPost_slug_key`(`slug`),
    INDEX `BlogPost_status_publishedAt_idx`(`status`, `publishedAt`),
    INDEX `BlogPost_isFeatured_publishedAt_idx`(`isFeatured`, `publishedAt`),
    INDEX `BlogPost_categoryId_idx`(`categoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BlogTagMap` (
    `postId` VARCHAR(191) NOT NULL,
    `tagId` VARCHAR(191) NOT NULL,

    INDEX `BlogTagMap_tagId_idx`(`tagId`),
    PRIMARY KEY (`postId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `BlogPost` ADD CONSTRAINT `BlogPost_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `BlogCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `BlogTagMap` ADD CONSTRAINT `BlogTagMap_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `BlogPost`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `BlogTagMap` ADD CONSTRAINT `BlogTagMap_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `BlogTag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
