ALTER TABLE `lq_category`
  ADD COLUMN `org_id` INTEGER NULL AFTER `parent_id`;

CREATE INDEX `idx_lq_category_org_id` ON `lq_category`(`org_id`);

ALTER TABLE `lq_category`
  ADD CONSTRAINT `lq_category_org_id_fkey`
  FOREIGN KEY (`org_id`) REFERENCES `lq_organization`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
