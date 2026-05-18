-- CreateTable
CREATE TABLE `lq_model_config` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `org_id` INTEGER NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `default_model` VARCHAR(100) NOT NULL DEFAULT 'qwen3.6-plus',
    `api_base_url` VARCHAR(500) NOT NULL,
    `api_key` VARCHAR(500) NULL,
    `org_max_token_limit` INTEGER NOT NULL DEFAULT 4096,
    `request_timeout` INTEGER NOT NULL DEFAULT 60,
    `enable_context_memory` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `uk_lq_model_config_org_id_is_default`(`org_id`, `is_default`),
    INDEX `idx_lq_model_config_org_id`(`org_id`),
    INDEX `idx_lq_model_config_is_default`(`is_default`),
    INDEX `idx_lq_model_config_status`(`status`),
    INDEX `idx_lq_model_config_created_at`(`created_at`),
    INDEX `idx_lq_model_config_updated_at`(`updated_at`),
    INDEX `idx_lq_model_config_deleted_at`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `lq_model_config` ADD CONSTRAINT `lq_model_config_org_id_fkey` FOREIGN KEY (`org_id`) REFERENCES `lq_organization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
