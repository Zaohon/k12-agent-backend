# K12 Agent Backend API 文档（含输入输出示例）

更新时间：2026-04-29  
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
{ "success": true, "message": "验证码发送成功" }
```
失败响应示例：
```json
{ "statusCode": 401, "message": "缺少手机号", "error": "Unauthorized" }
```

### POST `/auth/send-code`
请求示例：
```json
{ "phone": "17600000000" }
```
成功响应示例：
```json
{ "success": true, "message": "验证码发送成功" }
```

### POST `/auth/login`
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
    "orgId": null
  }
}
```
失败响应示例：
```json
{ "statusCode": 401, "message": "验证码错误", "error": "Unauthorized" }
```

### POST `/auth/register`
请求示例：
```json
{ "phone": "17600000000", "code": "123456" }
```
成功响应示例：
```json
{
  "access_token": "<JWT_TOKEN>",
  "user": {
    "id": 8,
    "username": "default",
    "phone": "17600000000",
    "role": "STUDENT"
  }
}
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
    "tokenLimit": 50000,
    "consumedToken": 1200
  }
}
```

### POST `/auth/update-password`
请求示例：
```json
{ "newPassword": "new-pass-123" }
```
成功响应示例：
```json
{ "success": true }
```

---

## 3) 智能体 Agent

### GET `/agent/my`
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
      "id": 4,
      "title": "联通性测试Agent",
      "description": "接口联通性测试",
      "model": "deepseek-v4-flash",
      "visibility": "ORG_VISIBLE",
      "approvalStatus": "PENDING",
      "enableWebSearch": true,
      "enableWebParse": true,
      "enableDeepThink": true,
      "enableFileUpload": true,
      "enableKnowledgeBase": false,
      "categories": [{ "id": 10, "agentId": 4, "categoryId": 1 }]
    }
  ]
}
```

### GET `/agent/:id`
请求示例：
```bash
curl -X GET "http://localhost:3000/agent/4" -H "Authorization: Bearer <token>"
```
成功响应示例：
```json
{
  "success": true,
  "data": {
    "id": 4,
    "title": "联通性测试Agent",
    "systemPrompt": "你是一个测试助手",
    "model": "deepseek-v4-flash",
    "enableWebSearch": true,
    "enableWebParse": true,
    "enableDeepThink": true,
    "enableFileUpload": true,
    "enableKnowledgeBase": false
  }
}
```

### POST `/agent/create`
请求示例：
```json
{
  "title": "微积分高手",
  "description": "帮助讲解微积分题",
  "systemPrompt": "你是一名数学老师",
  "welcomeMsg": "你好",
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
    "id": 9,
    "title": "微积分高手",
    "visibility": "PRIVATE",
    "approvalStatus": "APPROVED",
    "model": "deepseek-v4-flash"
  }
}
```

### POST `/agent/update/:id`
请求示例：
```json
{ "description": "更新后的简介", "enableWebParse": true }
```
发布请求示例：
```json
{ "visibility": "ORG_VISIBLE" }
```
成功响应示例：
```json
{
  "success": true,
  "data": {
    "id": 9,
    "visibility": "ORG_VISIBLE",
    "approvalStatus": "PENDING",
    "enableWebParse": true
  }
}
```
失败响应示例（越权）：
```json
{ "statusCode": 403, "message": "无权限修改该智能体", "error": "Forbidden" }
```

### GET `/agent/discover`
请求示例：
```bash
curl -X GET "http://localhost:3000/agent/discover?categoryId=1" -H "Authorization: Bearer <token>"
```
成功响应示例：
```json
{ "success": true, "data": [{ "id": 1, "title": "教案生成专家" }] }
```

### GET `/agent/featured`
请求示例：
```bash
curl -X GET "http://localhost:3000/agent/featured" -H "Authorization: Bearer <token>"
```
成功响应示例：
```json
{ "success": true, "data": [{ "id": 1, "title": "教案生成专家", "isFeatured": true }] }
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
{ "success": true, "data": [{ "id": 101, "topic": "新对话" }] }
```

### POST `/session/create`
请求示例：
```bash
curl -X POST "http://localhost:3000/session/create" -H "Authorization: Bearer <token>"
```
成功响应示例：
```json
{ "success": true, "data": { "id": 102, "topic": "新对话" } }
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
{ "prompt": "请帮我出一份初中物理教案" }
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
{ "subject": "初二数学", "topic": "一元二次方程" }
```
成功响应示例：
```text
data: {"choices":[{"delta":{"content":"以下是你的教学方案"}}]}

data: [DONE]
```
失败响应示例：
```json
{ "statusCode": 403, "message": "您的 Token 额度已耗尽，或账号状态异常。", "error": "Forbidden" }
```

---

## 6) 组织 Org

### GET `/org/list`
请求示例：
```bash
curl -X GET "http://localhost:3000/org/list" -H "Authorization: Bearer <token>"
```
成功响应示例：
```json
{ "success": true, "data": [{ "id": 1, "orgName": "北京实验学校" }] }
```

### POST `/org/create`
请求示例：
```json
{ "name": "上海示范学校" }
```
成功响应示例：
```json
{ "success": true, "data": { "id": 2, "orgName": "上海示范学校" } }
```

### POST `/org/admin`
请求示例：
```json
{ "orgId": 2, "username": "school_admin", "password": "123456" }
```
成功响应示例：
```json
{ "success": true, "data": { "id": 11, "username": "school_admin", "role": "SCHOOL_ADMIN" } }
```

### GET `/org/:orgId/users`
请求示例：
```bash
curl -X GET "http://localhost:3000/org/2/users" -H "Authorization: Bearer <token>"
```
成功响应示例：
```json
{ "success": true, "data": [{ "id": 21, "username": "stu001", "role": "STUDENT" }] }
```

### POST `/org/:orgId/users/batch`
请求示例：
```json
{
  "users": [
    { "username": "stu001", "password": "123456", "role": "学生" },
    { "username": "tea001", "password": "123456", "role": "老师" }
  ]
}
```
成功响应示例：
```json
{ "success": true, "data": { "total": 2, "created": 2, "failed": 0 } }
```

---

## 7) 审批 Approval

### GET `/approval/pending`
请求示例：
```bash
curl -X GET "http://localhost:3000/approval/pending" -H "Authorization: Bearer <token>"
```
成功响应示例：
```json
{ "success": true, "data": [{ "id": 9, "title": "微积分高手", "approvalStatus": "PENDING" }] }
```

### POST `/approval/review/:id`
请求示例（通过）：
```json
{ "status": "APPROVED", "categoryId": 1, "isFeatured": false }
```
请求示例（拒绝）：
```json
{ "status": "REJECTED" }
```
成功响应示例：
```json
{ "success": true, "data": { "id": 9, "approvalStatus": "APPROVED" } }
```

---

## 8) 分类 Category

### GET `/category/list`
请求示例：
```bash
curl -X GET "http://localhost:3000/category/list"
```
成功响应示例：
```json
{ "success": true, "data": [{ "id": 1, "name": "理科实验室" }] }
```

### POST `/category/create`
请求示例：
```json
{ "name": "AI 写作", "weight": 5 }
```
成功响应示例：
```json
{ "success": true, "data": { "id": 12, "name": "AI 写作" } }
```

### PATCH `/category/:id`
请求示例：
```json
{ "name": "AI 写作助手", "weight": 8 }
```
成功响应示例：
```json
{ "success": true, "data": { "id": 12, "name": "AI 写作助手" } }
```

### DELETE `/category/:id`
请求示例：
```bash
curl -X DELETE "http://localhost:3000/category/12" -H "Authorization: Bearer <token>"
```
成功响应示例：
```json
{ "success": true }
```

---

## 9) 我的智能体推荐调用顺序（前端）

1. `GET /agent/my`
2. `GET /category/list`
3. `POST /agent/create`
4. `GET /agent/:id`
5. `POST /agent/update/:id`
6. `POST /agent/update/:id`（发布：改 `visibility`）
7. 审核端：`GET /approval/pending` + `POST /approval/review/:id`
