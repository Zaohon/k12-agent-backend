ALTER TABLE `lq_user`
  MODIFY COLUMN `password_hash` VARCHAR(255) NULL,
  ADD COLUMN `password_set_at` DATETIME(3) NULL AFTER `password_hash`;

CREATE INDEX `idx_lq_user_password_set_at` ON `lq_user`(`password_set_at`);
