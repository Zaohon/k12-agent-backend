SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- CreateTable
CREATE TABLE `lq_organization` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `org_name` VARCHAR(191) NOT NULL,
    `contact_info` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `uk_lq_organization_org_name`(`org_name`),
    INDEX `idx_lq_organization_status`(`status`),
    INDEX `idx_lq_organization_created_at`(`created_at`),
    INDEX `idx_lq_organization_updated_at`(`updated_at`),
    INDEX `idx_lq_organization_deleted_at`(`deleted_at`),
    PRIMARY KEY (`id`)
 ) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lq_user` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `password_hash` VARCHAR(255) NULL,
    `password_set_at` DATETIME(3) NULL,
    `role` VARCHAR(50) NOT NULL DEFAULT 'TEACHER',
    `org_id` INTEGER NULL,
    `token_limit` INTEGER NOT NULL DEFAULT 50000,
    `consumed_token` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `uk_lq_user_username`(`username`),
    UNIQUE INDEX `uk_lq_user_phone`(`phone`),
    INDEX `idx_lq_user_org_id`(`org_id`),
    INDEX `idx_lq_user_phone`(`phone`),
    INDEX `idx_lq_user_role`(`role`),
    INDEX `idx_lq_user_status`(`status`),
    INDEX `idx_lq_user_password_set_at`(`password_set_at`),
    INDEX `idx_lq_user_created_at`(`created_at`),
    INDEX `idx_lq_user_updated_at`(`updated_at`),
    INDEX `idx_lq_user_deleted_at`(`deleted_at`),
    PRIMARY KEY (`id`)
 ) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lq_agent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `icon_url` VARCHAR(500) NULL,
    `system_prompt` LONGTEXT NOT NULL,
    `welcome_msg` TEXT NULL,
    `form_config` LONGTEXT NULL,
    `model` VARCHAR(100) NOT NULL DEFAULT 'deepseek-v4-flash',
    `enable_web_search` BOOLEAN NOT NULL DEFAULT false,
    `enable_web_parse` BOOLEAN NOT NULL DEFAULT false,
    `enable_deep_think` BOOLEAN NOT NULL DEFAULT false,
    `enable_file_upload` BOOLEAN NOT NULL DEFAULT false,
    `enable_knowledge_base` BOOLEAN NOT NULL DEFAULT false,
    `creator_id` INTEGER NOT NULL,
    `org_id` INTEGER NULL,
    `visibility` VARCHAR(32) NOT NULL DEFAULT 'PRIVATE',
    `approval_status` VARCHAR(32) NOT NULL DEFAULT 'APPROVED',
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `idx_lq_agent_creator_id`(`creator_id`),
    INDEX `idx_lq_agent_org_id`(`org_id`),
    INDEX `idx_lq_agent_visibility`(`visibility`),
    INDEX `idx_lq_agent_model`(`model`),
    INDEX `idx_lq_agent_approval_status`(`approval_status`),
    INDEX `idx_lq_agent_is_featured`(`is_featured`),
    INDEX `idx_lq_agent_status`(`status`),
    INDEX `idx_lq_agent_created_at`(`created_at`),
    INDEX `idx_lq_agent_updated_at`(`updated_at`),
    INDEX `idx_lq_agent_deleted_at`(`deleted_at`),
    PRIMARY KEY (`id`)
 ) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lq_category` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `parent_id` INTEGER NULL,
    `org_id` INTEGER NULL,
    `weight` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `idx_lq_category_parent_id`(`parent_id`),
    INDEX `idx_lq_category_org_id`(`org_id`),
    INDEX `idx_lq_category_status`(`status`),
    INDEX `idx_lq_category_weight`(`weight`),
    INDEX `idx_lq_category_created_at`(`created_at`),
    INDEX `idx_lq_category_updated_at`(`updated_at`),
    INDEX `idx_lq_category_deleted_at`(`deleted_at`),
    PRIMARY KEY (`id`)
 ) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lq_agent_category` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `agent_id` INTEGER NOT NULL,
    `category_id` INTEGER NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `idx_lq_agent_category_agent_id`(`agent_id`),
    INDEX `idx_lq_agent_category_category_id`(`category_id`),
    INDEX `idx_lq_agent_category_status`(`status`),
    INDEX `idx_lq_agent_category_created_at`(`created_at`),
    INDEX `idx_lq_agent_category_updated_at`(`updated_at`),
    INDEX `idx_lq_agent_category_deleted_at`(`deleted_at`),
    UNIQUE INDEX `uk_lq_agent_category_agent_id_category_id`(`agent_id`, `category_id`),
    PRIMARY KEY (`id`)
 ) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lq_conversation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `agent_id` INTEGER NULL,
    `topic` VARCHAR(255) NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `idx_lq_conversation_user_id`(`user_id`),
    INDEX `idx_lq_conversation_agent_id`(`agent_id`),
    INDEX `idx_lq_conversation_is_deleted`(`is_deleted`),
    INDEX `idx_lq_conversation_status`(`status`),
    INDEX `idx_lq_conversation_created_at`(`created_at`),
    INDEX `idx_lq_conversation_updated_at`(`updated_at`),
    INDEX `idx_lq_conversation_deleted_at`(`deleted_at`),
    PRIMARY KEY (`id`)
 ) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lq_message` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `conversation_id` INTEGER NOT NULL,
    `role` VARCHAR(32) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `prompt_tokens` INTEGER NOT NULL DEFAULT 0,
    `completion_tokens` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `idx_lq_message_conversation_id`(`conversation_id`),
    INDEX `idx_lq_message_role`(`role`),
    INDEX `idx_lq_message_created_at`(`created_at`),
    INDEX `idx_lq_message_updated_at`(`updated_at`),
    INDEX `idx_lq_message_deleted_at`(`deleted_at`),
    PRIMARY KEY (`id`)
 ) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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
ALTER TABLE `lq_user` ADD CONSTRAINT `lq_user_org_id_fkey` FOREIGN KEY (`org_id`) REFERENCES `lq_organization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lq_agent` ADD CONSTRAINT `lq_agent_creator_id_fkey` FOREIGN KEY (`creator_id`) REFERENCES `lq_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lq_agent` ADD CONSTRAINT `lq_agent_org_id_fkey` FOREIGN KEY (`org_id`) REFERENCES `lq_organization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lq_agent_category` ADD CONSTRAINT `lq_agent_category_agent_id_fkey` FOREIGN KEY (`agent_id`) REFERENCES `lq_agent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lq_agent_category` ADD CONSTRAINT `lq_agent_category_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `lq_category`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lq_category` ADD CONSTRAINT `lq_category_org_id_fkey` FOREIGN KEY (`org_id`) REFERENCES `lq_organization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lq_conversation` ADD CONSTRAINT `lq_conversation_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `lq_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lq_conversation` ADD CONSTRAINT `lq_conversation_agent_id_fkey` FOREIGN KEY (`agent_id`) REFERENCES `lq_agent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lq_message` ADD CONSTRAINT `lq_message_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `lq_conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

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


SET FOREIGN_KEY_CHECKS = 1;
