# K12 Backend API 参考（认证模块）

本文档仅整理当前已落地并联调通过的手机号验证码登录接口。

## 基础信息
- Base URL: `http://<host>:3000`
- 接口前缀: `/auth`
- 鉴权方式: 登录后使用 `Authorization: Bearer <access_token>`

## 1. 发送短信验证码
### 接口
- 方法: `POST`
- 路径: `/auth/sms_send`

### 请求体
```json
{
  "phone": "17689275337"
}
```

### 成功响应
```json
{
  "success": true,
  "message": "验证码已发送",
  "expireInSeconds": 300,
  "debug_code": "200011"
}
```

说明:
- `expireInSeconds` 当前为 `300` 秒（5分钟）。
- `debug_code` 仅非生产环境返回，用于联调；生产环境不会返回该字段。

### 常见失败响应
```json
{
  "message": "短信发送失败: 该账号下找不到对应签名",
  "error": "Bad Request",
  "statusCode": 400
}
```

```json
{
  "message": "短信发送失败: 触发号码天级流控Permits:40",
  "error": "Bad Request",
  "statusCode": 400
}
```

## 2. 手机号验证码登录
### 接口
- 方法: `POST`
- 路径: `/auth/login`

### 请求体
```json
{
  "phone": "17689275337",
  "code": "200011"
}
```

### 成功响应
```json
{
  "access_token": "<jwt>",
  "user": {
    "id": 5,
    "username": "default",
    "phone": "17689275337",
    "role": "STUDENT",
    "remaining_tokens": 50000
  }
}
```

### 登录逻辑说明
- 仅校验 `phone + code`。
- 若手机号不存在用户，则自动创建新用户：
  - `username`: `default`（冲突时自动追加后缀）
  - `role`: `STUDENT`
  - 组织默认挂载到 `公共网点 (默认)`。

### 常见失败响应
```json
{
  "message": "验证码不存在或已过期",
  "error": "Unauthorized",
  "statusCode": 401
}
```

```json
{
  "message": "验证码错误",
  "error": "Unauthorized",
  "statusCode": 401
}
```

## 3. 环境变量（短信）
```env
ALI_SMS_ACCESS_KEY_ID="<AccessKeyId>"
ALI_SMS_ACCESS_KEY_SECRET="<AccessKeySecret>"
ALI_SMS_TEMPLATE_CODE="SMS_333795352"
ALI_SMS_SIGN_NAME="龙起未来"
```

## 4. 调用示例（curl）
### 发送验证码
```bash
curl -X POST http://localhost:3000/auth/sms_send \
  -H "Content-Type: application/json" \
  -d '{"phone":"17689275337"}'
```

### 登录
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"17689275337","code":"200011"}'
```