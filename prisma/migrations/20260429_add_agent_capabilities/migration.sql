ALTER TABLE `lq_agent`
  ADD COLUMN `model` VARCHAR(100) NOT NULL DEFAULT 'deepseek-v4-flash' AFTER `form_config`,
  ADD COLUMN `enable_web_search` BOOLEAN NOT NULL DEFAULT false AFTER `model`,
  ADD COLUMN `enable_web_parse` BOOLEAN NOT NULL DEFAULT false AFTER `enable_web_search`,
  ADD COLUMN `enable_deep_think` BOOLEAN NOT NULL DEFAULT false AFTER `enable_web_parse`,
  ADD COLUMN `enable_file_upload` BOOLEAN NOT NULL DEFAULT false AFTER `enable_deep_think`,
  ADD COLUMN `enable_knowledge_base` BOOLEAN NOT NULL DEFAULT false AFTER `enable_file_upload`;

CREATE INDEX `idx_lq_agent_model` ON `lq_agent`(`model`);
