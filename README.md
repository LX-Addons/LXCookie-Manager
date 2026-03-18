# 🍪 Cookie Manager Pro

<div align="center">
  <img src="./public/icon.png" alt="Cookie Manager Pro" width="120" height="120" />

  <h3 align="center">
    <strong>高级 Cookie 管理扩展</strong>
  </h3>
  <p align="center">
    智能白名单/黑名单管理，精准控制 Cookie 生命周期<br>
    基于 WXT 框架构建，完美兼容 Chrome/Edge 浏览器
  </p>

  <p align="center">
    <a href="https://github.com/LX-Addons/Cookie_Manager_Pro/blob/main/LICENSE">
      <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" />
    </a>
    <a href="https://github.com/LX-Addons/Cookie_Manager_Pro/actions/workflows/build-and-check.yml">
      <img src="https://github.com/LX-Addons/Cookie_Manager_Pro/actions/workflows/build-and-check.yml/badge.svg" alt="Build Status" />
    </a>
    <a href="https://github.com/LX-Addons/Cookie_Manager_Pro/issues">
      <img src="https://img.shields.io/github/issues/LX-Addons/Cookie_Manager_Pro" alt="Issues" />
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

### 🍪 Cookie 精准控制

- **实时统计**：总数、当前网站、会话 Cookie、持久 Cookie 一目了然
- **详细信息**：查看 Cookie 名称、值、域名、路径、过期时间、安全属性
- **Cookie 编辑**：支持创建、编辑、删除单个 Cookie
- **选择性清理**：全部 Cookie / 仅会话 Cookie / 仅持久 Cookie
- **过期清理**：一键清理所有已过期的 Cookie

### 🤖 自动化清理

- **标签页丢弃**：当标签页被丢弃时自动清理对应 Cookie
- **启动清理**：浏览器启动时自动清理当前标签页 Cookie
- **过期检测**：自动识别并清理过期 Cookie

### 🌍 国际化支持

- **多语言**：支持中文（简体）和英文
- **自动检测**：跟随浏览器语言设置

### 🎨 个性化体验

- **三主题支持**：跟随系统 / 亮色模式 / 暗色模式
- **清理日志**：完整记录清理历史，支持按时间筛选
- **操作反馈**：即时消息提示，操作结果清晰可见

---

## 📁 项目结构

```
Cookie_Manager_Pro/
├── 📂 public/                 # 静态资源
│   └── icon.png               # 扩展图标
├── 📂 src/
│   ├── 📂 components/         # React 组件
│   │   ├── CheckboxGroup.tsx  # 复选框组
│   │   ├── ClearLog.tsx       # 清理日志
│   │   ├── ConfirmDialog.tsx  # 确认对话框
│   │   ├── ConfirmDialogWrapper.tsx
│   │   ├── CookieEditor.tsx   # Cookie 编辑器
│   │   ├── CookieList.tsx     # Cookie 列表
│   │   ├── DomainManager.tsx  # 域名管理
│   │   ├── ErrorBoundary.tsx  # 错误边界
│   │   ├── RadioGroup.tsx     # 单选按钮组
│   │   ├── Select.tsx         # 下拉选择
│   │   └── Settings.tsx       # 设置面板
│   ├── 📂 entrypoints/        # 扩展入口
│   │   ├── popup/             # 弹出窗口
│   │   │   ├── App.tsx
│   │   │   ├── index.html
│   │   │   ├── main.tsx
│   │   │   └── style.css
│   │   └── background.ts      # Service Worker
│   ├── 📂 hooks/              # React Hooks
│   │   ├── useConfirmDialog.ts
│   │   ├── useStorage.ts
│   │   └── useTranslation.ts
│   ├── 📂 i18n/               # 国际化
│   │   ├── en-US.json
│   │   ├── zh-CN.json
│   │   ├── index.ts
│   │   └── types.ts
│   ├── 📂 lib/                # 核心库
│   │   ├── constants.ts
│   │   └── store.ts           # 存储管理
│   ├── 📂 types/              # TypeScript 类型
│   │   └── index.ts
│   └── 📂 utils/              # 工具函数
│       ├── cleanup.ts         # 清理逻辑
│       └── index.ts
├── 📂 tests/                  # 测试文件
│   ├── e2e/                   # E2E 测试
│   ├── unit/                  # 单元测试
│   ├── utils/                 # 测试工具
│   └── setup.ts
├── 📂 .github/                # GitHub 配置
│   ├── workflows/             # CI/CD 工作流
│   └── dependabot.yml
├── package.json               # 项目配置
├── tsconfig.json              # TypeScript 配置
├── wxt.config.ts              # WXT 配置
├── vitest.config.ts           # Vitest 配置
├── playwright.config.ts       # Playwright 配置
├── eslint.config.js           # ESLint 配置
├── .prettierrc.json           # Prettier 配置
└── README.md                  # 项目说明
```

---

## 🛠️ 技术栈

|           技术            |  版本   | 说明               |
| :-----------------------: | :-----: | ------------------ |
|          **WXT**          | 0.20.20 | 现代浏览器扩展框架 |
|         **React**         | 19.2.4  | 前端 UI 框架       |
|      **TypeScript**       |  5.9.3  | 类型安全开发       |
| **@wxt-dev/module-react** |  1.2.2  | WXT React 模块     |
|       **Manifest**        |   V3    | Chrome 扩展规范    |
|        **Vitest**         |  4.1.0  | 单元测试框架       |
|      **Playwright**       | 1.58.2  | E2E 测试框架       |

---

## 🔒 权限说明

### 必需权限

|      权限      | 用途                    |
| :------------: | ----------------------- |
|   `cookies`    | 读取和管理浏览器 Cookie |
|   `storage`    | 存储设置和名单数据      |
|     `tabs`     | 获取当前标签页信息      |
| `browsingData` | 清理浏览器缓存数据      |

### 主机权限

|     权限      | 用途                     |
| :-----------: | ------------------------ |
| `https://*/*` | 管理 HTTPS 网站的 Cookie |
| `http://*/*`  | 管理 HTTP 网站的 Cookie  |

---

## 🌐 浏览器支持

| 浏览器 | 最低版本 |    状态     |
| :----: | :------: | :---------: |
| Chrome |   90+    | ✅ 完全支持 |
|  Edge  |   90+    | ✅ 完全支持 |

---

## ⚠️ 隐私声明

- 🔒 所有数据处理均在本地完成
- 🚫 不会收集或上传任何用户数据
- ✅ 严格遵循隐私优先原则

---

## 📄 许可证

本项目采用 [MIT License](https://github.com/LX-Addons/Cookie_Manager_Pro/blob/main/LICENSE) 开源。

---

<div align="center">
  <p>
    <strong>Made with ❤️ for privacy-conscious users</strong>
  </p>
  <p>
    <sub>Copyright © 2026 Cookie Manager Pro. All rights reserved.</sub>
  </p>
</div>
