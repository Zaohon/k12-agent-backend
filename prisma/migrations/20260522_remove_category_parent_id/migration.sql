ALTER TABLE `lq_category`
  DROP INDEX `idx_lq_category_parent_id`,
  DROP COLUMN `parent_id`;
