import { useState, ReactNode } from "react";
import { vi, type Mock } from "vitest";
import type { ClearLogEntry } from "@/types";
import { CookieClearType } from "@/types";

export const hasDomainInText = (
  textContent: string | null | undefined,
  domain: string
): boolean => {
  if (!textContent) return false;
  const escapedDomain = domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const domainPattern = new RegExp(
    String.raw`(^|[^a-zA-Z0-9.-])(?:[a-zA-Z0-9-]+\.)*${escapedDomain}(?=$|[^a-zA-Z0-9.-])`,
    "i"
  );
  return domainPattern.test(textContent);
};

export const createMockCookie = (
  overrides: Partial<chrome.cookies.Cookie> = {}
): chrome.cookies.Cookie => ({
  name: "test",
  value: "value123",
  domain: ".example.com",
  path: "/",
  secure: false,
  httpOnly: false,
  sameSite: "lax",
  storeId: "0",
  session: false,
  hostOnly: false,
  ...overrides,
});

export const createMockLogEntry = (overrides: Partial<ClearLogEntry> = {}): ClearLogEntry => ({
  id: "test-log",
  domain: "example.com",
  count: 1,
  action: "clear",
  cookieType: CookieClearType.ALL,
  timestamp: Date.now(),
  ...overrides,
});

export const setupChromeCookieMocks = (
  cookies: chrome.cookies.Cookie[] = [],
  options?: { removeError?: Error; setError?: Error }
) => {
  vi.spyOn(chrome.cookies, "getAll").mockResolvedValue(cookies);

  if (options?.removeError) {
    vi.spyOn(chrome.cookies, "remove").mockRejectedValue(options.removeError);
  } else {
    vi.spyOn(chrome.cookies, "remove").mockResolvedValue(undefined);
  }

  if (options?.setError) {
    vi.spyOn(chrome.cookies, "set").mockRejectedValue(options.setError);
  } else {
    vi.spyOn(chrome.cookies, "set").mockResolvedValue(undefined);
  }
};

export const setupChromeBrowsingDataMocks = (options?: { removeError?: Error }) => {
  const mockRemove = options?.removeError
    ? vi.fn().mockRejectedValue(options.removeError)
    : vi.fn().mockResolvedValue(undefined);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (chrome.browsingData as any).remove = mockRemove;
  return mockRemove;
};

export const mockUseStorageImplementation = (
  useStorageMock: ReturnType<typeof createUseStorageMock>["useStorageMock"]
) => {
  return (key: string, defaultValue: unknown) => {
    const firstValue = (useStorageMock as Mock).mock.results[0]?.value?.[0];
    const storageState: Record<string, unknown> =
      firstValue && typeof firstValue === "object" ? (firstValue as Record<string, unknown>) : {};

    if (!(key in storageState)) {
      return useStorageMock(key, defaultValue);
    }
    return useStorageMock(key, defaultValue);
  };
};

export const commonTranslations: Record<string, string> = {
  "common.cancel": "取消",
  "common.save": "保存",
  "common.saving": "保存中…",
  "common.delete": "删除",
  "common.yes": "是",
  "common.no": "否",
  "common.confirm": "确定",
  "common.count": "数量: {count}",
  "actions.clear": "清除",
};

export const settingsTranslations: Record<string, string> = {
  ...commonTranslations,
  "settings.workMode": "工作模式",
  "settings.workModeDesc": "控制 Cookie 清理的应用范围，根据您的需求选择合适的保护策略",
  "settings.whitelistMode": "白名单模式：仅白名单内网站不执行清理",
  "settings.blacklistMode": "黑名单模式：仅黑名单内网站执行清理",
  "settings.cookieClearType": "Cookie清除类型",
  "settings.cookieClearTypeDesc": "选择要清除的 Cookie 类型，会话 Cookie 在关闭浏览器后会自动失效",
  "settings.clearSessionOnly": "仅清除会话Cookie",
  "settings.clearPersistentOnly": "仅清除持久Cookie",
  "settings.clearAll": "清除所有Cookie",
  "settings.scheduledCleanup": "定时清理",
  "settings.scheduledCleanupDesc": "设置自动清理的时间间隔，确保您的隐私得到持续保护",
  "settings.disabled": "禁用",
  "settings.hourly": "每小时",
  "settings.daily": "每天",
  "settings.weekly": "每周",
  "settings.advancedCleanup": "高级清理",
  "settings.advancedCleanupDesc": "除了 Cookie 外，还可以清理其他可能存储您数据的浏览器存储",
  "settings.clearCache": "清除缓存",
  "settings.clearCacheDesc": "在清理 Cookie 时同时清除浏览器缓存数据",
  "settings.clearLocalStorage": "清除LocalStorage",
  "settings.clearLocalStorageDesc": "在清理 Cookie 时同时清除本地存储数据",
  "settings.clearIndexedDB": "清除IndexedDB",
  "settings.clearIndexedDBDesc": "在清理 Cookie 时同时清除 IndexedDB 数据库",
  "settings.autoCleanup": "自动清理",
  "settings.autoCleanupDesc": "配置不同场景下的自动清理行为，减少手动操作的繁琐",
  "settings.cleanupOnStartup": "启动时清理",
  "settings.cleanupOnStartupDesc": "浏览器启动时自动执行一次 Cookie 清理",
  "settings.cleanupExpiredCookies": "清理过期Cookie",
  "settings.cleanupExpiredCookiesDesc": "自动识别并清理已过期的 Cookie",
  "settings.cleanupOnTabDiscard": "标签页关闭时清理",
  "settings.privacyProtection": "隐私保护",
  "settings.privacyProtectionDesc": "增强您的在线隐私保护，识别并警示潜在的追踪行为",
  "settings.logRetention": "日志保留时间",
  "settings.logRetentionDesc": "设置清理日志的保留时间，超过此时间的日志将被自动删除",
  "settings.oneHour": "1小时",
  "settings.sixHours": "6小时",
  "settings.twelveHours": "12小时",
  "settings.oneDay": "1天",
  "settings.threeDays": "3天",
  "settings.sevenDays": "7天",
  "settings.tenDays": "10天",
  "settings.thirtyDays": "30天",
  "settings.forever": "永久",
  "settings.enableAutoCleanup": "启用自动清理",
  "settings.themeMode": "主题模式",
  "settings.themeModeDesc": "选择您喜欢的界面主题风格",
  "settings.followBrowser": "跟随系统",
  "settings.light": "浅色主题",
  "settings.dark": "深色主题",
  "settings.custom": "自定义主题",
  "settings.customThemeDesc": "自定义扩展的主题颜色",
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
  "settings.languageDesc": "选择扩展界面的显示语言",
  "settings.showCookieRisk": "显示Cookie风险等级",
  "settings.showCookieRiskDesc": "在Cookie列表中显示每个Cookie的风险等级评估",
};

export const cookieEditorTranslations: Record<string, string> = {
  ...commonTranslations,
  "cookieEditor.createCookie": "新建 Cookie",
  "cookieEditor.editCookie": "编辑 Cookie",
  "cookieEditor.name": "名称",
  "cookieEditor.value": "值",
  "cookieEditor.domain": "域名",
  "cookieEditor.path": "路径",
  "cookieEditor.expiration": "过期时间",
  "cookieEditor.expirationPlaceholder": "留空表示会话 Cookie",
  "cookieEditor.sameSite": "SameSite",
  "cookieEditor.unspecified": "未指定",
  "cookieEditor.strict": "严格",
  "cookieEditor.lax": "宽松",
  "cookieEditor.none": "无",
  "cookieEditor.secureOnly": "仅安全连接",
  "cookieEditor.httpOnlyOnly": "仅 HttpOnly",
};

export const cookieListTranslations: Record<string, string> = {
  ...commonTranslations,
  "cookieList.noCookies": "当前网站暂无 Cookie",
  "cookieList.cookieDetails": "Cookie 详情",
  "cookieList.selectAll": "全选",
  "cookieList.selected": "已选择 {count} 个",
  "cookieList.deleteSelected": "删除选中",
  "cookieList.addToWhitelist": "加入白名单",
  "cookieList.addToBlacklist": "加入黑名单",
  "cookieList.edit": "编辑",
  "cookieList.value": "值",
  "cookieList.path": "路径",
  "cookieList.secure": "安全",
  "cookieList.httpOnly": "HttpOnly",
  "cookieList.show": "显示",
  "cookieList.hide": "隐藏",
  "cookieList.deletedCookie": "已删除 Cookie {name}",
  "cookieList.deleteCookieFailed": "删除 Cookie 失败",
  "cookieList.deleteConfirm": "确定要删除这个 Cookie 吗？",
  "cookieList.deleteSensitiveCookie": "删除敏感 Cookie",
  "cookieList.deleteMessage": "确定要删除 Cookie {name} 吗？",
  "cookieList.deleteSensitiveMessage": "Cookie {name} 是敏感 Cookie，确定要删除吗？",
  "cookieList.cookieUpdated": "Cookie 已更新",
  "cookieList.updateCookieFailed": "更新 Cookie 失败",
  "cookieList.deletedSelected": "已删除 {count} 个 Cookie",
  "cookieList.deleteSelectedConfirm": "确定要删除选中的 Cookie 吗？",
  "cookieList.deleteSelectedSensitive": "删除敏感 Cookie",
  "cookieList.deleteSelectedMessage": "确定要删除选中的 {selectedCount} 个 Cookie 吗？",
  "cookieList.deleteSelectedSensitiveMessage":
    "选中的 Cookie 包含敏感 Cookie，确定要删除吗？{sensitiveCount}, {selectedCount}",
  "cookieList.functionUnavailable": "功能不可用",
  "cookieList.addedDomainsToWhitelist": "已添加 {count} 个域名到白名单",
  "cookieList.domainsAlreadyInWhitelist": "域名已在白名单中",
  "cookieList.selectDomainsFirst": "请先选择域名",
  "cookieList.addedDomainsToBlacklist": "已添加 {count} 个域名到黑名单",
  "cookieList.domainsAlreadyInBlacklist": "域名已在黑名单中",
  "risk.low": "低风险",
  "risk.medium": "中风险",
  "risk.high": "高风险",
  "cookieEditor.createSuccess": "Cookie 已创建",
  "cookieEditor.createFailed": "创建 Cookie 失败",
  "cookieEditor.createCookie": "创建 Cookie",
};

export const clearLogTranslations: Record<string, string> = {
  ...commonTranslations,
  "clearLog.clearLogs": "清除日志",
  "clearLog.noLogs": "暂无清除日志记录",
  "clearLog.clearExpired": "清除过期",
  "clearLog.clearAllLogs": "清除全部",
  "clearLog.exportLogs": "导出日志",
  "clearLog.domain": "域名",
  "clearLog.action": "操作",
  "clearLog.count": "数量",
  "clearLog.time": "时间",
  "clearLog.actions.clear": "清除",
  "clearLog.actions.export": "导出",
  "clearLog.logsCleared": "已清除日志",
  "clearLog.expiredLogsCleared": "已清除过期日志",
  "clearLog.noExpiredLogs": "没有需要清理的过期日志",
  "clearLog.logsExported": "日志已导出",
  "clearLog.confirmClearLogs": "确定要清除所有日志记录吗？",
  "clearLog.logRetentionForever": "日志保留设置为永久，无需清理",
  "cookieTypes.all": "全部",
};

export const createTranslationMock = (translations: Record<string, string>) => {
  return {
    useTranslation: () => ({
      t: (key: string, params?: Record<string, string | number>) => {
        const text = key in translations ? translations[key] : key;
        if (!params) return text;
        return text.replaceAll(/\{(\w+)\}/g, (_, token: string) => {
          const value = params[token];
          return value?.toString() || `{${token}}`;
        });
      },
    }),
  };
};

interface ConfirmDialogWrapperOptions {
  confirmText?: string;
  showDataTestId?: boolean;
}

interface MockWrapperProps {
  children: (
    showConfirm: (
      title: string,
      message: string,
      variant: string,
      onConfirm: () => void
    ) => ReactNode
  ) => ReactNode;
  confirmText?: string;
  showDataTestId: boolean;
}

const MockConfirmDialogWrapper = ({ children, confirmText, showDataTestId }: MockWrapperProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmCallback, setConfirmCallback] = useState<(() => void) | null>(null);

  const showConfirm = (
    _title: string,
    _message: string,
    _variant: string,
    onConfirm: () => void
  ): ReactNode => {
    setConfirmCallback(() => onConfirm);
    setIsOpen(true);
    return null;
  };

  return (
    <>
      {children(showConfirm)}
      {isOpen && (
        <div className="confirm-dialog" data-testid={showDataTestId ? "confirm-dialog" : undefined}>
          {confirmText && <p>{confirmText}</p>}
          <button
            data-testid={showDataTestId ? "confirm-yes" : undefined}
            onClick={() => {
              confirmCallback?.();
              setIsOpen(false);
            }}
          >
            确定
          </button>
          <button
            data-testid={showDataTestId ? "confirm-no" : undefined}
            onClick={() => setIsOpen(false)}
          >
            取消
          </button>
        </div>
      )}
    </>
  );
};

export const createConfirmDialogWrapperMock = (options: ConfirmDialogWrapperOptions = {}) => {
  const { confirmText, showDataTestId = true } = options;
  return {
    ConfirmDialogWrapper: ({
      children,
    }: {
      children: (
        showConfirm: (
          title: string,
          message: string,
          variant: string,
          onConfirm: () => void
        ) => ReactNode
      ) => ReactNode;
    }) => (
      <MockConfirmDialogWrapper confirmText={confirmText} showDataTestId={showDataTestId}>
        {children}
      </MockConfirmDialogWrapper>
    ),
  };
};

export const createUseStorageMock = () => {
  const mockSetValue = vi.fn();
  let mockStorage: Record<string, unknown> = {};

  const useStorageMock = vi.fn((key: string, defaultValue: unknown) => {
    if (!(key in mockStorage)) {
      mockStorage[key] = defaultValue;
    }
    return [
      mockStorage[key],
      (newValue: unknown) => {
        if (typeof newValue === "function") {
          mockStorage[key] = (newValue as (prev: unknown) => unknown)(mockStorage[key]);
        } else {
          mockStorage[key] = newValue;
        }
        mockSetValue(newValue);
      },
    ];
  });

  const resetStorage = () => {
    mockStorage = {};
    mockSetValue.mockClear();
  };

  const setStorageValue = (key: string, value: unknown) => {
    mockStorage[key] = value;
  };

  return {
    useStorageMock,
    mockSetValue,
    resetStorage,
    setStorageValue,
  };
};
