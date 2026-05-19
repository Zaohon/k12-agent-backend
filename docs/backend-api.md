# K12 Agent Backend API 文档（含输入输出示例）

更新时间：2026-05-18
适用项目：`k12-agent-backend`

## 通用说明

- Base URL：`http://localhost:3000`
- 鉴权：除特殊说明外，均需 `Authorization: Bearer <token>`
- 成功返回通常为：
```json
{ "success": true, "data": {} }
```
- 错误返回通常为：
```json
{ "statusCode": 401, "message": "Unauthorized", "error": "Unauthorized" }
```

---

## 1) 健康检查

### GET `/`
请求示例：
```bash
curl -X GET "http://localhost:3000/"
```
成功响应：
```json
"Hello World!"
```

---

## 2) 认证 Auth

### POST `/auth/sms_send`
请求示例：
```json
{ "phone": "17600000000" }
```
成功响应示例：
```json
{ "success": true, "message": "验证码发送成功}
```
失败响应示例：
```json
{ "statusCode": 401, "message": "缺少手机号 "error": "Unauthorized" }
```

### POST `/auth/login`
用途：短信验证码登录（如果用户已存在则直接登录，否则自动创建学生账号）

请求示例：
```json
{ "phone": "17600000000", "code": "123456" }
```
成功响应示例：
```json
{
  "access_token": "<JWT_TOKEN>",
  "user": {
    "id": 5,
    "username": "default",
    "phone": "17600000000",
    "role": "STUDENT",
    "hasPassword": false,
    "remaining_tokens": 50000
  }
}
```
失败响应示例：
```json
{ "statusCode": 401, "message": "验证码错误 "error": "Unauthorized" }
```

### POST `/auth/password-login`
用途：账号密码登录，可使用用户名或手机号作为账号。

请求示例：
```json
{ "account": "17600000000", "password": "Pass12345" }
```
成功响应示例：
```json
{
  "access_token": "<JWT_TOKEN>",
  "user": {
    "id": 5,
    "username": "default",
    "phone": "17600000000",
    "role": "STUDENT",
    "hasPassword": true,
    "remaining_tokens": 48800
  }
}
```
失败响应示例：
```json
{ "statusCode": 401, "message": "账号或密码错误 "error": "Unauthorized" }
```

### GET `/auth/profile`
请求示例：
```bash
curl -X GET "http://localhost:3000/auth/profile" -H "Authorization: Bearer <token>"
```
成功响应示例：
```json
{
  "success": true,
  "data": {
    "id": 5,
    "username": "default",
    "phone": "17600000000",
    "role": "SUPER_ADMIN",
    "hasPassword": true,
    "tokenLimit": 50000,
    "consumedToken": 1200
  }
}
```

### POST `/auth/update-password`
用途：已登录用户修改密码，当前账号已有密码时需提供当前密码；首次设密可直接设置新密码

请求示例：
```json
{ "currentPassword": "old-pass-123", "newPassword": "new-pass-123", "confirmPassword": "new-pass-123" }
```
首次设密请求示例：
```json
{ "newPassword": "new-pass-123", "confirmPassword": "new-pass-123" }
```
成功响应示例：
```json
{ "success": true }
```

---

## 3) 智能体 Agent

说明：
- 本章节所有接口都需要 JWT。
- `visibility` 目前可取：`PRIVATE`、`ORG_VISIBLE`、`PUBLIC`。
- `approvalStatus` 目前可取：`PENDING`、`APPROVED`、`REJECTED`。
- 创建/修改时，布尔能力开关会被后端转成 `true/false`。

### GET `/agent/discover`
用途：获取当前用户在“发现页”可见的智能体列表。

规则：
- 普通用户可看到：
  - `PUBLIC + APPROVED` 的智能体
  - 本组织下 `ORG_VISIBLE + APPROVED` 的智能体
  - 自己创建的智能体
- `SUPER_ADMIN` 当前会放宽可见性过滤，返回全部智能体。
- 可选按分类过滤：`categoryId`

请求示例：
```bash
curl -X GET "http://localhost:3000/agent/discover?categoryId=1" -H "Authorization: Bearer <token>"
```

成功响应示例：
```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "title": "东西",
      "description": "测试公共智能体",
      "iconUrl": "Document",
      "systemPrompt": "你是一个测试助手",
      "welcomeMsg": "你好，我来帮你",
      "formConfig": "[{\"key\":\"topic\",\"label\":\"主题\",\"type\":\"input\",\"required\":true}]",
      "model": "deepseek-v4-flash",
      "enableWebSearch": false,
      "enableWebParse": false,
      "enableDeepThink": false,
      "enableFileUpload": false,
      "enableKnowledgeBase": false,
      "creatorId": 5,
      "orgId": 1,
      "visibility": "PUBLIC",
      "approvalStatus": "APPROVED",
      "isFeatured": false,
      "status": "ACTIVE",
      "createdAt": "2026-04-30T09:54:28.777Z",
      "updatedAt": "2026-04-30T09:55:24.956Z",
      "deletedAt": null,
      "categories": [
        {
          "id": 12,
          "agentId": 5,
          "categoryId": 1,
          "status": "ACTIVE",
          "createdAt": "2026-05-15T10:00:00.000Z",
          "updatedAt": "2026-05-15T10:00:00.000Z",
          "deletedAt": null,
          "category": {
            "id": 1,
            "name": "精选页",
            "parentId": null,
            "orgId": 1,
            "weight": 100,
            "status": "ACTIVE",
            "createdAt": "2026-05-15T10:00:00.000Z",
            "updatedAt": "2026-05-15T10:00:00.000Z",
            "deletedAt": null
          }
        }
      ]
    }
  ]
}
```

### GET `/agent/featured`
用途：获取首页精选智能体，最多返回 5 条。

规则：
- 仅返回 `isFeatured = true` 且 `approvalStatus = APPROVED` 的智能体
- 可见范围为：
  - `PUBLIC`
  - 当前用户组织下的 `ORG_VISIBLE`

请求示例：
```bash
curl -X GET "http://localhost:3000/agent/featured" -H "Authorization: Bearer <token>"
```

成功响应示例：
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "标准教案生成器",
      "isFeatured": true,
      "visibility": "PUBLIC",
      "approvalStatus": "APPROVED",
      "updatedAt": "2026-05-15T10:00:00.000Z"
    }
  ]
}
```

### GET `/agent/my`
用途：获取当前登录用户创建的智能体列表。

请求示例：
```bash
curl -X GET "http://localhost:3000/agent/my" -H "Authorization: Bearer <token>"
```

成功响应示例：
```json
{
  "success": true,
  "data": [
    {
      "id": 17,
      "title": "11231231test",
      "description": "测试组织可见智能体",
      "iconUrl": "Document",
      "systemPrompt": "你是一个测试助手",
      "welcomeMsg": null,
      "formConfig": null,
      "model": "deepseek-v4-flash",
      "enableWebSearch": false,
      "enableWebParse": false,
      "enableDeepThink": false,
      "enableFileUpload": false,
      "enableKnowledgeBase": false,
      "creatorId": 4,
      "orgId": 1,
      "visibility": "ORG_VISIBLE",
      "approvalStatus": "PENDING",
      "isFeatured": false,
      "status": "ACTIVE",
      "createdAt": "2026-05-15T09:13:51.097Z",
      "updatedAt": "2026-05-15T09:13:53.008Z",
      "deletedAt": null,
      "categories": [
        {
          "id": 18,
          "agentId": 17,
          "categoryId": 5,
          "status": "ACTIVE",
          "createdAt": "2026-05-15T09:13:51.097Z",
          "updatedAt": "2026-05-15T09:13:51.097Z",
          "deletedAt": null
        }
      ]
    }
  ]
}
```

### GET `/agent/:id`
用途：获取单个智能体详情。

说明：
- 当前实现按 `id` 直接查询，返回时包含 `categories`
- 当前接口本身没有额外做“是否有权查看该智能体”的校验

请求示例：
```bash
curl -X GET "http://localhost:3000/agent/17" -H "Authorization: Bearer <token>"
```

成功响应示例：
```json
{
  "success": true,
  "data": {
    "id": 17,
    "title": "11231231test",
    "description": "测试组织可见智能体",
    "iconUrl": "Document",
    "systemPrompt": "你是一个测试助手",
    "welcomeMsg": null,
    "formConfig": null,
    "model": "deepseek-v4-flash",
    "enableWebSearch": false,
    "enableWebParse": false,
    "enableDeepThink": false,
    "enableFileUpload": false,
    "enableKnowledgeBase": false,
    "creatorId": 4,
    "orgId": 1,
    "visibility": "ORG_VISIBLE",
    "approvalStatus": "PENDING",
    "isFeatured": false,
    "status": "ACTIVE",
    "createdAt": "2026-05-15T09:13:51.097Z",
    "updatedAt": "2026-05-15T09:13:53.008Z",
    "deletedAt": null,
    "categories": [
      {
        "id": 18,
        "agentId": 17,
        "categoryId": 5,
        "status": "ACTIVE",
        "createdAt": "2026-05-15T09:13:51.097Z",
        "updatedAt": "2026-05-15T09:13:51.097Z",
        "deletedAt": null
      }
    ]
  }
}
```

### POST `/agent/create`
用途：创建一个新的智能体。

字段说明：
- 必填：
  - `title`
  - `systemPrompt`
- 可选：
  - `description`
  - `iconUrl`
  - `welcomeMsg`
  - `formConfig`
  - `model`
  - `enableWebSearch`
  - `enableWebParse`
  - `enableDeepThink`
  - `enableFileUpload`
  - `enableKnowledgeBase`
  - `visibility`
  - `categoryId`

创建规则：
- `creatorId` 固定为当前登录用户
- `orgId` 固定取当前登录用户的 `orgId`
- 若 `visibility = PRIVATE`，则 `approvalStatus = APPROVED`
- 若 `visibility != PRIVATE`：
  - `SUPER_ADMIN` 创建后直接 `APPROVED`
  - 其他角色创建后为 `PENDING`
- 若传了 `categoryId`，会同步创建一条分类关联

请求示例：
```json
{
  "title": "微积分高手",
  "description": "帮助讲解微积分题",
  "systemPrompt": "你是一名数学老师，请循序渐进讲解微积分问题。",
  "welcomeMsg": "你好，我可以帮你拆解微积分题目。",
  "iconUrl": "Document",
  "categoryId": 1,
  "model": "deepseek-v4-flash",
  "enableWebSearch": true,
  "enableWebParse": false,
  "enableDeepThink": true,
  "enableFileUpload": true,
  "enableKnowledgeBase": false,
  "visibility": "PRIVATE"
}
```

成功响应示例：
```json
{
  "success": true,
  "data": {
    "id": 18,
    "title": "微积分高手",
    "description": "帮助讲解微积分题",
    "iconUrl": "Document",
    "systemPrompt": "你是一名数学老师，请循序渐进讲解微积分问题。",
    "welcomeMsg": "你好，我可以帮你拆解微积分题目。",
    "formConfig": null,
    "model": "deepseek-v4-flash",
    "enableWebSearch": true,
    "enableWebParse": false,
    "enableDeepThink": true,
    "enableFileUpload": true,
    "enableKnowledgeBase": false,
    "creatorId": 4,
    "orgId": 1,
    "visibility": "PRIVATE",
    "approvalStatus": "APPROVED",
    "isFeatured": false,
    "status": "ACTIVE",
    "createdAt": "2026-05-15T10:20:00.000Z",
    "updatedAt": "2026-05-15T10:20:00.000Z",
    "deletedAt": null
  }
}
```

### POST `/agent/update/:id`
用途：更新智能体内容、能力开关、可见性或分类。

字段说明：
- 可更新字段：
  - `title`
  - `description`
  - `iconUrl`
  - `systemPrompt`
  - `welcomeMsg`
  - `formConfig`
  - `model`
  - `visibility`
  - `status`
  - `enableWebSearch`
  - `enableWebParse`
  - `enableDeepThink`
  - `enableFileUpload`
  - `enableKnowledgeBase`
  - `categoryId`

更新规则：
- 仅创建者本人或 `SUPER_ADMIN` 可以修改
- 若本次将 `visibility` 更新为 `PUBLIC` 或 `ORG_VISIBLE`，后端会将 `approvalStatus` 重置为 `PENDING`
- 若本次将 `visibility` 更新为 `PRIVATE`，后端会将 `approvalStatus` 改为 `APPROVED`
- 若传了 `categoryId`，后端会先删除该智能体现有关联，再创建一条新的分类关联

请求示例：
```json
{
  "description": "更新后的简介",
  "enableWebParse": true,
  "visibility": "ORG_VISIBLE",
  "categoryId": 5
}
```

成功响应示例：
```json
{
  "success": true,
  "data": {
    "id": 18,
    "title": "微积分高手",
    "description": "更新后的简介",
    "visibility": "ORG_VISIBLE",
    "approvalStatus": "PENDING",
    "enableWebParse": true,
    "updatedAt": "2026-05-15T10:30:00.000Z"
  }
}
```

失败响应示例（无权限或不存在）：
```json
{
  "statusCode": 403,
  "message": "无权限修改该智能体",
  "error": "Forbidden"
}
```

### DELETE `/agent/:id`
用途：删除一个智能体。

删除规则：
- 仅创建者本人或 `SUPER_ADMIN` 可以删除
- 会先删除该智能体的分类关联
- 会将引用该智能体的会话 `conversation.agentId` 置空
- 最后物理删除智能体记录

请求示例：
```bash
curl -X DELETE "http://localhost:3000/agent/18" -H "Authorization: Bearer <token>"
```

成功响应示例：
```json
{
  "success": true
}
```

失败响应示例（无权限）：
```json
{
  "statusCode": 403,
  "message": "无权限删除该智能体",
  "error": "Forbidden"
}
```

失败响应示例（不存在）：
```json
{
  "statusCode": 404,
  "message": "智能体不存在",
  "error": "Not Found"
}
```

### POST `/agent/optimize`
用途：根据用户输入的提示词文本，调用后端大模型进行一键优化。

请求体：
```json
{
  "text": "你是一名数学老师，帮助学生学习代数。"
}
```

校验规则：
- `text` 必须存在
- `text` 必须是字符串
- 去除首尾空格后不能为空

成功响应示例：
```json
{
  "success": true,
  "data": {
    "optimizedText": "你是一名擅长基础教学的数学老师，请用清晰、循序渐进的方式帮助学生理解代数概念，并结合简单例题进行讲解。"
  }
}
```

失败响应示例（参数为空）：
```json
{
  "statusCode": 400,
  "message": "请输入要优化的提示词",
  "error": "Bad Request"
}
```

失败响应示例（模型调用失败）：
```json
{
  "statusCode": 400,
  "message": "大模型优化失败，请稍后重试",
  "error": "Bad Request"
}
```

---

## 4) 会话 Session

### GET `/session/list`
请求示例：
```bash
curl -X GET "http://localhost:3000/session/list" -H "Authorization: Bearer <token>"
```
成功响应示例：
```json
{ "success": true, "data": [{ "id": 101, "topic": "新对话}] }
```

### POST `/session/create`
请求示例：
```bash
curl -X POST "http://localhost:3000/session/create" -H "Authorization: Bearer <token>"
```
成功响应示例：
```json
{ "success": true, "data": { "id": 102, "topic": "新对话} }
```

### GET `/session/history/:id`
请求示例：
```bash
curl -X GET "http://localhost:3000/session/history/102" -H "Authorization: Bearer <token>"
```
成功响应示例：
```json
{
  "success": true,
  "data": [
    { "id": 1, "role": "user", "content": "你好" },
    { "id": 2, "role": "assistant", "content": "你好，请问需要什么帮助？" }
  ]
}
```

### POST `/session/chat/:id`
请求示例：
```json
{ "prompt": "请帮我出一份初中物理教案}
```
成功响应示例：
```text
data: {"choices":[{"delta":{"content":"当然可以"}}]}

data: [DONE]
```

### POST `/session/update-topic/:id`
请求示例：
```json
{ "topic": "物理教案讨论" }
```
成功响应示例：
```json
{ "success": true }
```

### DELETE `/session/:id`
请求示例：
```bash
curl -X DELETE "http://localhost:3000/session/102" -H "Authorization: Bearer <token>"
```
成功响应示例：
```json
{ "success": true }
```

---

## 5) 聊天 Chat（一次性）

### POST `/chat/stream/:agentId`
请求示例：
```json
{ "subject": "初二数学", "topic": "一元二次方案}
```
成功响应示例：
```text
data: {"choices":[{"delta":{"content":"以下是你的教学方案}}]}

data: [DONE]
```
失败响应示例：
```json
{ "statusCode": 403, "message": "您的 Token 额度已耗尽，或账号状态异 "error": "Forbidden" }
```

---

## 6) 组织 Org

### GET `/org/list`
用途：获取组织列表（仅 `SUPER_ADMIN`）。

请求示例：
```bash
curl -X GET "http://localhost:3000/org/list" -H "Authorization: Bearer <token>"
```
成功响应示例：
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "orgName": "公共网点 (默认)",
      "contactInfo": null,
      "status": "ACTIVE",
      "createdAt": "2026-04-17T02:10:32.355Z",
      "updatedAt": "2026-04-17T02:10:32.355Z",
      "deletedAt": null,
      "_count": { "users": 5, "agents": 1 },
      "users": []
    }
  ]
}
```

### POST `/org/create`
用途：创建组织（仅 `SUPER_ADMIN`）。
说明：创建成功后，会自动创建该组织保留分类 `精选页`、`推荐页`（不可删除、不可改名）。

请求示例：
```json
{ "name": "上海示范学校" }
```
成功响应示例：
```json
{
  "success": true,
  "data": {
    "id": 5,
    "orgName": "上海示范学校",
    "contactInfo": null,
    "status": "ACTIVE",
    "createdAt": "2026-05-15T06:15:42.996Z",
    "updatedAt": "2026-05-15T06:15:42.996Z",
    "deletedAt": null
  }
}
```

### POST `/org/admin`
用途：给指定组织创建组织管理员（仅 `SUPER_ADMIN`）。

请求示例：
```json
{ "orgId": 5, "username": "org_admin_5", "password": "12345678" }
```
成功响应示例：
```json
{
  "success": true,
  "data": {
    "id": 15,
    "username": "org_admin_5",
    "phone": null,
    "role": "SCHOOL_ADMIN",
    "orgId": 5,
    "status": "ACTIVE",
    "createdAt": "2026-05-15T06:15:43.209Z"
  }
}
```

### GET `/org/:orgId/users`
用途：获取组织下用户列表（仅 `SUPER_ADMIN`）。

请求示例：
```bash
curl -X GET "http://localhost:3000/org/5/users" -H "Authorization: Bearer <token>"
```
成功响应示例：
```json
{
  "success": true,
  "data": [
    {
      "id": 15,
      "username": "org_admin_5",
      "role": "SCHOOL_ADMIN",
      "createdAt": "2026-05-15T06:15:43.209Z"
    },
    {
      "id": 16,
      "username": "stu_5_1",
      "role": "STUDENT",
      "createdAt": "2026-05-15T06:15:43.338Z"
    }
  ]
}
```

### POST `/org/:orgId/users/batch`
用途：批量创建组织用户（仅 `SUPER_ADMIN`）。

请求示例：
```json
{
  "users": [
    { "username": "stu_5_1", "password": "12345678", "role": "学生" },
    { "username": "tea_5_1", "password": "12345678", "role": "老师" }
  ]
}
```
成功响应示例：
```json
{ "success": true, "data": { "count": 2 } }
```

---

## 7) 模型与接口配置 Model Config

### GET `/model-config`
用途：获取当前用户所在组织的模型与接口配置。
权限：所有已登录用户。

请求示例：
```bash
curl -X GET "http://localhost:3000/model-config" -H "Authorization: Bearer <token>"
```
成功响应示例：
```json
{
  "success": true,
  "data": {
    "id": 1,
    "orgId": 5,
    "defaultModel": "qwen3.6-plus",
    "apiBaseUrl": "https://api.xiaolongai.com/v1",
    "apiKey": "***",
    "orgMaxTokenLimit": 4096,
    "requestTimeout": 60,
    "enableContextMemory": false,
    "status": "ACTIVE",
    "createdAt": "2026-05-18T09:00:00.000Z",
    "updatedAt": "2026-05-18T09:00:00.000Z"
  }
}
```
失败响应示例（无组织）：
```json
{ "success": true, "data": null }
```

### POST `/model-config`
用途：创建或更新当前组织的模型与接口配置。
权限：仅管理员（`SUPER_ADMIN` / `SCHOOL_ADMIN`）。

请求示例：
```json
{
  "defaultModel": "qwen3.6-plus",
  "apiBaseUrl": "https://api.xiaolongai.com/v1",
  "apiKey": "sk-xxxxxxxxxxxxxxxx",
  "orgMaxTokenLimit": 8192,
  "requestTimeout": 120,
  "enableContextMemory": true
}
```
成功响应示例：
```json
{
  "success": true,
  "data": {
    "id": 1,
    "orgId": 5,
    "defaultModel": "qwen3.6-plus",
    "apiBaseUrl": "https://api.xiaolongai.com/v1",
    "apiKey": "sk-xxxxxxxxxxxxxxxx",
    "orgMaxTokenLimit": 8192,
    "requestTimeout": 120,
    "enableContextMemory": true,
    "status": "ACTIVE",
    "createdAt": "2026-05-18T09:00:00.000Z",
    "updatedAt": "2026-05-18T09:10:00.000Z"
  }
}
```
失败响应示例（非管理员）：
```json
{ "statusCode": 403, "message": "仅管理员可操作", "error": "Forbidden" }
```

---

## 8) 审批 Approval

### GET `/approval/pending`
用途：获取审批列表（按当前用户所属组织返回该组织下智能体，包含所有 `approvalStatus`）。
规则：
- `SUPER_ADMIN`：只看公共组织（或其绑定组织）下智能体；
- `SCHOOL_ADMIN`：只看当前组织下智能体；
- 其他角色无权限。

请求示例：
```bash
curl -X GET "http://localhost:3000/approval/pending" -H "Authorization: Bearer <token>"
```
成功响应示例：
```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "title": "东西",
      "approvalStatus": "APPROVED",
      "orgId": 1,
      "creator": { "username": "system_admin", "role": "SUPER_ADMIN" },
      "organization": { "orgName": "公共网点 (默认)" }
    }
  ]
}
```

### POST `/approval/review/:id`
请求示例（通过）：
```json
{ "status": "APPROVED", "categoryId": 1, "isFeatured": false }
```
请求示例（拒绝）
```json
{ "status": "REJECTED" }
```
成功响应示例：
```json
{ "success": true, "data": { "id": 9, "approvalStatus": "APPROVED" } }
```

---

## 9) 分类 Category

### GET `/category/list`
用途：获取分类列表（所有已登录用户可用）。
说明：
- `SUPER_ADMIN`：只返回公共组织（`orgId=1`）分类。
- `SCHOOL_ADMIN` / 普通用户：只返回当前组织（`orgId=当前用户orgId`）分类。

请求示例：
```bash
curl -X GET "http://localhost:3000/category/list" -H "Authorization: Bearer <token>"
```
成功响应示例：
```json
{
  "success": true,
  "data": [
    {
      "id": 26,
      "name": "精选页",
      "parentId": null,
      "orgId": 5,
      "weight": 100,
      "status": "ACTIVE",
      "createdAt": "2026-05-15T06:15:43.023Z",
      "updatedAt": "2026-05-15T06:15:43.023Z",
      "deletedAt": null
    }
  ]
}
```

### POST `/category/create`
用途：创建分类（`SUPER_ADMIN` / `SCHOOL_ADMIN`）。

请求示例：
```json
{ "name": "分类联调_1710000000", "weight": 12 }
```
成功响应示例：
```json
{
  "success": true,
  "data": {
    "id": 28,
    "name": "分类联调_1710000000",
    "parentId": null,
    "orgId": null,
    "weight": 12,
    "status": "ACTIVE",
    "createdAt": "2026-05-15T06:19:37.133Z",
    "updatedAt": "2026-05-15T06:19:37.133Z",
    "deletedAt": null
  }
}
```
失败响应示例（禁止创建保留名称）：
```json
{
  "statusCode": 403,
  "message": "“精选页/推荐页”是系统保留名称，禁止手动创建",
  "error": "Forbidden"
}
```

### PATCH `/category/:id`
用途：修改分类（`SUPER_ADMIN` / `SCHOOL_ADMIN`，且组织管理员只能改本组织分类）。

请求示例：
```json
{ "name": "分类联调_已改名", "weight": 15 }
```
成功响应示例：
```json
{
  "success": true,
  "data": {
    "id": 28,
    "name": "分类联调_已改名",
    "parentId": null,
    "orgId": null,
    "weight": 15,
    "status": "ACTIVE",
    "createdAt": "2026-05-15T06:19:37.133Z",
    "updatedAt": "2026-05-15T06:19:37.349Z",
    "deletedAt": null
  }
}
```
失败响应示例（修改组织保留分类名称）：
```json
{
  "statusCode": 403,
  "message": "“精选页/推荐页”是组织保留分类，不可改名",
  "error": "Forbidden"
}
```
失败响应示例（禁止改名为保留名称）：
```json
{
  "statusCode": 403,
  "message": "“精选页/推荐页”是系统保留名称，禁止改名为该名称",
  "error": "Forbidden"
}
```

### DELETE `/category/:id`
用途：删除分类（逻辑删除；`SUPER_ADMIN` / `SCHOOL_ADMIN`）。

请求示例：
```bash
curl -X DELETE "http://localhost:3000/category/12" -H "Authorization: Bearer <token>"
```
成功响应示例：
```json
{ "success": true }
```
失败响应示例（删除组织保留分类）：
```json
{
  "statusCode": 403,
  "message": "“精选页/推荐页”是组织保留分类，不可删除",
  "error": "Forbidden"
}
```

### GET `/category/:id/agents`
用途：获取某分类下的智能体列表。

请求示例：
```bash
curl -X GET "http://localhost:3000/category/28/agents" -H "Authorization: Bearer <token>"
```
成功响应示例：
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "标准教案生成器",
      "description": "一键生成包含三维目标与板书设计的高质量教案，适配国内教研标准。",
      "iconUrl": "Document",
      "systemPrompt": "你是一位资深高级教师与教研员……",
      "formConfig": "[{\"key\":\"subject\",\"label\":\"教学科目与学段\"}]",
      "model": "deepseek-v4-flash",
      "enableWebSearch": false,
      "enableWebParse": false,
      "enableDeepThink": false,
      "enableFileUpload": false,
      "enableKnowledgeBase": false,
      "creatorId": 1,
      "orgId": null,
      "visibility": "PUBLIC",
      "approvalStatus": "APPROVED",
      "status": "ACTIVE"
    }
  ]
}
```

### DELETE `/category/:id/agents/:agentId`
用途：从分类中移除某个智能体（逻辑删除关联）。

请求示例：
```bash
curl -X DELETE "http://localhost:3000/category/28/agents/1" -H "Authorization: Bearer <token>"
```
成功响应示例：
```json
{ "success": true }
```

### PATCH `/category/:id/agents/:agentId`
用途：更新分类-智能体关系（移动分类或更新关系状态）。

请求示例：
```json
{ "targetCategoryId": 5 }
```
或：
```json
{ "status": "ACTIVE" }
```
成功响应示例：
```json
{ "success": true }
```

### PUT `/category/:id/agents`
用途：覆盖设置某分类下的智能体列表（新增/移除关联）。

请求示例：
```json
{ "agentIds": [1, 2] }
```
成功响应示例：
```json
{ "success": true }
```

---

## 10) 我的智能体推荐调用顺序（前端）

1. `GET /agent/my`
2. `GET /category/list`
3. `POST /agent/create`
4. `GET /agent/:id`
5. `POST /agent/update/:id`
6. `POST /agent/update/:id`（发布：`visibility`
7. `DELETE /agent/:id`

---

## 11) 知识库 Knowledge

### 总体说明
当前知识库模块定位为“个人知识库”，不是组织共享网盘。

核心特点：

- 资源归当前登录用户所有，权限以 `ownerId` 为准
- 目录和文件都支持树状管理
- 首页按“文件夹卡片 + 存储容量”来组织
- 文件上传采用“前端直传 OSS + 后端落库”的顺序

推荐前端把本节按以下顺序理解和接入：

1. 先看“知识库首页调用顺序参考”，理解首页各区域怎么调接口
2. 再看下面每个接口的输入输出
3. 上传功能最后看“文件上传调用顺序参考”

### 知识库首页调用顺序参考
参考当前页面设计，知识库首页可以拆成以下几个区域：

- “我的文件夹”卡片区
- “新建文件夹”按钮
- “上传文件”按钮
- “存储容量”统计卡片

推荐按下面的顺序组织接口调用。

1. 页面初始化
   首页默认展示根目录内容，因此优先调用 `GET /knowledge/entries`
   - 根目录场景：`parentId` 不传
   - 返回值中的 `folders` 用于渲染“我的文件夹”卡片区
   - 返回值中的 `files` 如果首页不直接展示，可先忽略

2. 首页同时加载存储容量
   调用 `GET /knowledge/storage/stats`
   - 返回结果用于渲染右下角“存储容量”卡片
   - 可直接使用 `usedBytes`、`totalBytes`、`usageRate`

3. 点击文件夹卡片
   用户点击“教案 / 课件 / 卷库 / 题库”这类文件夹卡片后：
   - 记录当前文件夹 id 作为 `currentFolderId`
   - 调用 `GET /knowledge/entries?parentId={folderId}`
   - 页面切换到该文件夹详情视图

4. 新建文件夹
   点击“新建文件夹”按钮后，调用 `POST /knowledge/folders`
   - 在首页根目录创建：`parentId = null`
   - 在某个文件夹下创建：`parentId = currentFolderId`
   - 创建成功后，重新调用当前目录的 `GET /knowledge/entries`

5. 上传文件
   点击“上传文件”按钮后，调用顺序如下：
   - `POST /knowledge/files/upload-policy`
   - 浏览器直传 OSS
   - `POST /knowledge/files`
   - 成功后刷新当前目录的 `GET /knowledge/entries`
   - 如存储容量卡片需要立即更新，再补调一次 `GET /knowledge/storage/stats`

6. 文件夹卡片右上角更多操作
   如果卡片右上角三点菜单支持“重命名 / 移动 / 删除”：
   - 重命名 / 移动：调用 `PATCH /knowledge/folders/:id`
   - 删除：调用 `DELETE /knowledge/folders/:id`
   - 成功后刷新当前目录的 `GET /knowledge/entries`

7. 文件操作
   如果页面里支持下载、重命名、移动、删除：
   - 查看详情：`GET /knowledge/files/:id`
   - 重命名 / 移动：`PATCH /knowledge/files/:id`
   - 删除：`DELETE /knowledge/files/:id`
   - 批量移动：`POST /knowledge/files/batch-move`
   - 批量删除：`POST /knowledge/files/batch-delete`
   - 成功后建议刷新：
     - 当前目录的 `GET /knowledge/entries`
     - `GET /knowledge/storage/stats`

说明：

- 对于当前这版页面，`GET /knowledge/entries` 是首页和目录页的主接口
- “我的文件夹”区域主要消费 `entries.folders`
- “存储容量”卡片主要消费 `GET /knowledge/storage/stats`
- 上传、重命名、移动、删除成功后，建议把“当前目录、容量统计”作为一组联动刷新

### GET `/knowledge/system/agent-logos`
请求示例：
```bash
curl -X GET "http://localhost:3000/knowledge/system/agent-logos" -H "Authorization: Bearer <token>"
```
成功响应示例：
```json
{
  "success": true,
  "data": [
    "book-icon.png",
    "computer-icon.png",
    "file-icon.png"
  ]
}
```

### GET `/knowledge/folders`
请求示例：
```bash
curl -X GET "http://localhost:3000/knowledge/folders?parentId=0" -H "Authorization: Bearer <token>"
```
成功响应示例：
```json
{
  "success": true,
  "data": [
    {
      "id": 11,
      "name": "教案素材",
      "parentId": null,
      "ownerId": 5,
      "orgId": 1,
      "status": "ACTIVE",
      "createdAt": "2026-05-13T04:00:00.000Z",
      "updatedAt": "2026-05-13T04:00:00.000Z",
      "deletedAt": null,
      "folderCount": 3,
      "fileCount": 12
    }
  ]
}
```

### GET `/knowledge/entries`
作用：返回当前目录下的混合列表，包含子文件夹和文件。

请求示例：
```bash
curl -X GET "http://localhost:3000/knowledge/entries?parentId=20" -H "Authorization: Bearer <token>"
```

成功响应示例：
```json
{
  "success": true,
  "data": {
    "parentId": 20,
    "folders": [
      {
        "id": 21,
        "name": "单元教案",
        "parentId": 20,
        "ownerId": 5,
        "orgId": 1,
        "status": "ACTIVE",
        "createdAt": "2026-05-13T05:05:00.000Z",
        "updatedAt": "2026-05-13T05:05:00.000Z",
        "deletedAt": null,
        "folderCount": 1,
        "fileCount": 4
      }
    ],
    "files": [
      {
        "id": 101,
        "folderId": 20,
        "ownerId": 5,
        "orgId": 1,
        "name": "高一物理教案.pdf",
        "ext": "pdf",
        "mimeType": "application/pdf",
        "size": 234567,
        "ossKey": "knowledge/5/2026/05/uuid-高一物理教案.pdf",
        "url": "https://lqwlcloud.oss-cn-shanghai.aliyuncs.com/knowledge/5/2026/05/uuid-高一物理教案.pdf",
        "status": "UPLOADED",
        "parseStatus": "PENDING",
        "createdAt": "2026-05-13T05:20:00.000Z",
        "updatedAt": "2026-05-13T05:20:00.000Z",
        "deletedAt": null
      }
    ]
  }
}
```



### GET `/knowledge/folders/:id`
请求示例：
```bash
curl -X GET "http://localhost:3000/knowledge/folders/11" -H "Authorization: Bearer <token>"
```
成功响应示例：
```json
{
  "success": true,
  "data": {
    "id": 11,
    "name": "教案素材",
    "parentId": null,
    "ownerId": 5,
    "orgId": 1,
    "status": "ACTIVE",
    "createdAt": "2026-05-13T04:00:00.000Z",
    "updatedAt": "2026-05-13T04:00:00.000Z",
    "deletedAt": null,
    "parent": null,
    "folderCount": 3,
    "fileCount": 12
  }
}
```

### POST `/knowledge/folders`
请求示例：
```json
{
  "name": "课程资料",
  "parentId": null
}
```
成功响应示例：
```json
{
  "success": true,
  "data": {
    "id": 20,
    "name": "课程资料",
    "parentId": null,
    "ownerId": 5,
    "orgId": 1,
    "status": "ACTIVE",
    "createdAt": "2026-05-13T05:00:00.000Z",
    "updatedAt": "2026-05-13T05:00:00.000Z",
    "deletedAt": null
  }
}
```

### PATCH `/knowledge/folders/:id`
请求示例：
```json
{
  "name": "更新后的文件夹名",
  "parentId": 11
}
```
成功响应示例：
```json
{
  "success": true,
  "data": {
    "id": 20,
    "name": "更新后的文件夹名",
    "parentId": null,
    "ownerId": 5,
    "orgId": 1,
    "status": "ACTIVE",
    "createdAt": "2026-05-13T05:00:00.000Z",
    "updatedAt": "2026-05-13T05:10:00.000Z",
    "deletedAt": null
  }
}
```
说明：
- `name` 可选，用于重命名
- `parentId` 可选，用于移动文件夹到新的父目录
- `parentId = null` 表示移动到根目录
- 不允许把文件夹移动到自己或自己的子孙目录下

### DELETE `/knowledge/folders/:id`
请求示例：
```bash
curl -X DELETE "http://localhost:3000/knowledge/folders/20" -H "Authorization: Bearer <token>"
```
成功响应示例：
```json
{ "success": true }
```
失败响应示例（存在子文件夹或文件）：
```json
{
  "statusCode": 400,
  "message": "Folder is not empty",
  "error": "Bad Request"
}
```

### GET `/knowledge/files`
请求示例：
```bash
curl -X GET "http://localhost:3000/knowledge/files?folderId=20" -H "Authorization: Bearer <token>"
```
成功响应示例：
```json
{
  "success": true,
  "data": [
    {
      "id": 101,
      "folderId": 20,
      "ownerId": 5,
      "orgId": 1,
      "name": "高一物理教案.pdf",
      "ext": "pdf",
      "mimeType": "application/pdf",
      "size": 234567,
      "ossKey": "knowledge/5/2026/05/uuid-高一物理教案.pdf",
      "url": "https://lqwlcloud.oss-cn-shanghai.aliyuncs.com/knowledge/5/2026/05/uuid-高一物理教案.pdf",
      "status": "UPLOADED",
      "parseStatus": "PENDING",
      "createdAt": "2026-05-13T05:20:00.000Z",
      "updatedAt": "2026-05-13T05:20:00.000Z",
      "deletedAt": null
    }
  ]
}
```

### GET `/knowledge/files/:id`
请求示例：
```bash
curl -X GET "http://localhost:3000/knowledge/files/101" -H "Authorization: Bearer <token>"
```
成功响应示例：
```json
{
  "success": true,
  "data": {
    "id": 101,
    "folderId": 20,
    "ownerId": 5,
    "orgId": 1,
    "name": "高一物理教案.pdf",
    "ext": "pdf",
    "mimeType": "application/pdf",
    "size": 234567,
    "ossKey": "knowledge/5/2026/05/uuid-高一物理教案.pdf",
    "url": "https://lqwlcloud.oss-cn-shanghai.aliyuncs.com/knowledge/5/2026/05/uuid-高一物理教案.pdf",
    "status": "UPLOADED",
    "parseStatus": "PENDING",
    "createdAt": "2026-05-13T05:20:00.000Z",
    "updatedAt": "2026-05-13T05:20:00.000Z",
    "deletedAt": null,
    "folder": {
      "id": 20,
      "name": "课程资料"
    }
  }
}
```

### PATCH `/knowledge/files/:id`
请求示例：
```json
{
  "name": "高一物理教案-整理版.pdf",
  "folderId": 21
}
```

成功响应示例：
```json
{
  "success": true,
  "data": {
    "id": 101,
    "folderId": 21,
    "ownerId": 5,
    "orgId": 1,
    "name": "高一物理教案-整理版.pdf",
    "ext": "pdf",
    "mimeType": "application/pdf",
    "size": 234567,
    "ossKey": "knowledge/5/2026/05/uuid-高一物理教案.pdf",
    "url": "https://lqwlcloud.oss-cn-shanghai.aliyuncs.com/knowledge/5/2026/05/uuid-高一物理教案.pdf",
    "status": "UPLOADED",
    "parseStatus": "PENDING",
    "createdAt": "2026-05-13T05:20:00.000Z",
    "updatedAt": "2026-05-13T05:40:00.000Z",
    "deletedAt": null
  }
}
```
说明：
- `name` 可选，用于重命名文件
- `folderId` 可选，用于移动文件到新的目录
- `folderId = null` 表示移动到根目录

### POST `/knowledge/files/upload-policy`
请求示例：
```json
{
  "fileName": "lesson-plan.docx",
  "contentType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "folderId": 20
}
```
成功响应示例：
```json
{
  "success": true,
  "data": {
    "key": "knowledge/5/2026/05/uuid-lesson-plan.docx",
    "uploadUrl": "https://lqwlcloud.oss-cn-shanghai.aliyuncs.com/knowledge/5/2026/05/uuid-lesson-plan.docx?Signature=...",
    "publicUrl": "https://lqwlcloud.oss-cn-shanghai.aliyuncs.com/knowledge/5/2026/05/uuid-lesson-plan.docx",
    "expiresInSeconds": 600
  }
}
```

### POST `/knowledge/files`
请求示例：
```json
{
  "folderId": 20,
  "name": "lesson-plan.docx",
  "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "size": 123456,
  "ossKey": "knowledge/5/2026/05/uuid-lesson-plan.docx",
  "url": "https://lqwlcloud.oss-cn-shanghai.aliyuncs.com/knowledge/5/2026/05/uuid-lesson-plan.docx"
}
```
成功响应示例：
```json
{
  "success": true,
  "data": {
    "id": 102,
    "folderId": 20,
    "ownerId": 5,
    "orgId": 1,
    "name": "lesson-plan.docx",
    "ext": "docx",
    "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "size": 123456,
    "ossKey": "knowledge/5/2026/05/uuid-lesson-plan.docx",
    "url": "https://lqwlcloud.oss-cn-shanghai.aliyuncs.com/knowledge/5/2026/05/uuid-lesson-plan.docx",
    "status": "UPLOADED",
    "parseStatus": "PENDING",
    "createdAt": "2026-05-13T05:30:00.000Z",
    "updatedAt": "2026-05-13T05:30:00.000Z",
    "deletedAt": null
  }
}
```

### 文件上传调用顺序参考
知识库文件上传采用“前端直传 OSS + 后端落库”的两段式流程：

1. 调用 `POST /knowledge/files/upload-policy` 获取上传地址和对象 key
2. 前端直接 `PUT` 文件到返回的 `uploadUrl`
3. 上传成功后，调用 `POST /knowledge/files` 创建业务文件记录
4. 前端刷新当前目录的 `GET /knowledge/entries` 或 `GET /knowledge/files`

说明：
- 文件内容不经过业务后端，浏览器直接上传到 OSS
- 后端只负责签发上传地址、校验权限、保存文件元数据
- 如果第 2 步上传成功但第 3 步未执行，会产生“OSS 已有文件但业务库无记录”的孤儿对象，建议前端在上传成功后立即调用落库接口

### POST `/knowledge/files/batch-move`
请求示例：
```json
{
  "fileIds": [101, 102, 103],
  "targetFolderId": 21
}
```

成功响应示例：
```json
{
  "success": true,
  "data": {
    "movedCount": 3,
    "targetFolderId": 21
  }
}
```
说明：
- `targetFolderId = null` 表示批量移动到根目录

### POST `/knowledge/files/batch-delete`
请求示例：
```json
{
  "fileIds": [101, 102, 103]
}
```

成功响应示例：
```json
{
  "success": true,
  "data": {
    "deletedCount": 3
  }
}
```

### DELETE `/knowledge/files/:id`
请求示例：
```bash
curl -X DELETE "http://localhost:3000/knowledge/files/102" -H "Authorization: Bearer <token>"
```
成功响应示例：
```json
{ "success": true }
```

### GET `/knowledge/storage/stats`
请求示例：
```bash
curl -X GET "http://localhost:3000/knowledge/storage/stats" -H "Authorization: Bearer <token>"
```
成功响应示例：
```json
{
  "success": true,
  "data": {
    "folderCount": 5,
    "fileCount": 28,
    "usedBytes": 12345678,
    "totalBytes": 1073741824,
    "usageRate": 0.0115
  }
}
```

7. 审核端：`GET /approval/pending` + `POST /approval/review/:id`

---

## 12) 枚举定义（约定）

### 用户身份（role）
- `SUPER_ADMIN`：超级管理员（系统级）
- `SCHOOL_ADMIN`：组织管理员
- `TEACHER`：老师
- `STUDENT`：学生
- `PARENT`：家长

### 身份映射关系（批量导入时）
- `学生` -> `STUDENT`
- `老师` -> `TEACHER`
- `家长` -> `PARENT`
- `管理员` -> `SCHOOL_ADMIN`
- 未匹配值默认 -> `STUDENT`

### Agent 可见性（visibility）
- `PRIVATE`：仅自己可见
- `ORG_VISIBLE`：组织内可见
- `PUBLIC`：全平台可见（需审批逻辑）

### Agent 审批状态（approvalStatus）
- `PENDING`：待审批
- `APPROVED`：已通过
- `REJECTED`：已拒绝

### 通用状态（status，多个表共用）
- `ACTIVE`：有效
- `DELETED`：逻辑删除（常配合 `deletedAt`）
