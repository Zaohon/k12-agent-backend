# K12 Agent Backend API 鏂囨。锛堝惈杈撳叆杈撳嚭绀轰緥锛?

鏇存柊鏃堕棿锛?026-05-11  
閫傜敤椤圭洰锛歚k12-agent-backend`

## 閫氱敤璇存槑

- Base URL锛歚http://localhost:3000`
- 閴存潈锛氶櫎鐗规畩璇存槑澶栵紝鍧囬渶 `Authorization: Bearer <token>`
- 鎴愬姛杩斿洖閫氬父涓猴細
```json
{ "success": true, "data": {} }
```
- 閿欒杩斿洖閫氬父涓猴細
```json
{ "statusCode": 401, "message": "Unauthorized", "error": "Unauthorized" }
```

---

## 1) 鍋ュ悍妫€鏌?

### GET `/`
璇锋眰绀轰緥锛?
```bash
curl -X GET "http://localhost:3000/"
```
鎴愬姛鍝嶅簲锛?
```json
"Hello World!"
```

---

## 2) 璁よ瘉 Auth

### POST `/auth/sms_send`
璇锋眰绀轰緥锛?
```json
{ "phone": "17600000000" }
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{ "success": true, "message": "楠岃瘉鐮佸彂閫佹垚鍔? }
```
澶辫触鍝嶅簲绀轰緥锛?
```json
{ "statusCode": 401, "message": "缂哄皯鎵嬫満鍙?, "error": "Unauthorized" }
```

### POST `/auth/login`
鐢ㄩ€旓細鐭俊楠岃瘉鐮佺櫥褰曪紙濡傛灉鐢ㄦ埛宸插瓨鍦ㄥ垯鐩存帴鐧诲綍锛屽惁鍒欒嚜鍔ㄥ垱寤哄鐢熻处鍙凤級

璇锋眰绀轰緥锛?
```json
{ "phone": "17600000000", "code": "123456" }
```
鎴愬姛鍝嶅簲绀轰緥锛?
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
澶辫触鍝嶅簲绀轰緥锛?
```json
{ "statusCode": 401, "message": "楠岃瘉鐮侀敊璇?, "error": "Unauthorized" }
```

### POST `/auth/password-login`
鐢ㄩ€旓細璐﹀彿瀵嗙爜鐧诲綍锛屽彲浣跨敤鐢ㄦ埛鍚嶆垨鎵嬫満鍙蜂綔涓鸿处鍙枫€?

璇锋眰绀轰緥锛?
```json
{ "account": "17600000000", "password": "Pass12345" }
```
鎴愬姛鍝嶅簲绀轰緥锛?
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
澶辫触鍝嶅簲绀轰緥锛?
```json
{ "statusCode": 401, "message": "璐﹀彿鎴栧瘑鐮侀敊璇?, "error": "Unauthorized" }
```

### GET `/auth/profile`
璇锋眰绀轰緥锛?
```bash
curl -X GET "http://localhost:3000/auth/profile" -H "Authorization: Bearer <token>"
```
鎴愬姛鍝嶅簲绀轰緥锛?
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
鐢ㄩ€旓細宸茬櫥褰曠敤鎴蜂慨鏀瑰瘑鐮侊紝褰撳墠璐﹀彿宸叉湁瀵嗙爜鏃堕渶鎻愪緵褰撳墠瀵嗙爜锛涢娆¤瀵嗗彲鐩存帴璁剧疆鏂板瘑鐮併€?

璇锋眰绀轰緥锛?
```json
{ "currentPassword": "old-pass-123", "newPassword": "new-pass-123", "confirmPassword": "new-pass-123" }
```
棣栨璁惧瘑璇锋眰绀轰緥锛?
```json
{ "newPassword": "new-pass-123", "confirmPassword": "new-pass-123" }
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{ "success": true }
```

---

## 3) 鏅鸿兘浣?Agent

### GET `/agent/my`
璇锋眰绀轰緥锛?
```bash
curl -X GET "http://localhost:3000/agent/my" -H "Authorization: Bearer <token>"
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{
  "success": true,
  "data": [
    {
      "id": 4,
      "title": "鑱旈€氭€ф祴璇旳gent",
      "description": "鎺ュ彛鑱旈€氭€ф祴璇?,
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
璇锋眰绀轰緥锛?
```bash
curl -X GET "http://localhost:3000/agent/4" -H "Authorization: Bearer <token>"
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{
  "success": true,
  "data": {
    "id": 4,
    "title": "鑱旈€氭€ф祴璇旳gent",
    "systemPrompt": "浣犳槸涓€涓祴璇曞姪鎵?,
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
璇锋眰绀轰緥锛?
```json
{
  "title": "寰Н鍒嗛珮鎵?,
  "description": "甯姪璁茶В寰Н鍒嗛",
  "systemPrompt": "浣犳槸涓€鍚嶆暟瀛﹁€佸笀",
  "welcomeMsg": "浣犲ソ",
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
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{
  "success": true,
  "data": {
    "id": 9,
    "title": "寰Н鍒嗛珮鎵?,
    "visibility": "PRIVATE",
    "approvalStatus": "APPROVED",
    "model": "deepseek-v4-flash"
  }
}
```

### POST `/agent/update/:id`
璇锋眰绀轰緥锛?
```json
{ "description": "鏇存柊鍚庣殑绠€浠?, "enableWebParse": true }
```
鍙戝竷璇锋眰绀轰緥锛?
```json
{ "visibility": "ORG_VISIBLE" }
```
鎴愬姛鍝嶅簲绀轰緥锛?
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
澶辫触鍝嶅簲绀轰緥锛堣秺鏉冿級锛?
```json
{ "statusCode": 403, "message": "鏃犳潈闄愪慨鏀硅鏅鸿兘浣?, "error": "Forbidden" }
```

### POST `/agent/optimize`
鐢ㄩ€旓細鏍规嵁鐢ㄦ埛杈撳叆鐨勬彁绀鸿瘝鏂囨湰锛岃皟鐢ㄥ悗绔ぇ妯″瀷杩涜涓€閿紭鍖栵紝杩斿洖鏇存竻鏅般€佺畝娲佺殑鎻愮ず璇嶃€?
璇锋眰绀轰緥锛?
```json
{ "text": "浣犳槸涓€鍚嶆暟瀛﹁€佸笀锛屽府鍔╁鐢熷涔犱唬鏁? }
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{
  "success": true,
  "data": {
    "optimizedText": "浣犳槸鏁板鏁欏笀锛岄渶浠ユ竻鏅般€佺畝娲佺殑鏂瑰紡甯姪瀛︾敓鐞嗚В浠ｆ暟姒傚康銆?
  }
}
```

### GET `/agent/discover`
璇锋眰绀轰緥锛?
```bash
curl -X GET "http://localhost:3000/agent/discover?categoryId=1" -H "Authorization: Bearer <token>"
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{ "success": true, "data": [{ "id": 1, "title": "鏁欐鐢熸垚涓撳" }] }
```

### DELETE `/agent/:id`
璇锋眰绀轰緥锛?
```bash
curl -X DELETE "http://localhost:3000/agent/9" -H "Authorization: Bearer <token>"
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{ "success": true }
```
澶辫触鍝嶅簲绀轰緥锛堣秺鏉冿級锛?
```json
{ "statusCode": 403, "message": "鏃犳潈闄愬垹闄よ鏅鸿兘浣?, "error": "Forbidden" }
```

### GET `/agent/featured`
璇锋眰绀轰緥锛?
```bash
curl -X GET "http://localhost:3000/agent/featured" -H "Authorization: Bearer <token>"
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{ "success": true, "data": [{ "id": 1, "title": "鏁欐鐢熸垚涓撳", "isFeatured": true }] }
```

---

## 4) 浼氳瘽 Session

### GET `/session/list`
璇锋眰绀轰緥锛?
```bash
curl -X GET "http://localhost:3000/session/list" -H "Authorization: Bearer <token>"
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{ "success": true, "data": [{ "id": 101, "topic": "鏂板璇? }] }
```

### POST `/session/create`
璇锋眰绀轰緥锛?
```bash
curl -X POST "http://localhost:3000/session/create" -H "Authorization: Bearer <token>"
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{ "success": true, "data": { "id": 102, "topic": "鏂板璇? } }
```

### GET `/session/history/:id`
璇锋眰绀轰緥锛?
```bash
curl -X GET "http://localhost:3000/session/history/102" -H "Authorization: Bearer <token>"
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{
  "success": true,
  "data": [
    { "id": 1, "role": "user", "content": "浣犲ソ" },
    { "id": 2, "role": "assistant", "content": "浣犲ソ锛岃闂渶瑕佷粈涔堝府鍔╋紵" }
  ]
}
```

### POST `/session/chat/:id`
璇锋眰绀轰緥锛?
```json
{ "prompt": "璇峰府鎴戝嚭涓€浠藉垵涓墿鐞嗘暀妗? }
```
鎴愬姛鍝嶅簲绀轰緥锛?
```text
data: {"choices":[{"delta":{"content":"褰撶劧鍙互"}}]}

data: [DONE]
```

### POST `/session/update-topic/:id`
璇锋眰绀轰緥锛?
```json
{ "topic": "鐗╃悊鏁欐璁ㄨ" }
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{ "success": true }
```

### DELETE `/session/:id`
璇锋眰绀轰緥锛?
```bash
curl -X DELETE "http://localhost:3000/session/102" -H "Authorization: Bearer <token>"
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{ "success": true }
```

---

## 5) 鑱婂ぉ Chat锛堜竴娆℃€э級

### POST `/chat/stream/:agentId`
璇锋眰绀轰緥锛?
```json
{ "subject": "鍒濅簩鏁板", "topic": "涓€鍏冧簩娆℃柟绋? }
```
鎴愬姛鍝嶅簲绀轰緥锛?
```text
data: {"choices":[{"delta":{"content":"浠ヤ笅鏄綘鐨勬暀瀛︽柟妗?}}]}

data: [DONE]
```
澶辫触鍝嶅簲绀轰緥锛?
```json
{ "statusCode": 403, "message": "鎮ㄧ殑 Token 棰濆害宸茶€楀敖锛屾垨璐﹀彿鐘舵€佸紓甯搞€?, "error": "Forbidden" }
```

---

## 6) 缁勭粐 Org

### GET `/org/list`
璇锋眰绀轰緥锛?
```bash
curl -X GET "http://localhost:3000/org/list" -H "Authorization: Bearer <token>"
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{ "success": true, "data": [{ "id": 1, "orgName": "鍖椾含瀹為獙瀛︽牎" }] }
```

### POST `/org/create`
璇锋眰绀轰緥锛?
```json
{ "name": "涓婃捣绀鸿寖瀛︽牎" }
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{ "success": true, "data": { "id": 2, "orgName": "涓婃捣绀鸿寖瀛︽牎" } }
```

### POST `/org/admin`
璇锋眰绀轰緥锛?
```json
{ "orgId": 2, "username": "school_admin", "password": "123456" }
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{ "success": true, "data": { "id": 11, "username": "school_admin", "role": "SCHOOL_ADMIN" } }
```

### GET `/org/:orgId/users`
璇锋眰绀轰緥锛?
```bash
curl -X GET "http://localhost:3000/org/2/users" -H "Authorization: Bearer <token>"
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{ "success": true, "data": [{ "id": 21, "username": "stu001", "role": "STUDENT" }] }
```

### POST `/org/:orgId/users/batch`
璇锋眰绀轰緥锛?
```json
{
  "users": [
    { "username": "stu001", "password": "123456", "role": "瀛︾敓" },
    { "username": "tea001", "password": "123456", "role": "鑰佸笀" }
  ]
}
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{ "success": true, "data": { "total": 2, "created": 2, "failed": 0 } }
```

---

## 7) 瀹℃壒 Approval

### GET `/approval/pending`
璇锋眰绀轰緥锛?
```bash
curl -X GET "http://localhost:3000/approval/pending" -H "Authorization: Bearer <token>"
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{ "success": true, "data": [{ "id": 9, "title": "寰Н鍒嗛珮鎵?, "approvalStatus": "PENDING" }] }
```

### POST `/approval/review/:id`
璇锋眰绀轰緥锛堥€氳繃锛夛細
```json
{ "status": "APPROVED", "categoryId": 1, "isFeatured": false }
```
璇锋眰绀轰緥锛堟嫆缁濓級锛?
```json
{ "status": "REJECTED" }
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{ "success": true, "data": { "id": 9, "approvalStatus": "APPROVED" } }
```

---

## 8) 鍒嗙被 Category

### GET `/category/list`
璇锋眰绀轰緥锛?
```bash
curl -X GET "http://localhost:3000/category/list"
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{ "success": true, "data": [{ "id": 1, "name": "鐞嗙瀹為獙瀹? }] }
```

### POST `/category/create`
璇锋眰绀轰緥锛?
```json
{ "name": "AI 鍐欎綔", "weight": 5 }
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{ "success": true, "data": { "id": 12, "name": "AI 鍐欎綔" } }
```

### PATCH `/category/:id`
璇锋眰绀轰緥锛?
```json
{ "name": "AI 鍐欎綔鍔╂墜", "weight": 8 }
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{ "success": true, "data": { "id": 12, "name": "AI 鍐欎綔鍔╂墜" } }
```

### DELETE `/category/:id`
璇锋眰绀轰緥锛?
```bash
curl -X DELETE "http://localhost:3000/category/12" -H "Authorization: Bearer <token>"
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{ "success": true }
```

### GET `/category/:id/agents`
璇锋眰绀轰緥锛?
```bash
curl -X GET "http://localhost:3000/category/3/agents" -H "Authorization: Bearer <token>"
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{
  "success": true,
  "data": [
    {
      "id": 23,
      "title": "浣滄枃鎵规敼鍔╂墜",
      "description": "甯姪瀛︾敓鎻愬崌鍐欎綔鑳藉姏",
      "iconUrl": "https://lqwlcloud.oss-cn-shanghai.aliyuncs.com/system/agent-logo/book-icon.png",
      "model": "deepseek-v4-flash",
      "visibility": "PUBLIC",
      "approvalStatus": "APPROVED"
    }
  ]
}
```

### DELETE `/category/:id/agents/:agentId`
璇锋眰绀轰緥锛?
```bash
curl -X DELETE "http://localhost:3000/category/3/agents/23" -H "Authorization: Bearer <token>"
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{ "success": true }
```

### PATCH `/category/:id/agents/:agentId`
璇锋眰绀轰緥锛?
```json
{ "targetCategoryId": 5 }
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{ "success": true }
```

### PUT `/category/:id/agents`
璇锋眰绀轰緥锛?
```json
{ "agentIds": [23, 45, 67] }
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{ "success": true }
```

---

## 9) 鎴戠殑鏅鸿兘浣撴帹鑽愯皟鐢ㄩ『搴忥紙鍓嶇锛?

1. `GET /agent/my`
2. `GET /category/list`
3. `POST /agent/create`
4. `GET /agent/:id`
5. `POST /agent/update/:id`
6. `POST /agent/update/:id`锛堝彂甯冿細鏀?`visibility`锛?
7. `DELETE /agent/:id`

---

## 10) 鐭ヨ瘑搴?Knowledge

### GET `/knowledge/system/agent-logos`
璇锋眰绀轰緥锛?
```bash
curl -X GET "http://localhost:3000/knowledge/system/agent-logos" -H "Authorization: Bearer <token>"
```
鎴愬姛鍝嶅簲绀轰緥锛?
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
璇锋眰绀轰緥锛?
```bash
curl -X GET "http://localhost:3000/knowledge/folders?parentId=0&keyword=鏁欐" -H "Authorization: Bearer <token>"
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{
  "success": true,
  "data": [
    {
      "id": 11,
      "name": "鏁欐绱犳潗",
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

### GET `/knowledge/folders/:id`
璇锋眰绀轰緥锛?
```bash
curl -X GET "http://localhost:3000/knowledge/folders/11" -H "Authorization: Bearer <token>"
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{
  "success": true,
  "data": {
    "id": 11,
    "name": "鏁欐绱犳潗",
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
璇锋眰绀轰緥锛?
```json
{
  "name": "璇剧▼璧勬枡",
  "parentId": null
}
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{
  "success": true,
  "data": {
    "id": 20,
    "name": "璇剧▼璧勬枡",
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
璇锋眰绀轰緥锛?
```json
{
  "name": "鏇存柊鍚庣殑鏂囦欢澶瑰悕"
}
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{
  "success": true,
  "data": {
    "id": 20,
    "name": "鏇存柊鍚庣殑鏂囦欢澶瑰悕",
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

### DELETE `/knowledge/folders/:id`
璇锋眰绀轰緥锛?
```bash
curl -X DELETE "http://localhost:3000/knowledge/folders/20" -H "Authorization: Bearer <token>"
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{ "success": true }
```
澶辫触鍝嶅簲绀轰緥锛堝瓨鍦ㄥ瓙鏂囦欢澶规垨鏂囦欢锛夛細
```json
{
  "statusCode": 400,
  "message": "鏂囦欢澶逛笅浠嶆湁瀛愭枃浠跺す鎴栨枃浠讹紝鏆備笉鏀寔鐩存帴鍒犻櫎",
  "error": "Bad Request"
}
```

### GET `/knowledge/files`
璇锋眰绀轰緥锛?
```bash
curl -X GET "http://localhost:3000/knowledge/files?folderId=20&keyword=鏁欐" -H "Authorization: Bearer <token>"
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{
  "success": true,
  "data": [
    {
      "id": 101,
      "folderId": 20,
      "ownerId": 5,
      "orgId": 1,
      "name": "楂樹竴鐗╃悊鏁欐.pdf",
      "ext": "pdf",
      "mimeType": "application/pdf",
      "size": 234567,
      "ossKey": "knowledge/5/2026/05/uuid-楂樹竴鐗╃悊鏁欐.pdf",
      "url": "https://lqwlcloud.oss-cn-shanghai.aliyuncs.com/knowledge/5/2026/05/uuid-楂樹竴鐗╃悊鏁欐.pdf",
      "status": "UPLOADED",
      "parseStatus": "PENDING",
      "createdAt": "2026-05-13T05:20:00.000Z",
      "updatedAt": "2026-05-13T05:20:00.000Z",
      "deletedAt": null
    }
  ]
}
```

### GET `/knowledge/files/recent`
璇锋眰绀轰緥锛?
```bash
curl -X GET "http://localhost:3000/knowledge/files/recent?limit=5" -H "Authorization: Bearer <token>"
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{
  "success": true,
  "data": [
    {
      "id": 101,
      "folderId": 20,
      "ownerId": 5,
      "orgId": 1,
      "name": "楂樹竴鐗╃悊鏁欐.pdf",
      "ext": "pdf",
      "mimeType": "application/pdf",
      "size": 234567,
      "ossKey": "knowledge/5/2026/05/uuid-楂樹竴鐗╃悊鏁欐.pdf",
      "url": "https://lqwlcloud.oss-cn-shanghai.aliyuncs.com/knowledge/5/2026/05/uuid-楂樹竴鐗╃悊鏁欐.pdf",
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
璇锋眰绀轰緥锛?
```bash
curl -X GET "http://localhost:3000/knowledge/files/101" -H "Authorization: Bearer <token>"
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{
  "success": true,
  "data": {
    "id": 101,
    "folderId": 20,
    "ownerId": 5,
    "orgId": 1,
    "name": "楂樹竴鐗╃悊鏁欐.pdf",
    "ext": "pdf",
    "mimeType": "application/pdf",
    "size": 234567,
    "ossKey": "knowledge/5/2026/05/uuid-楂樹竴鐗╃悊鏁欐.pdf",
    "url": "https://lqwlcloud.oss-cn-shanghai.aliyuncs.com/knowledge/5/2026/05/uuid-楂樹竴鐗╃悊鏁欐.pdf",
    "status": "UPLOADED",
    "parseStatus": "PENDING",
    "createdAt": "2026-05-13T05:20:00.000Z",
    "updatedAt": "2026-05-13T05:20:00.000Z",
    "deletedAt": null,
    "folder": {
      "id": 20,
      "name": "璇剧▼璧勬枡"
    }
  }
}
```

### POST `/knowledge/files/upload-policy`
璇锋眰绀轰緥锛?
```json
{
  "fileName": "lesson-plan.docx",
  "contentType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "folderId": 20
}
```
鎴愬姛鍝嶅簲绀轰緥锛?
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
璇锋眰绀轰緥锛?
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
鎴愬姛鍝嶅簲绀轰緥锛?
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

### DELETE `/knowledge/files/:id`
璇锋眰绀轰緥锛?
```bash
curl -X DELETE "http://localhost:3000/knowledge/files/102" -H "Authorization: Bearer <token>"
```
鎴愬姛鍝嶅簲绀轰緥锛?
```json
{ "success": true }
```

### GET `/knowledge/storage/stats`
璇锋眰绀轰緥锛?
```bash
curl -X GET "http://localhost:3000/knowledge/storage/stats" -H "Authorization: Bearer <token>"
```
鎴愬姛鍝嶅簲绀轰緥锛?
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

7. 瀹℃牳绔細`GET /approval/pending` + `POST /approval/review/:id`
