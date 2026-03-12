import { expect, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: vi.fn(() => {
    const translations: Record<string, string> = {
      "common.confirm": "确定",
      "common.cancel": "取消",
      "common.add": "添加",
      "common.delete": "删除",
      "common.save": "保存",
      "common.edit": "编辑",
      "common.clear": "清除",
      "common.clearAll": "清除全部",
      "common.export": "导出",
      "common.yes": "是",
      "common.no": "否",
      "common.count": "{count} 个",
      "common.domains": "{domain} 等{count}个域名",
      "common.allWebsites": "所有网站",
      "tabs.manage": "管理",
      "tabs.whitelist": "白名单",
      "tabs.blacklist": "黑名单",
      "tabs.settings": "设置",
      "tabs.log": "日志",
      "popup.currentWebsite": "当前网站",
      "popup.cookieStats": "Cookie统计",
      "popup.total": "总数",
      "popup.current": "当前网站",
      "popup.session": "会话",
      "popup.persistent": "持久",
      "popup.thirdParty": "第三方",
      "popup.tracking": "追踪",
      "popup.quickActions": "快速操作",
      "popup.addToWhitelist": "添加到白名单",
      "popup.addToBlacklist": "添加到黑名单",
      "popup.clearCurrent": "清除当前网站",
      "popup.clearAllCookies": "清除所有Cookie",
      "popup.unableToGetDomain": "无法获取域名",
      "popup.updateStatsFailed": "更新统计信息失败",
      "popup.clearCookiesFailed": "清除Cookie失败",
      "popup.startupCleanup": "启动清理",
      "popup.expiredCookieCleanup": "过期 Cookie 清理",
      "popup.cleanedExpired": "已清理 {count} 个过期 Cookie",
      "popup.noExpiredFound": "没有找到过期的 Cookie",
      "popup.cleanExpiredFailed": "清理过期 Cookie 失败",
      "popup.addedToWhitelist": "已添加 {domain} 到白名单",
      "popup.addedToBlacklist": "已添加 {domain} 到黑名单",
      "popup.alreadyInWhitelist": "{domain} 已在白名单中",
      "popup.alreadyInBlacklist": "{domain} 已在黑名单中",
      "whitelist.title": "白名单",
      "whitelist.description": "白名单中的网站不会被清理 Cookie",
      "whitelist.empty": "白名单为空",
      "whitelist.add": "添加",
      "whitelist.inputPlaceholder": "输入域名（如：example.com）",
      "whitelist.invalidDomain": "请输入有效的域名",
      "whitelist.addFailed": "添加到白名单失败",
      "whitelist.removeFailed": "从白名单移除失败",
      "blacklist.title": "黑名单",
      "blacklist.description": "黑名单中的网站会被清理 Cookie",
      "blacklist.empty": "黑名单为空",
      "blacklist.add": "添加",
      "blacklist.inputPlaceholder": "输入域名（如：example.com）",
      "blacklist.invalidDomain": "请输入有效的域名",
      "blacklist.addFailed": "添加到黑名单失败",
      "blacklist.removeFailed": "从黑名单移除失败",
      "settings.workMode": "工作模式",
      "settings.workModeDesc": "控制 Cookie 清理的应用范围",
      "settings.whitelistMode": "白名单模式",
      "settings.blacklistMode": "黑名单模式",
      "settings.cookieClearType": "Cookie 清除类型",
      "settings.cookieClearTypeDesc": "选择要清除的 Cookie 类型",
      "settings.clearSessionOnly": "仅清除会话 Cookie",
      "settings.clearPersistentOnly": "仅清除持久 Cookie",
      "settings.clearAll": "清除所有 Cookie",
      "settings.scheduledCleanup": "定时清理",
      "settings.scheduledCleanupDesc": "设置自动清理的时间间隔",
      "settings.disabled": "禁用",
      "settings.hourly": "每小时",
      "settings.daily": "每天",
      "settings.weekly": "每周",
      "settings.clearCache": "清除缓存",
      "settings.clearCacheDesc": "同时清除浏览器缓存",
      "settings.clearLocalStorage": "清除 LocalStorage",
      "settings.clearLocalStorageDesc": "同时清除本地存储",
      "settings.clearIndexedDB": "清除 IndexedDB",
      "settings.clearIndexedDBDesc": "同时清除 IndexedDB 数据库",
      "settings.cleanupOnStartup": "启动时清理",
      "settings.cleanupOnStartupDesc": "浏览器启动时自动清理",
      "settings.cleanupExpiredCookies": "清理过期 Cookie",
      "settings.cleanupExpiredCookiesDesc": "自动识别并清理过期 Cookie",
      "settings.logRetention": "日志保留时间",
      "settings.logRetentionDesc": "设置清理日志的保留时间",
      "settings.oneHour": "1 小时",
      "settings.sixHours": "6 小时",
      "settings.twelveHours": "12 小时",
      "settings.oneDay": "1 天",
      "settings.threeDays": "3 天",
      "settings.sevenDays": "7 天",
      "settings.tenDays": "10 天",
      "settings.thirtyDays": "30 天",
      "settings.themeMode": "主题模式",
      "settings.themeModeDesc": "选择界面主题风格",
      "settings.themeAuto": "跟随系统",
      "settings.themeLight": "浅色主题",
      "settings.themeDark": "深色主题",
      "settings.customTheme": "自定义主题",
      "settings.customThemeDesc": "自定义主题颜色",
      "settings.primaryColor": "主色调",
      "settings.successColor": "成功色",
      "settings.warningColor": "警告色",
      "settings.dangerColor": "危险色",
      "settings.bgPrimaryColor": "主背景色",
      "settings.bgSecondaryColor": "次背景色",
      "settings.textPrimaryColor": "主文字色",
      "settings.textSecondaryColor": "次文字色",
      "settings.resetTheme": "重置主题",
      "settings.language": "语言",
      "settings.languageDesc": "选择界面语言",
      "settings.showCookieRisk": "显示 Cookie 风险等级",
      "settings.showCookieRiskDesc": "在列表中显示风险等级",
      "log.title": "清理日志",
      "log.empty": "暂无清理日志",
      "log.clear": "清空日志",
      "log.clearConfirm": "确定要清空所有日志吗？",
      "log.clearSuccess": "日志已清空",
      "log.clearFailed": "清空日志失败",
      "log.time": "时间",
      "log.type": "类型",
      "log.domains": "域名",
      "log.count": "数量",
      "log.auto": "自动",
      "log.manual": "手动",
      "log.all": "全部",
      "log.current": "当前",
      "risk.low": "低风险",
      "risk.medium": "中风险",
      "risk.high": "高风险",
      "risk.unknown": "未知",
      "cookieList.title": "Cookie 列表",
      "cookieList.empty": "暂无 Cookie",
      "cookieList.search": "搜索 Cookie",
      "cookieList.name": "名称",
      "cookieList.domain": "域名",
      "cookieList.value": "值",
      "cookieList.expiration": "过期时间",
      "cookieList.session": "会话",
      "cookieList.httpOnly": "HttpOnly",
      "cookieList.secure": "安全",
      "cookieList.sameSite": "SameSite",
      "cookieList.risk": "风险等级",
      "cookieList.actions": "操作",
      "cookieList.edit": "编辑",
      "cookieList.delete": "删除",
      "cookieList.deleteConfirm": "确定要删除这个 Cookie 吗？",
      "cookieList.deleteFailed": "删除 Cookie 失败",
      "cookieList.editFailed": "编辑 Cookie 失败",
      "confirm.title": "确认操作",
      "confirm.clearAllCookies": "确定要清除所有 Cookie 吗？",
      "confirm.clearCurrentDomain": "确定要清除当前网站的所有 Cookie 吗？",
      "confirm.clearCookies": "确定要清除选中的 Cookie 吗？",
      "message.noCookiesToClear": "没有需要清除的 Cookie",
      "message.clearSuccess": "成功清除 {count} 个 Cookie",
      "message.clearFailed": "清除 Cookie 失败",
      "message.noDomain": "无法获取当前网站域名",
      "message.domainNotInWhitelist": "域名不在白名单中",
      "message.domainNotInBlacklist": "域名不在黑名单中",
    };

    return {
      t: (key: string, params?: Record<string, string | number>) => {
        let text = translations[key] || key;
        if (params) {
          Object.entries(params).forEach(([k, v]) => {
            text = text.replace(`{${k}}`, String(v));
          });
        }
        return text;
      },
      locale: "zh-CN",
      setLocale: vi.fn(),
    };
  }),
}));

afterEach(() => {
  cleanup();
});

class MockStorage {
  private data = new Map<string, unknown>();

  get(key: string): unknown {
    return this.data.get(key);
  }

  set(key: string, value: unknown): void {
    this.data.set(key, value);
  }

  remove(key: string): void {
    this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }
}

const mockStorage = new MockStorage();

vi.mock("wxt/utils/storage", () => ({
  Storage: MockStorage,
  storage: {
    getItem: vi.fn(async (key: string) => mockStorage.get(key)),
    setItem: vi.fn(async (key: string, value: unknown) => {
      mockStorage.set(key, value);
    }),
    watch: vi.fn(() => {
      return vi.fn();
    }),
  },
}));

vi.mock("@/hooks/useStorage", () => ({
  useStorage: vi.fn((key: string, defaultValue: unknown) => {
    if (key === "settings") {
      const defaultSettings = defaultValue as Record<string, unknown>;
      return [
        {
          mode: defaultSettings.mode || "whitelist",
          clearType: defaultSettings.clearType || "all",
          enableAutoCleanup: defaultSettings.enableAutoCleanup || false,
          cleanupOnTabDiscard: defaultSettings.cleanupOnTabDiscard || false,
          cleanupOnStartup: defaultSettings.cleanupOnStartup || false,
          clearCache: defaultSettings.clearCache || false,
          clearLocalStorage: defaultSettings.clearLocalStorage || false,
          clearIndexedDB: defaultSettings.clearIndexedDB || false,
          cleanupExpiredCookies: defaultSettings.cleanupExpiredCookies || false,
          logRetention: defaultSettings.logRetention || "7d",
          themeMode: defaultSettings.themeMode || "auto",
          customTheme: defaultSettings.customTheme || {},
          scheduleInterval: defaultSettings.scheduleInterval || "disabled",
          showCookieRisk: defaultSettings.showCookieRisk ?? true,
          locale: defaultSettings.locale || "zh-CN",
        },
        vi.fn(),
      ];
    }
    return [defaultValue, vi.fn()];
  }),
}));

// Mock Chrome API
global.chrome = {
  cookies: {
    getAll: vi.fn(),
    getAllCookieStores: vi.fn(),
    remove: vi.fn(),
    set: vi.fn(),
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn(),
    onActivated: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onUpdated: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  runtime: {
    onStartup: {
      addListener: vi.fn(),
    },
    onInstalled: {
      addListener: vi.fn(),
    },
    getManifest: vi.fn(),
  },
  i18n: {
    getMessage: vi.fn((key: string) => key),
    getUILanguage: vi.fn(() => "zh-CN"),
  },
  browsingData: {
    remove: vi.fn(),
  },
} as unknown as typeof chrome;

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
