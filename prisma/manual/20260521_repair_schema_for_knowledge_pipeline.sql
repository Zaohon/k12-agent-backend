SET @db_name = DATABASE();

SET @stmt = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'lq_agent'
      AND COLUMN_NAME = 'model'
  ),
  'SELECT 1',
  "ALTER TABLE `lq_agent`
    ADD COLUMN `model` VARCHAR(100) NOT NULL DEFAULT 'deepseek-v4-flash' AFTER `form_config`"
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @stmt = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'lq_agent'
      AND COLUMN_NAME = 'enable_web_search'
  ),
  'SELECT 1',
  "ALTER TABLE `lq_agent`
    ADD COLUMN `enable_web_search` BOOLEAN NOT NULL DEFAULT false AFTER `model`"
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @stmt = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'lq_agent'
      AND COLUMN_NAME = 'enable_web_parse'
  ),
  'SELECT 1',
  "ALTER TABLE `lq_agent`
    ADD COLUMN `enable_web_parse` BOOLEAN NOT NULL DEFAULT false AFTER `enable_web_search`"
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @stmt = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'lq_agent'
      AND COLUMN_NAME = 'enable_deep_think'
  ),
  'SELECT 1',
  "ALTER TABLE `lq_agent`
    ADD COLUMN `enable_deep_think` BOOLEAN NOT NULL DEFAULT false AFTER `enable_web_parse`"
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @stmt = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'lq_agent'
      AND COLUMN_NAME = 'enable_file_upload'
  ),
  'SELECT 1',
  "ALTER TABLE `lq_agent`
    ADD COLUMN `enable_file_upload` BOOLEAN NOT NULL DEFAULT false AFTER `enable_deep_think`"
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @stmt = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'lq_agent'
      AND COLUMN_NAME = 'enable_knowledge_base'
  ),
  'SELECT 1',
  "ALTER TABLE `lq_agent`
    ADD COLUMN `enable_knowledge_base` BOOLEAN NOT NULL DEFAULT false AFTER `enable_file_upload`"
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @stmt = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'lq_agent'
      AND INDEX_NAME = 'idx_lq_agent_model'
  ),
  'SELECT 1',
  "CREATE INDEX `idx_lq_agent_model` ON `lq_agent`(`model`)"
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @stmt = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'lq_knowledge_file'
      AND COLUMN_NAME = 'parsed_text'
  ),
  'SELECT 1',
  "ALTER TABLE `lq_knowledge_file`
    ADD COLUMN `parsed_text` LONGTEXT NULL AFTER `parse_status`"
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @stmt = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'lq_knowledge_file'
      AND COLUMN_NAME = 'parsed_at'
  ),
  'SELECT 1',
  "ALTER TABLE `lq_knowledge_file`
    ADD COLUMN `parsed_at` DATETIME(3) NULL AFTER `parsed_text`"
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @stmt = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'lq_knowledge_file'
      AND COLUMN_NAME = 'parse_error'
  ),
  'SELECT 1',
  "ALTER TABLE `lq_knowledge_file`
    ADD COLUMN `parse_error` VARCHAR(1000) NULL AFTER `parsed_at`"
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
