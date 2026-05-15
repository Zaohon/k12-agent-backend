# 龙启云后端认证接口文档

更新时间：2026-05-12  
适用项目：`k12-agent-backend`

## 通用说明

- Base URL：`http://localhost:3000`
- 认证方式：JWT Bearer Token
- 需要登录的接口，请在请求头中传：

```http
Authorization: Bearer <access_token>
```

- JWT 解析规则见：
[jwt.strategy.ts](/c:/Users/Administrator/Desktop/龙启云/k12-agent-backend/src/auth/jwt.strategy.ts:1)

- 当前认证相关代码见：
[auth.controller.ts](/c:/Users/Administrator/Desktop/龙启云/k12-agent-backend/src/auth/auth.controller.ts:1)
[auth.service.ts](/c:/Users/Administrator/Desktop/龙启云/k12-agent-backend/src/auth/auth.service.ts:1)

## 返回结构说明

认证接口目前有两类返回：

1. 业务成功返回

```json
{
  "success": true,
  "data": {}
}
```

2. 登录成功返回

```json
{
  "access_token": "<JWT_TOKEN>",
  "user": {
    "id": 1,
    "username": "default",
    "phone": "13800138000",
    "role": "STUDENT",
    "hasPassword": false,
    "remaining_tokens": 50000
  }
}
```

3. 典型错误返回

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

实际错误 `message` 会根据场景变化。

## 1. 发送短信验证码

### `POST /auth/sms_send`

用途：发送登录验证码。

### 请求体

```json
{
  "phone": "13800138000"
}
```

### 字段说明

- `phone`：11 位大陆手机号，必填

### 成功响应示例

```json
{
  "success": true,
  "message": "验证码已发送",
  "expireInSeconds": 300,
  "debug_code": "123456"
}
```

### 说明

- 验证码有效期：5 分钟
- 发送冷却：60 秒
- 非生产环境会返回 `debug_code`
- 生产环境不会返回 `debug_code`

### 典型失败场景

- 手机号为空
- 手机号格式不合法
- 发送过于频繁
- 阿里云短信配置缺失
- 阿里云短信发送失败

### curl 示例

```bash
curl -X POST "http://localhost:3000/auth/sms_send" ^
  -H "Content-Type: application/json" ^
  -d "{\"phone\":\"13800138000\"}"
```

## 2. 验证码登录

### `POST /auth/login`

用途：使用手机号 + 验证码登录。

### 请求体

```json
{
  "phone": "13800138000",
  "code": "123456"
}
```

### 字段说明

- `phone`：11 位手机号，必填
- `code`：6 位验证码，必填

### 成功响应示例

```json
{
  "access_token": "<JWT_TOKEN>",
  "user": {
    "id": 5,
    "username": "default",
    "phone": "13800138000",
    "role": "STUDENT",
    "hasPassword": false,
    "remaining_tokens": 50000
  }
}
```

### 登录逻辑说明

- 如果手机号对应用户已存在，直接登录
- 如果手机号对应用户不存在，会自动创建账号并登录
- 自动创建账号时：
  - 默认角色：`STUDENT`
  - 默认归属组织：`公共网点 (默认)`
  - 默认没有密码，`hasPassword = false`

### 典型失败场景

- 手机号格式错误
- 验证码格式错误
- 验证码不存在
- 验证码已过期
- 验证码错误

### curl 示例

```bash
curl -X POST "http://localhost:3000/auth/login" ^
  -H "Content-Type: application/json" ^
  -d "{\"phone\":\"13800138000\",\"code\":\"123456\"}"
```

## 3. 密码登录

### `POST /auth/password-login`

用途：使用账号密码登录。

### 请求体

```json
{
  "account": "default",
  "password": "Pass123456"
}
```

### 字段说明

- `account`：用户名或手机号，必填
- `password`：密码，必填

### 成功响应示例

```json
{
  "access_token": "<JWT_TOKEN>",
  "user": {
    "id": 5,
    "username": "default",
    "phone": "13800138000",
    "role": "STUDENT",
    "hasPassword": true,
    "remaining_tokens": 48800
  }
}
```

### 登录逻辑说明

- `account` 支持两种匹配方式：
  - `username`
  - `phone`
- 仅允许登录：
  - `deletedAt = null`
  - `status = ACTIVE`
- 如果账号尚未设置密码，会提示先使用验证码登录

### 典型失败场景

- 账号为空
- 密码为空
- 账号不存在
- 密码错误
- 账号未设置密码

### curl 示例

```bash
curl -X POST "http://localhost:3000/auth/password-login" ^
  -H "Content-Type: application/json" ^
  -d "{\"account\":\"13800138000\",\"password\":\"Pass123456\"}"
```

## 4. 注册

### `POST /auth/register`

用途：验证码注册。

### 请求体

```json
{
  "phone": "13800138000",
  "code": "123456"
}
```

### 成功响应示例

```json
{
  "access_token": "<JWT_TOKEN>",
  "user": {
    "id": 5,
    "username": "default",
    "phone": "13800138000",
    "role": "STUDENT",
    "hasPassword": false,
    "remaining_tokens": 50000
  }
}
```

### 注册逻辑说明

当前实现中，`register` 本质上复用了验证码登录逻辑：

- 用户不存在：自动创建并登录
- 用户已存在：直接登录

也就是说，当前后端是“登录/注册合一”的验证码模式。

### curl 示例

```bash
curl -X POST "http://localhost:3000/auth/register" ^
  -H "Content-Type: application/json" ^
  -d "{\"phone\":\"13800138000\",\"code\":\"123456\"}"
```

## 5. 获取当前用户信息

### `GET /auth/profile`

用途：获取当前登录用户完整资料。

### 请求头

```http
Authorization: Bearer <access_token>
```

### 成功响应示例

```json
{
  "success": true,
  "data": {
    "id": 5,
    "username": "default",
    "phone": "13800138000",
    "passwordSetAt": "2026-05-12T12:00:00.000Z",
    "role": "STUDENT",
    "orgId": 1,
    "tokenLimit": 50000,
    "consumedToken": 1200,
    "status": "ACTIVE",
    "createdAt": "2026-05-12T10:00:00.000Z",
    "updatedAt": "2026-05-12T12:00:00.000Z",
    "deletedAt": null,
    "organization": {
      "id": 1,
      "orgName": "公共网点 (默认)",
      "contactInfo": null,
      "status": "ACTIVE",
      "createdAt": "2026-05-12T10:00:00.000Z",
      "updatedAt": "2026-05-12T10:00:00.000Z",
      "deletedAt": null
    },
    "hasPassword": true
  }
}
```

### 说明

- 这里返回的是完整用户资料
- `passwordHash` 不会返回
- 额外返回：
  - `hasPassword`
  - `organization`

### curl 示例

```bash
curl -X GET "http://localhost:3000/auth/profile" ^
  -H "Authorization: Bearer <JWT_TOKEN>"
```

## 6. 修改/设置密码

### `POST /auth/update-password`

用途：设置初始密码或修改已有密码。

### 请求头

```http
Authorization: Bearer <access_token>
```

### 请求体

```json
{
  "currentPassword": "OldPass123",
  "newPassword": "NewPass123456",
  "confirmPassword": "NewPass123456"
}
```

### 字段说明

- `currentPassword`：已有密码用户必填；无密码用户可不传
- `newPassword`：必填，长度 8 到 64 位
- `confirmPassword`：可传；如果传了，必须与 `newPassword` 一致

### 成功响应示例

```json
{
  "success": true
}
```

### 规则说明

1. 如果当前用户没有密码：
   - 可以直接设置新密码
   - 不要求 `currentPassword`

2. 如果当前用户已有密码：
   - 必须提供 `currentPassword`
   - 且必须校验通过

3. 新密码规则：
   - 最少 8 位
   - 最多 64 位

4. 更新成功后：
   - 写入 `passwordHash`
   - 更新 `passwordSetAt`

### 典型失败场景

- 用户状态异常
- 新密码过短
- 新密码过长
- 两次新密码不一致
- 当前密码缺失
- 当前密码错误

### curl 示例

```bash
curl -X POST "http://localhost:3000/auth/update-password" ^
  -H "Authorization: Bearer <JWT_TOKEN>" ^
  -H "Content-Type: application/json" ^
  -d "{\"currentPassword\":\"OldPass123\",\"newPassword\":\"NewPass123456\",\"confirmPassword\":\"NewPass123456\"}"
```

## 登录态说明

### Token 获取方式

以下接口成功后都会返回 `access_token`：

- `POST /auth/login`
- `POST /auth/password-login`
- `POST /auth/register`

### Token 使用方式

前端登录成功后，将 `access_token` 保存到本地，然后在后续请求中统一带：

```http
Authorization: Bearer <access_token>
```

### Token Payload

当前 JWT 中包含以下字段：

```json
{
  "username": "default",
  "phone": "13800138000",
  "sub": 5,
  "role": "STUDENT",
  "orgId": 1
}
```

服务端校验后，会把以下字段挂到 `request.user`：

```json
{
  "id": 5,
  "username": "default",
  "role": "STUDENT",
  "orgId": 1
}
```

## 推荐前端对接流程

### 验证码登录流程

1. 调 `POST /auth/sms_send`
2. 用户输入验证码
3. 调 `POST /auth/login`
4. 保存 `access_token`
5. 调 `GET /auth/profile` 获取完整资料

### 验证码注册流程

1. 调 `POST /auth/sms_send`
2. 用户输入验证码
3. 调 `POST /auth/register`
4. 保存 `access_token`
5. 调 `GET /auth/profile`

### 密码登录流程

1. 调 `POST /auth/password-login`
2. 保存 `access_token`
3. 调 `GET /auth/profile`

### 设置初始密码流程

适用于 `hasPassword = false` 的用户：

1. 用户先通过验证码登录
2. 调 `POST /auth/update-password`
3. 下次即可使用 `POST /auth/password-login`

## 当前实现边界

当前认证系统还没有这些接口：

- `POST /auth/logout`
- `POST /auth/refresh-token`
- `POST /auth/forgot-password`

目前退出登录由前端自行清理本地 token 完成。
