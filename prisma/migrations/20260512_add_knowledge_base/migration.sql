-- CreateTable
CREATE TABLE `lq_knowledge_folder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `parent_id` INTEGER NULL,
    `owner_id` INTEGER NOT NULL,
    `org_id` INTEGER NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `idx_lq_knowledge_folder_parent_id`(`parent_id`),
    INDEX `idx_lq_knowledge_folder_owner_id`(`owner_id`),
    INDEX `idx_lq_knowledge_folder_org_id`(`org_id`),
    INDEX `idx_lq_knowledge_folder_status`(`status`),
    INDEX `idx_lq_knowledge_folder_created_at`(`created_at`),
    INDEX `idx_lq_knowledge_folder_updated_at`(`updated_at`),
    INDEX `idx_lq_knowledge_folder_deleted_at`(`deleted_at`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lq_knowledge_file` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `folder_id` INTEGER NULL,
    `owner_id` INTEGER NOT NULL,
    `org_id` INTEGER NULL,
    `name` VARCHAR(255) NOT NULL,
    `ext` VARCHAR(32) NULL,
    `mime_type` VARCHAR(120) NULL,
    `size` INTEGER NOT NULL DEFAULT 0,
    `oss_key` VARCHAR(500) NOT NULL,
    `url` VARCHAR(1000) NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'UPLOADED',
    `parse_status` VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `idx_lq_knowledge_file_folder_id`(`folder_id`),
    INDEX `idx_lq_knowledge_file_owner_id`(`owner_id`),
    INDEX `idx_lq_knowledge_file_org_id`(`org_id`),
    INDEX `idx_lq_knowledge_file_status`(`status`),
    INDEX `idx_lq_knowledge_file_parse_status`(`parse_status`),
    INDEX `idx_lq_knowledge_file_created_at`(`created_at`),
    INDEX `idx_lq_knowledge_file_updated_at`(`updated_at`),
    INDEX `idx_lq_knowledge_file_deleted_at`(`deleted_at`),
    INDEX `idx_lq_knowledge_file_name`(`name`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lq_knowledge_file_job` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `file_id` INTEGER NOT NULL,
    `job_type` VARCHAR(32) NOT NULL DEFAULT 'PARSE',
    `status` VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    `error_message` VARCHAR(1000) NULL,
    `started_at` DATETIME(3) NULL,
    `finished_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_lq_knowledge_file_job_file_id`(`file_id`),
    INDEX `idx_lq_knowledge_file_job_job_type`(`job_type`),
    INDEX `idx_lq_knowledge_file_job_status`(`status`),
    INDEX `idx_lq_knowledge_file_job_created_at`(`created_at`),
    INDEX `idx_lq_knowledge_file_job_updated_at`(`updated_at`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `lq_knowledge_folder` ADD CONSTRAINT `lq_knowledge_folder_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `lq_knowledge_folder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lq_knowledge_folder` ADD CONSTRAINT `lq_knowledge_folder_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `lq_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lq_knowledge_folder` ADD CONSTRAINT `lq_knowledge_folder_org_id_fkey` FOREIGN KEY (`org_id`) REFERENCES `lq_organization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lq_knowledge_file` ADD CONSTRAINT `lq_knowledge_file_folder_id_fkey` FOREIGN KEY (`folder_id`) REFERENCES `lq_knowledge_folder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lq_knowledge_file` ADD CONSTRAINT `lq_knowledge_file_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `lq_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lq_knowledge_file` ADD CONSTRAINT `lq_knowledge_file_org_id_fkey` FOREIGN KEY (`org_id`) REFERENCES `lq_organization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lq_knowledge_file_job` ADD CONSTRAINT `lq_knowledge_file_job_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `lq_knowledge_file`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
