# LQ 数据库设计说明

## 1. 设计规范落地结果
- 所有表均使用 `lq_` 前缀。
- 字符集统一为 `utf8mb4`，排序规则为 `utf8mb4_unicode_ci`。
- 存储引擎统一为 `InnoDB`。
- 每张表均使用 `id` 作为主键。
- 统一保留 `created_at`、`updated_at`；同时引入 `deleted_at` 用于逻辑删除。
- 常用筛选/排序字段（`status`、`created_at`、`updated_at`、外键字段）均已建索引。
- 唯一性字段已建唯一索引（如 `org_name`、`username`、应用分类关联唯一约束）。
- 当前无金额字段；后续若新增金额字段，统一使用 `DECIMAL(p,s)`。

## 2. 建表 SQL
完整 SQL 文件：`prisma/lq_schema.sql`

## 3. 表结构说明

### lq_organization（组织表）
- 主键：`id`
- 关键字段：`org_name`(唯一), `contact_info`, `status`, `created_at`, `updated_at`, `deleted_at`
- 用途：学校/组织主体信息

### lq_user（用户表）
- 主键：`id`
- 外键：`org_id -> lq_organization.id`
- 关键字段：`username`(唯一), `password_hash`, `role`, `token_limit`, `consumed_token`, `status`, `created_at`, `updated_at`, `deleted_at`
- 用途：平台账号与权限主体

### lq_agent（智能体表）
- 主键：`id`
- 外键：`creator_id -> lq_user.id`, `org_id -> lq_organization.id`
- 关键字段：`title`, `system_prompt`(LONGTEXT), `form_config`(LONGTEXT), `visibility`, `approval_status`, `is_featured`, `status`, `created_at`, `updated_at`, `deleted_at`
- 用途：智能体配置与发布管理

### lq_category（分类表）
- 主键：`id`
- 关键字段：`name`, `parent_id`, `weight`, `status`, `created_at`, `updated_at`, `deleted_at`
- 用途：分类目录管理

### lq_agent_category（智能体分类关联表）
- 主键：`id`
- 外键：`agent_id -> lq_agent.id`, `category_id -> lq_category.id`
- 唯一约束：`(agent_id, category_id)`
- 关键字段：`status`, `created_at`, `updated_at`, `deleted_at`
- 用途：智能体与分类多对多关联

### lq_conversation（会话表）
- 主键：`id`
- 外键：`user_id -> lq_user.id`, `agent_id -> lq_agent.id`
- 关键字段：`topic`, `is_deleted`, `status`, `created_at`, `updated_at`, `deleted_at`
- 用途：用户会话元数据

### lq_message（消息表）
- 主键：`id`
- 外键：`conversation_id -> lq_conversation.id`
- 关键字段：`role`, `content`(LONGTEXT), `prompt_tokens`, `completion_tokens`, `created_at`, `updated_at`, `deleted_at`
- 用途：会话消息明细

## 4. 关键索引说明

### 唯一索引
- `uk_lq_organization_org_name`：组织名唯一。
- `uk_lq_user_username`：用户名唯一。
- `uk_lq_agent_category_agent_id_category_id`：同一智能体与分类关系不重复。

### 外键/关联查询索引
- `lq_user.org_id`（`idx_lq_user_org_id`）
- `lq_agent.creator_id`、`lq_agent.org_id`
- `lq_agent_category.agent_id`、`lq_agent_category.category_id`
- `lq_conversation.user_id`、`lq_conversation.agent_id`
- `lq_message.conversation_id`

### 状态与筛选索引
- 各核心业务表统一建立 `status` 索引。
- 会话表补充 `is_deleted` 索引，用于逻辑删除过滤。

### 排序与时间范围索引
- 各核心业务表统一建立 `created_at`、`updated_at` 索引。
- 各核心业务表建立 `deleted_at` 索引，支持逻辑删除数据管理。