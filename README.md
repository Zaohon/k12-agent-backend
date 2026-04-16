# K12 Agent Integrated Platform - Backend

> 本项目为 K12 教育智能体集成平台的后端核心，基于 NestJS 框架构建，旨在为学校、师生提供高度可控、多租户隔离的 AI 智能体服务。

## 🌟 核心功能

*   **多租户组织架构 (RBAC)**：支持超级管理员（SuperAdmin）、学校管理员（SchoolAdmin）、老师（Teacher）和学生（Student）的多级权限。
*   **智能体工厂 (Agent Studio)**：支持智能体配置的 CRUD、System Prompt 设定、动态参数表单定义。
*   **分发审批链路**：内置智能体上架审批工作流，支持校内公开与全平台公开两种可见性。
*   **AI 代理引擎**：集成阿里云 DashScope (Qwen-3.5-Plus) 流式响应接口。
*   **资源分类系统**：支持 Agent 多层分类标签与首页精选推荐功能。
*   **批量账户系统**：支持通过 Excel 快速为网点/学校批量导入师生账号。

## 🛠️ 技术栈

*   **框架**：[NestJS](https://nestjs.com/)
*   **数据库**：[MySQL](https://www.mysql.com/)
*   **ORM**：[Prisma](https://www.prisma.io/)
*   **安全**：JWT (Passport), Argon2/Bcrypt hash
*   **报表解析**：XLSX

## 🚀 快速启动

### 1. 环境准备
确保拥有 Node.js (v18+) 运行环境。

### 2. 安装依赖
```bash
npm install
```

### 3. 数据库初始化
同步 Prisma Schema 到本地 MySQL 数据库：
```bash
npx prisma db push
```

### 4. 运行开发服务器
```bash
npm run start:dev
```
服务默认运行在 `http://localhost:3000`。

## 🐳 环境变量说明
在根目录创建 `.env` 文件：
```env
DATABASE_URL="mysql://k12:k12pass@127.0.0.1:3306/k12_agent"
JWT_SECRET="k12-agent-secret"
ALIAI_KEY="sk-sp-4080f1e7e6cb4f578fa5ebfc0de8e31d"
```

## 📜 开源协议
MIT License
