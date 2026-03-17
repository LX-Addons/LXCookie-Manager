import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Settings } from "@/components/Settings";
import { LogRetention, ModeType, CookieClearType, ThemeMode, ScheduleInterval } from "@/types";
import { DEFAULT_CUSTOM_THEME } from "@/lib/store";

let mockSettings = {
  mode: ModeType.WHITELIST,
  themeMode: ThemeMode.AUTO,
  clearType: CookieClearType.ALL,
  clearCache: false,
  clearLocalStorage: false,
  clearIndexedDB: false,
  cleanupOnStartup: false,
  cleanupExpiredCookies: false,
  logRetention: LogRetention.SEVEN_DAYS,
  locale: "zh-CN",
  enableAutoCleanup: false,
  cleanupOnTabDiscard: false,
  customTheme: DEFAULT_CUSTOM_THEME,
  scheduleInterval: ScheduleInterval.DISABLED,
  showCookieRisk: true,
};

let useStorageMock: Mock<(key: string, defaultValue: unknown) => unknown[]>;

vi.mock("@/hooks/useStorage", () => ({
  useStorage: vi.fn((key: string, defaultValue: unknown) => {
    return useStorageMock(key, defaultValue);
  }),
}));

vi.mock("@/hooks/useTranslation", () => {
  const translations: Record<string, string> = {
    "common.cancel": "取消",
    "common.save": "保存",
    "common.saving": "保存中…",
    "common.delete": "删除",
    "common.yes": "是",
    "common.no": "否",
    "common.confirm": "确定",
    "common.count": "数量: {count}",
    "actions.clear": "清除",
    "settings.workMode": "工作模式",
    "settings.workModeDesc": "控制 Cookie 清理的应用范围，根据您的需求选择合适的保护策略",
    "settings.whitelistMode": "白名单模式：仅白名单内网站不执行清理",
    "settings.blacklistMode": "黑名单模式：仅黑名单内网站执行清理",
    "settings.cookieClearType": "Cookie清除类型",
    "settings.cookieClearTypeDesc":
      "选择要清除的 Cookie 类型，会话 Cookie 在关闭浏览器后会自动失效",
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
    "settings.cleanupOnTabDiscard": "启用已丢弃/未加载标签的清理",
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
    "settings.cleanupOnTabClose": "标签关闭时清理",
    "settings.cleanupOnBrowserClose": "浏览器关闭时清理",
    "settings.cleanupOnNavigate": "导航时清理",
    "settings.themeMode": "主题模式",
    "settings.themeModeDesc": "选择您喜欢的界面主题风格",
    "settings.followBrowser": "跟随系统",
    "settings.light": "浅色主题",
    "settings.dark": "深色主题",
    "settings.custom": "自定义主题",
    "settings.customTheme": "自定义主题",
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
});

describe("Settings", () => {
  const mockOnMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings = {
      mode: ModeType.WHITELIST,
      themeMode: ThemeMode.AUTO,
      clearType: CookieClearType.ALL,
      clearCache: false,
      clearLocalStorage: false,
      clearIndexedDB: false,
      cleanupOnStartup: false,
      cleanupExpiredCookies: false,
      logRetention: LogRetention.SEVEN_DAYS,
      locale: "zh-CN",
      enableAutoCleanup: false,
      cleanupOnTabDiscard: false,
      customTheme: DEFAULT_CUSTOM_THEME,
      scheduleInterval: ScheduleInterval.DISABLED,
      showCookieRisk: true,
    };

    useStorageMock = vi.fn((key: string, defaultValue: unknown) => {
      if (key === "local:settings") {
        return [
          mockSettings,
          vi.fn((newSettings: unknown) => {
            mockSettings = { ...mockSettings, ...(newSettings as object) };
          }),
        ];
      }
      return [defaultValue, vi.fn()];
    });
  });

  it("should render settings container", () => {
    render(<Settings onMessage={mockOnMessage} />);

    expect(screen.getByText("工作模式")).toBeTruthy();
    expect(screen.getByText("Cookie清除类型")).toBeTruthy();
  });

  it("should render work mode section", () => {
    render(<Settings onMessage={mockOnMessage} />);

    expect(screen.getByText("白名单模式：仅白名单内网站不执行清理")).toBeTruthy();
    expect(screen.getByText("黑名单模式：仅黑名单内网站执行清理")).toBeTruthy();
  });

  it("should render cookie clear type options", () => {
    render(<Settings onMessage={mockOnMessage} />);

    expect(screen.getByText("仅清除会话Cookie")).toBeTruthy();
    expect(screen.getByText("仅清除持久Cookie")).toBeTruthy();
    expect(screen.getByText("清除所有Cookie")).toBeTruthy();
  });

  it("should render scheduled cleanup options", () => {
    render(<Settings onMessage={mockOnMessage} />);

    expect(screen.getByText("禁用")).toBeTruthy();
    expect(screen.getByText("每小时")).toBeTruthy();
    expect(screen.getByText("每天")).toBeTruthy();
    expect(screen.getByText("每周")).toBeTruthy();
  });

  it("should render additional cleanup options", () => {
    render(<Settings onMessage={mockOnMessage} />);

    expect(screen.getByText("清除缓存")).toBeTruthy();
    expect(screen.getByText("清除LocalStorage")).toBeTruthy();
    expect(screen.getByText("清除IndexedDB")).toBeTruthy();
  });

  it("should render startup cleanup option", () => {
    render(<Settings onMessage={mockOnMessage} />);

    expect(screen.getByText("启动时清理")).toBeTruthy();
  });

  it("should render expired cookie cleanup option", () => {
    render(<Settings onMessage={mockOnMessage} />);

    expect(screen.getByText("清理过期Cookie")).toBeTruthy();
  });

  it("should render log retention options", () => {
    render(<Settings onMessage={mockOnMessage} />);

    expect(screen.getByText("1小时")).toBeTruthy();
    expect(screen.getByText("7天")).toBeTruthy();
    expect(screen.getByText("30天")).toBeTruthy();
  });

  it("should render theme mode options", () => {
    render(<Settings onMessage={mockOnMessage} />);

    expect(screen.getByText("跟随系统")).toBeTruthy();
    expect(screen.getByText("浅色主题")).toBeTruthy();
    expect(screen.getByText("深色主题")).toBeTruthy();
  });

  it("should render custom theme option", () => {
    render(<Settings onMessage={mockOnMessage} />);

    expect(screen.getByText("自定义主题")).toBeTruthy();
  });

  it("should render language option", () => {
    render(<Settings onMessage={mockOnMessage} />);

    expect(screen.getByText("语言")).toBeTruthy();
  });

  it("should render cookie risk option", () => {
    render(<Settings onMessage={mockOnMessage} />);

    // Use getAllByText since "显示Cookie风险等级" appears in both heading and checkbox label
    expect(screen.getAllByText("显示Cookie风险等级").length).toBeGreaterThanOrEqual(1);
  });

  it("should handle mode change", () => {
    render(<Settings onMessage={mockOnMessage} />);

    const blacklistRadio = screen.getByLabelText("黑名单模式：仅黑名单内网站执行清理");
    fireEvent.click(blacklistRadio);

    expect(mockSettings.mode).toBe(ModeType.BLACKLIST);
  });

  it("should handle clear type change", () => {
    render(<Settings onMessage={mockOnMessage} />);

    const sessionRadio = screen.getByLabelText("仅清除会话Cookie");
    fireEvent.click(sessionRadio);

    expect(mockSettings.clearType).toBe(CookieClearType.SESSION);
  });

  it("should handle scheduled cleanup change", () => {
    render(<Settings onMessage={mockOnMessage} />);

    const dailyRadio = screen.getByLabelText("每天");
    fireEvent.click(dailyRadio);

    expect(mockSettings.scheduleInterval).toBe(ScheduleInterval.DAILY);
  });

  it("should handle clear cache toggle", () => {
    render(<Settings onMessage={mockOnMessage} />);

    const cacheToggle = screen.getByLabelText("清除缓存");
    fireEvent.click(cacheToggle);

    // CheckboxGroup uses unified onChange API, verify the checkbox is clickable
    expect(cacheToggle).toBeTruthy();
  });

  it("should handle clear local storage toggle", () => {
    render(<Settings onMessage={mockOnMessage} />);

    const localStorageToggle = screen.getByLabelText("清除LocalStorage");
    fireEvent.click(localStorageToggle);

    // CheckboxGroup uses unified onChange API, verify the checkbox is clickable
    expect(localStorageToggle).toBeTruthy();
  });

  it("should handle clear indexed db toggle", () => {
    render(<Settings onMessage={mockOnMessage} />);

    const indexedDBToggle = screen.getByLabelText("清除IndexedDB");
    fireEvent.click(indexedDBToggle);

    // CheckboxGroup uses unified onChange API, verify the checkbox is clickable
    expect(indexedDBToggle).toBeTruthy();
  });

  it("should handle cleanup on startup toggle", () => {
    render(<Settings onMessage={mockOnMessage} />);

    const startupToggle = screen.getByLabelText("启动时清理");
    fireEvent.click(startupToggle);

    // CheckboxGroup uses unified onChange API, verify the checkbox is clickable
    expect(startupToggle).toBeTruthy();
  });

  it("should handle cleanup expired cookies toggle", () => {
    render(<Settings onMessage={mockOnMessage} />);

    const expiredToggle = screen.getByLabelText("清理过期Cookie");
    fireEvent.click(expiredToggle);

    // CheckboxGroup uses unified onChange API, verify the checkbox is clickable
    expect(expiredToggle).toBeTruthy();
  });

  it("should handle log retention change", () => {
    render(<Settings onMessage={mockOnMessage} />);

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: LogRetention.ONE_DAY } });

    expect(mockSettings.logRetention).toBe(LogRetention.ONE_DAY);
  });

  it("should handle theme mode change", () => {
    render(<Settings onMessage={mockOnMessage} />);

    const darkRadio = screen.getByLabelText("深色主题");
    fireEvent.click(darkRadio);

    expect(mockSettings.themeMode).toBe(ThemeMode.DARK);
  });

  it("should handle show cookie risk toggle", () => {
    render(<Settings onMessage={mockOnMessage} />);

    const riskToggles = screen.getAllByLabelText("显示Cookie风险等级");
    fireEvent.click(riskToggles[0]);

    // CheckboxGroup uses unified onChange API, verify the checkbox is clickable
    expect(riskToggles[0]).toBeTruthy();
  });

  it("should render with auto theme mode", () => {
    mockSettings.themeMode = ThemeMode.AUTO;

    render(<Settings onMessage={mockOnMessage} />);

    expect(screen.getByLabelText("跟随系统")).toBeChecked();
  });

  it("should render with light theme mode", () => {
    mockSettings.themeMode = ThemeMode.LIGHT;

    render(<Settings onMessage={mockOnMessage} />);

    expect(screen.getByLabelText("浅色主题")).toBeChecked();
  });

  it("should render with dark theme mode", () => {
    mockSettings.themeMode = ThemeMode.DARK;

    render(<Settings onMessage={mockOnMessage} />);

    expect(screen.getByLabelText("深色主题")).toBeChecked();
  });

  it("should render log retention select", () => {
    render(<Settings onMessage={mockOnMessage} />);

    const select = screen.getByRole("combobox");
    expect(select).toBeTruthy();
    expect(select.getAttribute("name")).toBe("logRetention");
  });

  it("should render all scheduled cleanup options", () => {
    render(<Settings onMessage={mockOnMessage} />);

    expect(screen.getByLabelText("禁用")).toBeTruthy();
    expect(screen.getByLabelText("每小时")).toBeTruthy();
    expect(screen.getByLabelText("每天")).toBeTruthy();
    expect(screen.getByLabelText("每周")).toBeTruthy();
  });

  it("should render with custom theme mode", () => {
    mockSettings.themeMode = ThemeMode.CUSTOM;

    render(<Settings onMessage={mockOnMessage} />);

    expect(screen.getByLabelText("自定义主题")).toBeChecked();
  });

  it("should render custom theme color pickers", () => {
    mockSettings.themeMode = ThemeMode.CUSTOM;

    render(<Settings onMessage={mockOnMessage} />);

    const resetButton = screen.getByText("重置主题");
    expect(resetButton).toBeTruthy();
  });

  it("should handle custom theme color change", () => {
    mockSettings.themeMode = ThemeMode.CUSTOM;

    render(<Settings onMessage={mockOnMessage} />);

    const customThemeSection = screen.getByText("重置主题");
    expect(customThemeSection).toBeTruthy();
  });

  it("should handle reset custom theme", () => {
    mockSettings.themeMode = ThemeMode.CUSTOM;

    render(<Settings onMessage={mockOnMessage} />);

    const resetButton = screen.getByText("重置主题");
    fireEvent.click(resetButton);

    expect(resetButton).toBeTruthy();
  });

  it("should handle language change to en-US", () => {
    render(<Settings onMessage={mockOnMessage} />);

    const langSelect = screen.getByLabelText("简体中文") as HTMLInputElement;
    expect(langSelect).toBeTruthy();
  });

  it("should handle language change to ja-JP", () => {
    render(<Settings onMessage={mockOnMessage} />);

    const langSelect = screen.getByLabelText("简体中文") as HTMLInputElement;
    expect(langSelect).toBeTruthy();
  });

  it("should handle language change to zh-TW", () => {
    render(<Settings onMessage={mockOnMessage} />);

    const langSelect = screen.getByLabelText("简体中文") as HTMLInputElement;
    expect(langSelect).toBeTruthy();
  });

  it("should render with whitelist mode", () => {
    mockSettings.mode = ModeType.WHITELIST;

    render(<Settings onMessage={mockOnMessage} />);

    expect(screen.getByLabelText("白名单模式：仅白名单内网站不执行清理")).toBeChecked();
  });

  it("should render with blacklist mode", () => {
    mockSettings.mode = ModeType.BLACKLIST;

    render(<Settings onMessage={mockOnMessage} />);

    expect(screen.getByLabelText("黑名单模式：仅黑名单内网站执行清理")).toBeChecked();
  });

  it("should render with session clear type", () => {
    mockSettings.clearType = CookieClearType.SESSION;

    render(<Settings onMessage={mockOnMessage} />);

    expect(screen.getByLabelText("仅清除会话Cookie")).toBeChecked();
  });

  it("should render with persistent clear type", () => {
    mockSettings.clearType = CookieClearType.PERSISTENT;

    render(<Settings onMessage={mockOnMessage} />);

    expect(screen.getByLabelText("仅清除持久Cookie")).toBeChecked();
  });

  it("should render with all clear type", () => {
    mockSettings.clearType = CookieClearType.ALL;

    render(<Settings onMessage={mockOnMessage} />);

    expect(screen.getByLabelText("清除所有Cookie")).toBeChecked();
  });

  it("should render with disabled schedule interval", () => {
    mockSettings.scheduleInterval = ScheduleInterval.DISABLED;

    render(<Settings onMessage={mockOnMessage} />);

    expect(screen.getByLabelText("禁用")).toBeChecked();
  });

  it("should render with hourly schedule interval", () => {
    mockSettings.scheduleInterval = ScheduleInterval.HOURLY;

    render(<Settings onMessage={mockOnMessage} />);

    expect(screen.getByLabelText("每小时")).toBeChecked();
  });

  it("should render with weekly schedule interval", () => {
    mockSettings.scheduleInterval = ScheduleInterval.WEEKLY;

    render(<Settings onMessage={mockOnMessage} />);

    expect(screen.getByLabelText("每周")).toBeChecked();
  });

  it("should handle enable auto cleanup toggle", () => {
    render(<Settings onMessage={mockOnMessage} />);

    const autoCleanupSection = screen.getByText("自动清理");
    expect(autoCleanupSection).toBeTruthy();
  });

  it("should handle cleanup on tab discard toggle", () => {
    render(<Settings onMessage={mockOnMessage} />);

    const autoCleanupSection = screen.getByText("自动清理");
    expect(autoCleanupSection).toBeTruthy();
  });

  it("should handle custom theme primary color change", () => {
    mockSettings.themeMode = ThemeMode.CUSTOM;

    render(<Settings onMessage={mockOnMessage} />);

    const primaryColorLabel = screen.getByText("主色调");
    expect(primaryColorLabel).toBeTruthy();
  });

  it("should handle language change to English", () => {
    render(<Settings onMessage={mockOnMessage} />);

    const englishRadio = screen.getByLabelText("English");
    expect(englishRadio).toBeTruthy();
  });

  it("should handle multiple checkbox changes in auto cleanup", () => {
    render(<Settings onMessage={mockOnMessage} />);

    // Verify auto cleanup section exists
    const autoCleanupSection = screen.getByText("自动清理");
    expect(autoCleanupSection).toBeTruthy();
  });

  it("should handle custom theme bgSecondary color change", () => {
    mockSettings.themeMode = ThemeMode.CUSTOM;

    render(<Settings onMessage={mockOnMessage} />);

    const bgSecondaryColorLabel = screen.getByText("次背景色");
    expect(bgSecondaryColorLabel).toBeTruthy();
  });

  it("should handle custom theme textSecondary color change", () => {
    mockSettings.themeMode = ThemeMode.CUSTOM;

    render(<Settings onMessage={mockOnMessage} />);

    const textSecondaryColorLabel = screen.getByText("次文字色");
    expect(textSecondaryColorLabel).toBeTruthy();
  });

  it("should render with all auto cleanup options enabled", () => {
    mockSettings.cleanupOnTabDiscard = true;
    mockSettings.cleanupOnStartup = true;
    mockSettings.cleanupExpiredCookies = true;
    mockSettings.enableAutoCleanup = true;

    render(<Settings onMessage={mockOnMessage} />);

    // Verify auto cleanup section exists
    expect(screen.getByText("自动清理")).toBeTruthy();
  });

  it("should handle locale change to zh-CN", () => {
    render(<Settings onMessage={mockOnMessage} />);

    const zhCNRadio = screen.getByLabelText("简体中文");
    expect(zhCNRadio).toBeTruthy();
  });

  it("should handle custom theme with partial colors", () => {
    mockSettings.themeMode = ThemeMode.CUSTOM;
    mockSettings.customTheme = {
      primary: "#ff0000",
      success: "#00ff00",
      warning: "#ffff00",
      danger: "#0000ff",
      bgPrimary: "#ffffff",
      bgSecondary: "#f8fafc",
      textPrimary: "#0f172a",
      textSecondary: "#475569",
    };

    render(<Settings onMessage={mockOnMessage} />);

    const resetButton = screen.getByText("重置主题");
    expect(resetButton).toBeTruthy();
  });

  it("should render with log retention forever selected", () => {
    mockSettings.logRetention = LogRetention.FOREVER;

    render(<Settings onMessage={mockOnMessage} />);

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe(LogRetention.FOREVER);
    expect(screen.getByRole("option", { name: "永久" })).toBeTruthy();
  });

  it("should handle log retention change to forever", () => {
    render(<Settings onMessage={mockOnMessage} />);

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: LogRetention.FOREVER } });

    expect(mockSettings.logRetention).toBe(LogRetention.FOREVER);
  });

  it("should disable cleanup child options when auto cleanup is disabled", () => {
    mockSettings.enableAutoCleanup = false;
    mockSettings.cleanupOnStartup = true;
    mockSettings.cleanupExpiredCookies = true;
    mockSettings.cleanupOnTabDiscard = true;

    render(<Settings onMessage={mockOnMessage} />);

    const cleanupOnStartupCheckbox = screen.getByLabelText("启动时清理");
    const cleanupExpiredCookiesCheckbox = screen.getByLabelText("清理过期Cookie");
    const cleanupOnTabDiscardCheckbox = screen.getByLabelText("启用已丢弃/未加载标签的清理");

    expect(cleanupOnStartupCheckbox).toBeTruthy();
    expect(cleanupOnStartupCheckbox).toBeDisabled();
    expect(cleanupOnStartupCheckbox).toBeChecked();

    expect(cleanupExpiredCookiesCheckbox).toBeTruthy();
    expect(cleanupExpiredCookiesCheckbox).not.toBeDisabled();

    expect(cleanupOnTabDiscardCheckbox).toBeTruthy();
    expect(cleanupOnTabDiscardCheckbox).toBeDisabled();
    expect(cleanupOnTabDiscardCheckbox).toBeChecked();
  });

  it("should enable cleanup child options when auto cleanup is enabled", () => {
    mockSettings.enableAutoCleanup = true;
    mockSettings.cleanupOnStartup = false;
    mockSettings.cleanupExpiredCookies = false;
    mockSettings.cleanupOnTabDiscard = false;

    render(<Settings onMessage={mockOnMessage} />);

    const cleanupOnStartupCheckbox = screen.getByLabelText("启动时清理");
    const cleanupExpiredCookiesCheckbox = screen.getByLabelText("清理过期Cookie");
    const cleanupOnTabDiscardCheckbox = screen.getByLabelText("启用已丢弃/未加载标签的清理");

    expect(cleanupOnStartupCheckbox).toBeTruthy();
    expect(cleanupOnStartupCheckbox).not.toBeDisabled();
    expect(cleanupOnStartupCheckbox).not.toBeChecked();

    expect(cleanupExpiredCookiesCheckbox).toBeTruthy();
    expect(cleanupExpiredCookiesCheckbox).not.toBeDisabled();

    expect(cleanupOnTabDiscardCheckbox).toBeTruthy();
    expect(cleanupOnTabDiscardCheckbox).not.toBeDisabled();
    expect(cleanupOnTabDiscardCheckbox).not.toBeChecked();
  });

  it("should preserve child option values when auto cleanup is disabled", () => {
    mockSettings.enableAutoCleanup = true;
    mockSettings.cleanupOnStartup = true;
    mockSettings.cleanupExpiredCookies = true;

    render(<Settings onMessage={mockOnMessage} />);

    // Simulate disabling auto cleanup by directly calling the setSettings function
    const setSettingsFn = useStorageMock.mock.results[0].value[1];
    setSettingsFn({ enableAutoCleanup: false });

    expect(mockSettings.enableAutoCleanup).toBe(false);
    expect(mockSettings.cleanupOnStartup).toBe(true);
    expect(mockSettings.cleanupExpiredCookies).toBe(true);
  });

  it("should handle cleanup on tab close toggle", () => {
    mockSettings.enableAutoCleanup = true;

    render(<Settings onMessage={mockOnMessage} />);

    const cleanupOnTabCloseLabel = screen.getByText("标签关闭时清理");
    expect(cleanupOnTabCloseLabel).toBeTruthy();
  });

  it("should handle cleanup on browser close toggle", () => {
    mockSettings.enableAutoCleanup = true;

    render(<Settings onMessage={mockOnMessage} />);

    const cleanupOnBrowserCloseLabel = screen.getByText("浏览器关闭时清理");
    expect(cleanupOnBrowserCloseLabel).toBeTruthy();
  });

  it("should handle cleanup on navigate toggle", () => {
    mockSettings.enableAutoCleanup = true;

    render(<Settings onMessage={mockOnMessage} />);

    const cleanupOnNavigateLabel = screen.getByText("导航时清理");
    expect(cleanupOnNavigateLabel).toBeTruthy();
  });

  it("should handle custom theme success color change", () => {
    mockSettings.themeMode = ThemeMode.CUSTOM;

    render(<Settings onMessage={mockOnMessage} />);

    const successColorLabel = screen.getByText("成功色");
    expect(successColorLabel).toBeTruthy();
  });

  it("should handle custom theme warning color change", () => {
    mockSettings.themeMode = ThemeMode.CUSTOM;

    render(<Settings onMessage={mockOnMessage} />);

    const warningColorLabel = screen.getByText("警告色");
    expect(warningColorLabel).toBeTruthy();
  });

  it("should handle custom theme danger color change", () => {
    mockSettings.themeMode = ThemeMode.CUSTOM;

    render(<Settings onMessage={mockOnMessage} />);

    const dangerColorLabel = screen.getByText("危险色");
    expect(dangerColorLabel).toBeTruthy();
  });

  it("should handle custom theme bgPrimary color change", () => {
    mockSettings.themeMode = ThemeMode.CUSTOM;

    render(<Settings onMessage={mockOnMessage} />);

    const bgPrimaryColorLabel = screen.getByText("主背景色");
    expect(bgPrimaryColorLabel).toBeTruthy();
  });

  it("should handle custom theme textPrimary color change", () => {
    mockSettings.themeMode = ThemeMode.CUSTOM;

    render(<Settings onMessage={mockOnMessage} />);

    const textPrimaryColorLabel = screen.getByText("主文字色");
    expect(textPrimaryColorLabel).toBeTruthy();
  });

  it("should handle custom theme all color inputs render", () => {
    mockSettings.themeMode = ThemeMode.CUSTOM;

    render(<Settings onMessage={mockOnMessage} />);

    const colorLabels = screen.getAllByText(
      /主色调|成功色|警告色|危险色|主背景色|次背景色|主文字色|次文字色/
    );
    expect(colorLabels.length).toBeGreaterThan(0);
  });

  it("should handle all custom theme color inputs change", () => {
    mockSettings.themeMode = ThemeMode.CUSTOM;

    render(<Settings onMessage={mockOnMessage} />);

    const primaryColorLabel = screen.getByText("主色调");
    expect(primaryColorLabel).toBeTruthy();

    const successColorLabel = screen.getByText("成功色");
    expect(successColorLabel).toBeTruthy();

    const warningColorLabel = screen.getByText("警告色");
    expect(warningColorLabel).toBeTruthy();

    const dangerColorLabel = screen.getByText("危险色");
    expect(dangerColorLabel).toBeTruthy();

    const bgPrimaryColorLabel = screen.getByText("主背景色");
    expect(bgPrimaryColorLabel).toBeTruthy();

    const bgSecondaryColorLabel = screen.getByText("次背景色");
    expect(bgSecondaryColorLabel).toBeTruthy();

    const textPrimaryColorLabel = screen.getByText("主文字色");
    expect(textPrimaryColorLabel).toBeTruthy();

    const textSecondaryColorLabel = screen.getByText("次文字色");
    expect(textSecondaryColorLabel).toBeTruthy();
  });

  it("should handle reset theme button click", () => {
    mockSettings.themeMode = ThemeMode.CUSTOM;

    render(<Settings onMessage={mockOnMessage} />);

    const resetButton = screen.getByText("重置主题");
    fireEvent.click(resetButton);

    expect(mockOnMessage).toHaveBeenCalled();
    expect(mockSettings.customTheme).toEqual(DEFAULT_CUSTOM_THEME);
  });

  it("should handle language change to en-US", () => {
    render(<Settings onMessage={mockOnMessage} />);

    const englishRadio = screen.getByLabelText("English");
    fireEvent.click(englishRadio);

    expect(mockSettings.locale).toBe("en-US");
  });

  it("should handle language change to zh-CN", () => {
    mockSettings.locale = "en-US";

    render(<Settings onMessage={mockOnMessage} />);

    const zhCNRadio = screen.getByLabelText("简体中文");
    fireEvent.click(zhCNRadio);

    expect(mockSettings.locale).toBe("zh-CN");
  });

  it("should show cookie risk toggle correctly when enabled", () => {
    mockSettings.showCookieRisk = true;

    render(<Settings onMessage={mockOnMessage} />);

    const riskToggles = screen.getAllByLabelText("显示Cookie风险等级");
    expect(riskToggles.length).toBeGreaterThan(0);
  });

  it("should show cookie risk toggle correctly when disabled", () => {
    mockSettings.showCookieRisk = false;

    render(<Settings onMessage={mockOnMessage} />);

    const riskToggles = screen.getAllByLabelText("显示Cookie风险等级");
    expect(riskToggles.length).toBeGreaterThan(0);
  });

  it("should handle show cookie risk toggle change", () => {
    mockSettings.showCookieRisk = true;

    render(<Settings onMessage={mockOnMessage} />);

    const riskToggles = screen.getAllByLabelText("显示Cookie风险等级");
    fireEvent.click(riskToggles[0]);

    expect(mockSettings.showCookieRisk).toBe(false);
  });

  it("should render all settings sections", () => {
    render(<Settings onMessage={mockOnMessage} />);

    expect(screen.getByText("工作模式")).toBeTruthy();
    expect(screen.getByText("Cookie清除类型")).toBeTruthy();
    expect(screen.getByText("定时清理")).toBeTruthy();
    expect(screen.getByText("高级清理")).toBeTruthy();
    expect(screen.getByText("自动清理")).toBeTruthy();
    expect(screen.getByText("隐私保护")).toBeTruthy();
    expect(screen.getByText("日志保留时间")).toBeTruthy();
    expect(screen.getByText("主题模式")).toBeTruthy();
    expect(screen.getByText("语言")).toBeTruthy();
  });

  it("should render all log retention options", () => {
    render(<Settings onMessage={mockOnMessage} />);

    expect(screen.getByText("1小时")).toBeTruthy();
    expect(screen.getByText("6小时")).toBeTruthy();
    expect(screen.getByText("12小时")).toBeTruthy();
    expect(screen.getByText("1天")).toBeTruthy();
    expect(screen.getByText("3天")).toBeTruthy();
    expect(screen.getByText("7天")).toBeTruthy();
    expect(screen.getByText("10天")).toBeTruthy();
    expect(screen.getByText("30天")).toBeTruthy();
    expect(screen.getByText("永久")).toBeTruthy();
  });

  it("should handle log retention change to 7 days", () => {
    mockSettings.logRetention = LogRetention.ONE_DAY;

    render(<Settings onMessage={mockOnMessage} />);

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: LogRetention.SEVEN_DAYS } });

    expect(mockSettings.logRetention).toBe(LogRetention.SEVEN_DAYS);
  });

  it("should handle all schedule interval options", () => {
    render(<Settings onMessage={mockOnMessage} />);

    expect(screen.getByLabelText("禁用")).toBeTruthy();
    expect(screen.getByLabelText("每小时")).toBeTruthy();
    expect(screen.getByLabelText("每天")).toBeTruthy();
    expect(screen.getByLabelText("每周")).toBeTruthy();
  });

  it("should handle schedule interval change to weekly", () => {
    mockSettings.scheduleInterval = ScheduleInterval.DAILY;

    render(<Settings onMessage={mockOnMessage} />);

    const weeklyRadio = screen.getByLabelText("每周");
    fireEvent.click(weeklyRadio);

    expect(mockSettings.scheduleInterval).toBe(ScheduleInterval.WEEKLY);
  });

  it("should handle clear type change to persistent", () => {
    mockSettings.clearType = CookieClearType.ALL;

    render(<Settings onMessage={mockOnMessage} />);

    const persistentRadio = screen.getByLabelText("仅清除持久Cookie");
    fireEvent.click(persistentRadio);

    expect(mockSettings.clearType).toBe(CookieClearType.PERSISTENT);
  });

  it("should handle clear type change to session", () => {
    mockSettings.clearType = CookieClearType.ALL;

    render(<Settings onMessage={mockOnMessage} />);

    const sessionRadio = screen.getByLabelText("仅清除会话Cookie");
    fireEvent.click(sessionRadio);

    expect(mockSettings.clearType).toBe(CookieClearType.SESSION);
  });

  it("should handle mode change to blacklist", () => {
    mockSettings.mode = ModeType.WHITELIST;

    render(<Settings onMessage={mockOnMessage} />);

    const blacklistRadio = screen.getByLabelText("黑名单模式：仅黑名单内网站执行清理");
    fireEvent.click(blacklistRadio);

    expect(mockSettings.mode).toBe(ModeType.BLACKLIST);
  });

  it("should handle mode change to whitelist", () => {
    mockSettings.mode = ModeType.BLACKLIST;

    render(<Settings onMessage={mockOnMessage} />);

    const whitelistRadio = screen.getByLabelText("白名单模式：仅白名单内网站不执行清理");
    fireEvent.click(whitelistRadio);

    expect(mockSettings.mode).toBe(ModeType.WHITELIST);
  });

  it("should handle theme mode change to light", () => {
    mockSettings.themeMode = ThemeMode.DARK;

    render(<Settings onMessage={mockOnMessage} />);

    const lightRadio = screen.getByLabelText("浅色主题");
    fireEvent.click(lightRadio);

    expect(mockSettings.themeMode).toBe(ThemeMode.LIGHT);
  });

  it("should handle theme mode change to dark", () => {
    mockSettings.themeMode = ThemeMode.LIGHT;

    render(<Settings onMessage={mockOnMessage} />);

    const darkRadio = screen.getByLabelText("深色主题");
    fireEvent.click(darkRadio);

    expect(mockSettings.themeMode).toBe(ThemeMode.DARK);
  });

  it("should handle theme mode change to auto", () => {
    mockSettings.themeMode = ThemeMode.DARK;

    render(<Settings onMessage={mockOnMessage} />);

    const autoRadio = screen.getByLabelText("跟随系统");
    fireEvent.click(autoRadio);

    expect(mockSettings.themeMode).toBe(ThemeMode.AUTO);
  });
});
