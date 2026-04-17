# Backend API 文档

适用项目：`k12-agent-backend`  
适用日期：2026-04-17

## 通用约定

- Base URL：`http://localhost:3000`
- 认证方式：`Authorization: Bearer <token>`
- 返回结构：
  - 成功：多数接口为 `{ "success": true, "data": ... }`
  - 失败：Nest 默认错误结构，含 `statusCode`、`message`、`error`

## 目录

1. 健康检查
2. 认证 Auth
3. 智能体 Agent
4. 会话 Session
5. 聊天 Chat（一次性）
6. 组织 Org
7. 审批 Approval
8. 分类 Category

---

## 1. 健康检查

### `GET /`

- 说明：服务连通性检查
- 鉴权：否
- 返回：`"Hello World!"`

---

## 2. 认证 Auth

### `POST /auth/sms_send`

- 说明：发送短信验证码
- 鉴权：否
- Body：
  - `phone: string`

### `POST /auth/send-code`

- 说明：`sms_send` 兼容别名
- 鉴权：否
- Body：
  - `phone: string`

### `POST /auth/login`

- 说明：手机号验证码登录
- 鉴权：否
- Body：
  - `phone: string`
  - `code: string`
- 返回：`access_token` + 用户信息

### `POST /auth/register`

- 说明：手机号验证码注册（当前实现复用登录逻辑）
- 鉴权：否
- Body：
  - `phone: string`
  - `code: string`

### `GET /auth/profile`

- 说明：获取当前用户信息
- 鉴权：是

### `POST /auth/update-password`

- 说明：更新当前用户密码
- 鉴权：是
- Body：
  - `newPassword: string`

---

## 3. 智能体 Agent

> 本模块接口均需 JWT

### `GET /agent/discover`

- 说明：发现页智能体列表
- Query：
  - `categoryId?: number`

### `GET /agent/featured`

- 说明：精选智能体列表

### `GET /agent/my`

- 说明：当前用户创建的智能体

### `GET /agent/:id`

- 说明：智能体详情
- Path：
  - `id: number`

### `POST /agent/create`

- 说明：创建智能体
- Body：智能体字段（标题、提示词、表单配置等）

### `POST /agent/update/:id`

- 说明：更新智能体
- Path：
  - `id: number`
- Body：待更新字段

---

## 4. 会话 Session

> 本模块接口均需 JWT

### `GET /session/list`

- 说明：获取当前用户会话列表（未删除，按更新时间倒序）

### `POST /session/create`

- 说明：创建新会话
- 默认：`topic = 新对话`

### `GET /session/history/:id`

- 说明：获取会话历史消息（按创建时间正序）
- Path：
  - `id: number`

### `POST /session/chat/:id`

- 说明：会话内发送消息（SSE 流式）
- Path：
  - `id: number`
- Body：
  - `prompt: string`
- 返回类型：`text/event-stream`
- 备注：
  - 会写入 user/assistant 消息
  - 会更新会话 `updatedAt`
  - 标题为默认值或异常时会异步自动生成 `topic`

SSE 调用示例：

```bash
curl -N -X POST "http://localhost:3000/session/chat/123" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  --data '{"prompt":"请用两句话总结如何提升课堂参与度"}'
```

### `POST /session/update-topic/:id`

- 说明：手动修改会话标题
- Path：
  - `id: number`
- Body：
  - `topic: string`
- 备注：后端会做标题清洗，空值/明显乱码回退为 `新对话`

### `DELETE /session/:id`

- 说明：删除会话（软删除）
- Path：
  - `id: number`

---

## 5. 聊天 Chat（一次性）

> 本模块接口均需 JWT

### `POST /chat/stream/:agentId`

- 说明：按智能体参数进行一次性流式生成，不落会话历史
- Path：
  - `agentId: number`
- Body：动态表单参数（按对应 agent 的 `formConfig`）
- 返回类型：`text/event-stream`

说明：

- 已下线旧接口：`POST /chat/stream-session/:sessionId`

---

## 6. 组织 Org

> 本模块接口均需 JWT

### `GET /org/list`

- 说明：组织列表（按用户权限过滤）

### `POST /org/create`

- 说明：创建组织
- Body：
  - `name: string`

### `POST /org/admin`

- 说明：创建组织管理员账号
- Body：
  - `orgId: number`
  - `username: string`
  - `password: string`

### `GET /org/:orgId/users`

- 说明：查询组织下用户
- Path：
  - `orgId: number`

### `POST /org/:orgId/users/batch`

- 说明：批量导入组织用户
- Path：
  - `orgId: number`
- Body：
  - `users: any[]`

---

## 7. 审批 Approval

> 本模块接口均需 JWT

### `GET /approval/pending`

- 说明：待审批列表

### `POST /approval/review/:id`

- 说明：审批单条智能体
- Path：
  - `id: number`
- Body：
  - `status: 'APPROVED' | 'REJECTED'`
  - `categoryId?: number`
  - `isFeatured?: boolean`

---

## 8. 分类 Category

### `GET /category/list`

- 说明：分类列表
- 鉴权：否

### `POST /category/create`

- 说明：创建分类
- 鉴权：是（且需 `SUPER_ADMIN`）

### `PATCH /category/:id`

- 说明：更新分类
- 鉴权：是（且需 `SUPER_ADMIN`）
- Path：
  - `id: number`

### `DELETE /category/:id`

- 说明：删除分类
- 鉴权：是（且需 `SUPER_ADMIN`）
- Path：
  - `id: number`

---

## 前端推荐调用顺序（会话页）

1. `GET /session/list`
2. `POST /session/create`
3. `GET /session/history/:id`
4. `POST /session/chat/:id`（SSE）
5. 流结束后刷新 `GET /session/list`
6. `DELETE /session/:id`
