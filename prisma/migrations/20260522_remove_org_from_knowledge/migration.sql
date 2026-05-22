ALTER TABLE `lq_knowledge_file`
  DROP FOREIGN KEY `lq_knowledge_file_org_id_fkey`;

ALTER TABLE `lq_knowledge_folder`
  DROP FOREIGN KEY `lq_knowledge_folder_org_id_fkey`;

DROP INDEX `idx_lq_knowledge_file_org_id` ON `lq_knowledge_file`;
DROP INDEX `idx_lq_knowledge_folder_org_id` ON `lq_knowledge_folder`;

ALTER TABLE `lq_knowledge_file`
  DROP COLUMN `org_id`;

ALTER TABLE `lq_knowledge_folder`
  DROP COLUMN `org_id`;
