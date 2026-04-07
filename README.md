# 🍪 LXCookie Manager

<div align="center">
  <img src="./public/icon.png" alt="LXCookie Manager" width="120" height="120" />

  <h3 align="center">
    <strong>高级 Cookie 管理扩展</strong>
  </h3>
  <p align="center">
    智能白名单/黑名单管理，精准控制 Cookie 生命周期<br>
    智能风险识别，保护隐私安全<br>
    基于 WXT 框架构建，完美兼容 Chrome/Edge 浏览器
  </p>

  <p align="center">
    <a href="https://github.com/LX-Addons/LXCookie_Manager/blob/main/LICENSE">
      <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" />
    </a>
    <a href="https://github.com/LX-Addons/LXCookie_Manager/actions/workflows/build-and-check.yml">
      <img src="https://github.com/LX-Addons/LXCookie_Manager/actions/workflows/build-and-check.yml/badge.svg" alt="Build Status" />
    </a>
    <a href="https://github.com/LX-Addons/LXCookie_Manager/releases">
      <img src="https://img.shields.io/github/v/release/LX-Addons/LXCookie_Manager" alt="Release" />
    </a>
    <a href="https://github.com/LX-Addons/LXCookie_Manager/issues">
      <img src="https://img.shields.io/github/issues/LX-Addons/LXCookie_Manager" alt="Issues" />
    </a>
  </p>
</div>

---

## ✨ 核心功能

### 🛡️ 双模式智能管理

|      模式      | 说明                                    | 适用场景             |
| :------------: | --------------------------------------- | -------------------- |
| **白名单模式** | 仅白名单内网站保留 Cookie，其他自动清理 | 保护常用网站登录状态 |
| **黑名单模式** | 仅黑名单内网站清理 Cookie，其他保留     | 针对性清理特定网站   |

### 🔍 智能风险识别

基于权威数据源的 Cookie 风险评估系统：

| 数据源 | 域名数量 | 说明 |
|:------:|:--------:|------|
| **EasyPrivacy** | ~47,000 | 专注于网络追踪、遥测、分析器 |
| **Peter Lowe's** | ~3,500 | 经典广告服务器和追踪服务器列表 |
| **合并去重** | ~50,700 | 总计唯一追踪域名 |

#### 风险评分系统

| 风险等级 | 评分范围 | 说明 |
|:--------:|:--------:|------|
| 🔴 **极高风险** | 60-100 | 多个高风险因素叠加 |
| 🟠 **高风险** | 40-59 | 追踪 Cookie 或敏感 Cookie |
| 🟡 **中风险** | 20-39 | 存在安全属性问题 |
| 🟢 **低风险** | 0-19 | 安全状态良好 |

#### 风险因素检测

| 因素 | 分数 | 说明 |
|:-----|:----:|------|
| 追踪 Cookie | +40 | 域名/名称匹配追踪列表 |
| 敏感 Cookie | +25 | 包含 session/auth/token 等关键词 |
| 第三方 Cookie | +15 | 域名与当前页面不匹配 |
| 非 HttpOnly | +12 | 可被 JavaScript 访问 |
| 非 Secure | +10 | 可能通过 HTTP 传输 |
| SameSite=None | +8 | 允许跨站发送 |
| 长期有效 | +8 | 有效期超过 90 天 |
| 会话 Cookie | -5 | 浏览器关闭即失效（降低风险） |

### 🍪 Cookie 精准控制

- **实时统计**：总数、当前网站、会话 Cookie、持久 Cookie 一目了然
- **详细信息**：查看 Cookie 名称、值、域名、路径、过期时间、安全属性
- **风险展示**：显示风险等级、评分、具体风险因素
- **Cookie 编辑**：支持创建、编辑、删除单个 Cookie
- **选择性清理**：全部 Cookie / 仅会话 Cookie / 仅持久 Cookie
- **过期清理**：一键清理所有已过期的 Cookie

### 🤖 自动化清理

- **标签页丢弃**：当标签页被丢弃时自动清理对应 Cookie
- **启动清理**：浏览器启动时自动清理当前标签页 Cookie
- **过期检测**：自动识别并清理过期 Cookie

### 📊 数据自动更新

追踪域名数据通过 CI/CD 自动更新：

| 触发条件 | 更新模式 |
|:---------|:---------|
| 本地开发 | 允许失败模式 |
| PR 构建 | 允许失败模式 |
| 主分支推送 | 严格模式 + 新鲜度检查 |
| 正式发布 | 严格模式 + 新鲜度强制 |

### 🌍 国际化支持

项目采用 WXT 框架的官方 i18n 模块方案，统一管理翻译资源：

#### 📦 WXT i18n 模块（统一管理）

- **位置**：`src/locales/`
- **格式**：YAML 格式（如 `zh_CN.yml`, `en_US.yml`）
- **用途**：
  - 扩展名称（`extensionName`）
  - 扩展描述（`extensionDescription`）
  - Popup 界面所有文本
  - 设置面板文案
  - 错误提示消息
  - 用户交互反馈
- **机制**：由 `@wxt-dev/i18n/module` 在构建时统一处理
- **运行时使用**：通过 `#i18n` 导入 WXT 生成的 i18n 实例

#### 🔧 WXT 模块配置说明

```typescript
// wxt.config.ts
modules: ["@wxt-dev/module-react", "@wxt-dev/i18n/module"],
i18n: {
  localesDir: "src/locales",
}
```

| 模块 | 职责 | 使用场景 |
|:----:|:-----|:---------|
| `@wxt-dev/module-react` | React编译支持、JSX、HMR | 所有React组件 |
| `@wxt-dev/i18n/module` | 完整的i18n支持、构建时处理、运行时API | 所有翻译需求 |

#### 🌐 支持语言

- **中文（简体）**：默认语言，跟随系统自动检测
- **英文**：完整翻译支持

### 🎨 个性化体验

- **四种主题支持**：跟随系统 / 亮色模式 / 暗色模式 / 自定义主题
- **自定义颜色**：主色调、成功色、警告色、危险色、背景色、文字色完全可定制
- **清理日志**：完整记录清理历史，支持按时间筛选
- **操作反馈**：即时消息提示，操作结果清晰可见

---

## 📁 项目结构

```
LXCookie_Manager/

├── 📂 public/
│   └── 🖼️ icon.png                    # 扩展图标资源
│
├── 📂 scripts/                         # 🔧 构建脚本
│   ├── tracking-cookie-keywords.json   # 追踪 Cookie 关键词数据
│   ├── update-tracker-data.ts          # 追踪数据更新脚本
│   └── verify-cookie-baseline.ts       # Cookie 基线验证脚本
│
├── 📂 src/
│   │
│   ├── 📂 components/                  # 🎨 React UI 组件
│   │   ├── 📂 cookie-list/             # Cookie 列表组件
│   │   │   ├── CookieBatchActions.tsx  # 批量操作组件
│   │   │   ├── CookieDomainGroup.tsx   # 域名分组组件
│   │   │   ├── CookieListToolbar.tsx   # 列表工具栏
│   │   │   ├── CookieRow.tsx           # Cookie 行组件
│   │   │   ├── useCookieFilters.ts     # Cookie 筛选 Hook
│   │   │   ├── useCookieSelection.ts   # Cookie 选择 Hook
│   │   │   └── utils.ts                # 列表工具函数
│   │   ├── ⬜ CheckboxGroup.tsx        # 复选框组组件
│   │   ├── 📋 ClearLog.tsx             # 清理日志组件
│   │   ├── ⚠️ ConfirmDialog.tsx        # 确认对话框
│   │   ├── ✏️ CookieEditor.tsx         # Cookie 编辑器
│   │   ├── 📜 CookieList.tsx           # Cookie 列表
│   │   ├── 🌐 DomainManager.tsx        # 域名管理器
│   │   ├── 🛡️ ErrorBoundary.tsx        # 错误边界处理
│   │   ├── 🔘 Icon.tsx                 # 图标组件
│   │   ├── 🔘 RadioGroup.tsx           # 单选按钮组
│   │   ├── 📦 Select.tsx               # 下拉选择框
│   │   ├── ⚙️ Settings.tsx             # 设置面板
│   │   └── 📊 StatusPanel.tsx          # 状态面板
│   │
│   ├── 📂 contexts/                    # 🔄 React Context
│   │   ├── ConfirmDialogContext.ts     # 确认对话框上下文
│   │   └── ConfirmDialogProvider.tsx   # 确认对话框提供者
│   │
│   ├── 📂 data/                        # 📊 数据文件
│   │   ├── tracker-domains.json        # 追踪域名数据
│   │   └── tracker-domains.d.ts        # 数据类型定义
│   │
│   ├── 📂 entrypoints/                 # 🚀 扩展入口点
│   │   ├── 📂 popup/                   # 弹出窗口
│   │   │   ├── App.tsx                 # 主应用组件
│   │   │   ├── index.html              # HTML 模板
│   │   │   ├── main.tsx                # 入口文件
│   │   │   ├── style.css               # 主样式文件
│   │   │   ├── 📂 hooks/               # Popup Hooks
│   │   │   │   ├── usePopupActions.ts  # 操作逻辑 Hook
│   │   │   │   ├── usePopupData.ts     # 数据管理 Hook
│   │   │   │   ├── usePopupMessage.ts  # 消息通信 Hook
│   │   │   │   ├── usePopupTabs.ts     # 标签页 Hook
│   │   │   │   └── usePopupTheme.ts    # 主题 Hook
│   │   │   ├── 📂 sections/            # 页面分区组件
│   │   │   │   ├── LogSection.tsx      # 日志区域
│   │   │   │   ├── ManageSection.tsx   # 管理区域
│   │   │   │   ├── RulesSection.tsx    # 规则区域
│   │   │   │   └── SettingsSection.tsx # 设置区域
│   │   │   └── 📂 styles/              # 样式模块
│   │   │       ├── tokens.css          # CSS 变量定义
│   │   │       ├── layout.css          # 布局样式
│   │   │       ├── components.css      # 组件样式
│   │   │       ├── overlays.css        # 覆盖层样式
│   │   │       ├── utilities.css       # 工具类样式
│   │   │       └── base.css            # 基础样式
│   │   └── 📂 background/              # Service Worker
│   │       ├── index.ts                # 入口文件
│   │       ├── runtime/
│   │       │   └── bootstrap.ts        # 启动引导
│   │       ├── handlers/               # 消息处理器
│   │       │   ├── cleanup.ts          # 清理处理
│   │       │   ├── cookies.ts          # Cookie 处理
│   │       │   └── settings.ts         # 设置处理
│   │       └── services/               # 后台服务
│   │           ├── cleanup-executor.ts      # 清理执行服务
│   │           ├── cookie-creator.ts        # Cookie 创建服务
│   │           ├── cookie-mutations.ts      # Cookie 变更服务
│   │           ├── cookie-remover.ts        # Cookie 删除服务
│   │           ├── cookie-updater.ts        # Cookie 更新服务
│   │           ├── error-reporting.ts       # 错误报告服务
│   │           ├── expired-cookie-service.ts # 过期 Cookie 服务
│   │           ├── log-export-service.ts    # 日志导出服务
│   │           ├── log-service.ts           # 日志服务
│   │           ├── message-router.ts        # 消息路由服务
│   │           ├── metrics.ts               # 指标统计服务
│   │           ├── scheduled-cleanup-service.ts  # 定时清理服务
│   │           ├── settings-migrator.ts     # 设置迁移服务
│   │           ├── startup-cleanup-service.ts   # 启动清理服务
│   │           ├── startup-service.ts       # 启动服务
│   │           ├── storage-initializer.ts   # 存储初始化服务
│   │           ├── tab-event-cleanup-service.ts # 标签页事件清理服务
│   │           ├── tab-management-service.ts    # 标签页管理服务
│   │           └── tab-url-manager.ts      # 标签页 URL 管理服务
│   │
│   ├── 📂 hooks/                       # 🪝 React Hooks
│   │   ├── 📂 core/                    # 核心 Hooks
│   │   │   ├── useDialog.ts            # 对话框 Hook
│   │   │   ├── useSiteStatus.ts        # 站点状态 Hook
│   │   │   ├── useStorage.ts           # 存储 Hook
│   │   │   └── useTranslation.ts       # 国际化 Hook
│   │   └── index.ts                    # Hooks 导出入口
│   │
│   ├── 📂 locales/                     # 🌍 国际化资源
│   │   ├── en_US.yml                   # 英文语言包
│   │   └── zh_CN.yml                   # 中文语言包
│
│   ├── 📂 lib/                         # 📚 核心库
│   │   ├── background-service.ts       # 后台通信服务
│   │   ├── constants.ts                # 常量定义（含追踪数据）
│   │   ├── cookie-data-validators.ts   # Cookie 数据验证
│   │   ├── distributed-lock.ts         # 分布式锁
│   │   └── store.ts                    # 状态存储
│   │
│   ├── 📂 types/                       # 📝 TypeScript 类型
│   │   ├── global.d.ts                 # 全局类型声明
│   │   └── index.ts                    # 类型定义入口
│   │
│   └── 📂 utils/                       # 🔧 工具函数
│       ├── 📂 cleanup/                 # Cookie 清理工具
│       │   ├── cleanup-runner.ts       # 清理执行器
│       │   ├── cookie-ops.ts           # Cookie 操作
│       │   ├── domain-policy.ts        # 域名策略
│       │   ├── index.ts                # 清理工具入口
│       │   ├── schedule-utils.ts       # 调度工具
│       │   └── site-data-ops.ts        # 站点数据操作
│       ├── cookie-risk.ts              # Cookie 风险评估
│       ├── domain-rules.ts             # 域名规则工具
│       ├── domain.ts                   # 域名工具
│       ├── format.ts                   # 格式化工具
│       ├── index.ts                    # 工具函数入口
│       └── theme.ts                    # 主题工具

├── 📂 .github/                         # ⚡ GitHub 配置
│   ├── 📂 actions/                     # 自定义 Actions
│   │   └── 📂 setup-pnpm/
│   │       └── action.yml              # pnpm 环境设置
│   ├── 📂 workflows/                   # CI/CD 工作流
│   │   ├── build-and-check.yml         # 构建检查
│   │   ├── clear-caches.yml            # 缓存清理
│   │   ├── dependency-review.yml       # 依赖审查
│   │   ├── release.yml                 # 发布流程
│   │   ├── setup-env.yml               # 环境设置
│   │   └── stale.yml                   # 过期 Issue 处理
│   ├── CODEOWNERS                      # 代码所有者
│   ├── codeql-config.yml               # CodeQL 配置
│   └── dependabot.yml                  # 依赖更新配置

├── 📄 package.json                     # 项目依赖配置
├── 📄 pnpm-lock.yaml                   # pnpm 锁定文件
├── 📄 tsconfig.json                    # TypeScript 配置
├── 📄 wxt.config.ts                    # WXT 框架配置
├── 📄 eslint.config.js                 # ESLint 规则配置
├── 📄 .prettierrc.json                 # Prettier 格式化配置
├── 📄 .prettierignore                  # Prettier 忽略配置
├── 📄 .npmrc                           # npm 配置
├── 📄 .gitattributes                   # Git 属性配置
├── 📄 .gitignore                       # Git 忽略配置
├── 📄 LICENSE                          # 许可证
└── 📄 README.md                        # 项目说明文档
```

<details>
<summary>📊 目录结构概览</summary>

| 目录 | 职责 | 主要内容 |
|:----:|:----:|:---------|
| `public/` | 静态资源 | 扩展图标 |
| `scripts/` | 构建脚本 | 追踪数据更新、Cookie 基线验证 |
| `src/components/` | UI 组件 | React 可复用组件（含 Cookie 列表子模块） |
| `src/contexts/` | React Context | 确认对话框上下文与提供者 |
| `src/data/` | 数据文件 | 追踪域名数据 |
| `src/entrypoints/popup/` | 弹出窗口 | Popup UI、Hooks、分区组件及样式 |
| `src/entrypoints/background/` | 后台服务 | Service Worker 及消息处理 |
| `src/hooks/` | 自定义 Hooks | 状态管理、国际化、对话框等核心 Hooks |
| `src/locales/` | 国际化资源 | WXT i18n 翻译文件 |
| `src/lib/` | 核心库 | 后台通信、常量、存储、数据验证 |
| `src/types/` | 类型定义 | TypeScript 类型 |
| `src/utils/` | 工具函数 | 清理逻辑、风险评估、域名工具等 |
| `.github/` | CI/CD | 自动化工作流 |

</details>

---

## 🛠️ 技术栈

|           技术            |  版本   | 说明               |
| :-----------------------: | :-----: | ------------------ |
|          **WXT**          | 0.20.20 | 现代浏览器扩展框架 |
|         **React**         | 19.2.4  | 前端 UI 框架       |
|      **TypeScript**       |  5.9.3  | 类型安全开发       |
| **@wxt-dev/module-react** |  1.2.2  | WXT React 模块     |
|        **Manifest**        |   V3    | Chrome 扩展规范    |
|         **pnpm**          | 10.33.0 | 包管理器           |

---

## 🔒 权限说明

### 必需权限

|      权限      | 用途                    |
| :------------: | ----------------------- |
|   `cookies`    | 读取和管理浏览器 Cookie |
|   `storage`    | 存储设置和名单数据      |
|     `tabs`     | 获取当前标签页信息      |
| `browsingData` | 清理浏览器缓存数据      |
|    `alarms`    | 定时任务调度            |

### 主机权限

|     权限      | 用途                     |
| :-----------: | ------------------------ |
| `https://*/*` | 管理 HTTPS 网站的 Cookie |
| `http://*/*`  | 管理 HTTP 网站的 Cookie  |

---

## ⚠️ 隐私声明

- 🔒 所有数据处理均在本地完成
- 🚫 不会收集或上传任何用户数据
- ✅ 严格遵循隐私优先原则
- 📊 追踪域名数据来自权威开源项目（EasyPrivacy、Peter Lowe's）

---

## 📄 许可证

本项目采用 [MIT License](https://github.com/LX-Addons/LXCookie_Manager/blob/main/LICENSE) 开源。

---

<div align="center">
  <p>
    <strong>Made with ❤️ for privacy-conscious users</strong>
  </p>
  <p>
    <sub>Copyright © 2026 LXCookie Manager. All rights reserved.</sub>
  </p>
</div>
