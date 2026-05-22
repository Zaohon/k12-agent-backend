ALTER TABLE `lq_message_attachment`
  DROP INDEX `idx_lq_message_attachment_parse_status`,
  DROP COLUMN `parsed_text`,
  DROP COLUMN `parse_status`;
