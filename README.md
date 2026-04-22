# Sunny Station ☀️

> **Sunny 的全能工作台** - 集成自动化工具、数据爬虫与智能服务的个人生产力中心。

---

## 🚀 核心模块

### 1. 📬 智能通知系统 (Email Service)
- **多平台支持**: 预设 QQ、163、Gmail、腾讯企业邮等多种 SMTP 配置。
- **模板化设计**: 支持精致的 HTML 邮件模板，用于推送重要提醒或数据报告。

### 2. 🕷️ 数据爬虫引擎 (Crawler Engine)
- **自动化采集**: 基于 Cron Job 定时抓取指定数据（如彩票中奖信息、行业动态等）。
- **结构化存储**: 采用 Prisma + PostgreSQL/MySQL 确保数据存储的高效与可靠。

### 3. 🤖 微信 & Coze 桥接 (WeChat to Coze)
- **智能转发**: 实现微信消息与 Coze (字节跳动 AI) 流程的自动化对接。
- **工作流集成**: 通过 API 调用触发复杂的后端任务处理。

---

## 🛠️ 技术栈

- **框架**: [Next.js 15 (App Router)](https://nextjs.org/)
- **类型安全**: [TypeScript](https://www.typescriptlang.org/) + [tRPC](https://trpc.io/)
- **数据库**: [Prisma ORM](https://www.prisma.io/)
- **样式**: [Tailwind CSS 4](https://tailwindcss.com/)
- **网络请求**: [Cheerio](https://cheerio.js.org/) (爬虫) / [Fetcher](https://github.com/sindresorhus/ky)
- **字体**: [Geist](https://vercel.com/font)

---

## ⚙️ 快速开始

### 1. 安装依赖
```bash
pnpm install
```

### 2. 环境配置
复制 `.env.example` 并配置你的环境变量：
```bash
cp .env.example .env
```
主要配置项包括：
- `DATABASE_URL`: 数据库连接地址
- `SMTP_*`: 邮件服务器配置
- `COZE_API_KEY`: Coze 平台认证密钥

### 3. 数据库初始化
```bash
npx prisma generate
npx prisma db push
```

### 4. 启动开发服务器
```bash
pnpm dev
```

---

## 📅 自动化任务 (Cron Jobs)

本项目利用 Next.js Route Handlers 暴露的 API 端点进行定时任务调用：
- `/api/cron/crawler`: 触发数据采集。
- `/api/cron/wechat-to-coze`: 处理消息同步。

---

## 📄 开源协议

[MIT License](LICENSE)
