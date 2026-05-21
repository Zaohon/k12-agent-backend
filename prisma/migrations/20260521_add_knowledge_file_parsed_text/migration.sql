ALTER TABLE `lq_knowledge_file`
  ADD COLUMN `parsed_text` LONGTEXT NULL,
  ADD COLUMN `parsed_at` DATETIME(3) NULL,
  ADD COLUMN `parse_error` VARCHAR(1000) NULL;
