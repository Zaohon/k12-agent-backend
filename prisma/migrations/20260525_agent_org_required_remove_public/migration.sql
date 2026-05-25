UPDATE `lq_agent`
SET `visibility` = 'ORG_VISIBLE'
WHERE `visibility` = 'PUBLIC';

UPDATE `lq_agent` AS a
JOIN `lq_user` AS u ON u.`id` = a.`creator_id`
SET a.`org_id` = u.`org_id`
WHERE a.`org_id` IS NULL
  AND u.`org_id` IS NOT NULL;

UPDATE `lq_agent`
SET `org_id` = (
  SELECT `id`
  FROM (
    SELECT `id`
    FROM `lq_organization`
    ORDER BY `id` ASC
    LIMIT 1
  ) AS first_org
)
WHERE `org_id` IS NULL;

ALTER TABLE `lq_agent` DROP FOREIGN KEY `lq_agent_org_id_fkey`;

ALTER TABLE `lq_agent`
  MODIFY `org_id` INTEGER NOT NULL;

ALTER TABLE `lq_agent`
  ADD CONSTRAINT `lq_agent_org_id_fkey`
  FOREIGN KEY (`org_id`) REFERENCES `lq_organization`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
