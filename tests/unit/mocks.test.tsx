import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReactNode } from "react";
import {
  hasDomainInText,
  createTranslationMock,
  createUseStorageMock,
  createMockCookie,
  createMockLogEntry,
  setupChromeCookieMocks,
  setupChromeBrowsingDataMocks,
  commonTranslations,
  settingsTranslations,
  cookieEditorTranslations,
  cookieListTranslations,
  clearLogTranslations,
  createConfirmDialogWrapperMock,
} from "../utils/mocks";

const TEST_DOMAIN = "example.com";

const formatDomainText = (domain: string, prefix: string = "🌐 ", suffix: string = " (2)") =>
  `${prefix}${domain}${suffix}`;

describe("mocks", () => {
  describe("hasDomainInText", () => {
    it("should return false for null textContent", () => {
      expect(hasDomainInText(null, TEST_DOMAIN)).toBe(false);
    });

    it("should return false for undefined textContent", () => {
      expect(hasDomainInText(undefined, TEST_DOMAIN)).toBe(false);
    });

    it("should return false for empty string textContent", () => {
      expect(hasDomainInText("", TEST_DOMAIN)).toBe(false);
    });

    it("should return true when domain is found in text", () => {
      expect(hasDomainInText(formatDomainText(TEST_DOMAIN), TEST_DOMAIN)).toBe(true);
    });

    it("should return false when domain is not found in text", () => {
      expect(hasDomainInText(formatDomainText("test.com"), TEST_DOMAIN)).toBe(false);
    });

    it("should handle domain with special regex characters", () => {
      expect(hasDomainInText(formatDomainText("test.com"), "test.com")).toBe(true);
      expect(hasDomainInText(formatDomainText(TEST_DOMAIN), TEST_DOMAIN)).toBe(true);
    });

    it("should not match suffix domains", () => {
      expect(hasDomainInText(formatDomainText(`${TEST_DOMAIN}.cn`), TEST_DOMAIN)).toBe(false);
    });

    it("should match subdomains", () => {
      expect(hasDomainInText(formatDomainText(`sub.${TEST_DOMAIN}`), TEST_DOMAIN)).toBe(true);
    });

    it("should not match partial domain names", () => {
      expect(hasDomainInText(formatDomainText("evil.com"), TEST_DOMAIN)).toBe(false);
      expect(hasDomainInText(formatDomainText("example.org"), TEST_DOMAIN)).toBe(false);
    });

    it("should be case insensitive", () => {
      expect(hasDomainInText(formatDomainText("EXAMPLE.COM"), TEST_DOMAIN)).toBe(true);
      expect(hasDomainInText(formatDomainText(TEST_DOMAIN), "EXAMPLE.COM")).toBe(true);
    });
  });

  describe("createTranslationMock", () => {
    const getT = (translations: Record<string, string> = {}) => {
      return createTranslationMock(translations).useTranslation().t;
    };

    it("should return a mock useTranslation function", () => {
      const mock = createTranslationMock({});
      expect(mock.useTranslation).toBeDefined();
      expect(typeof mock.useTranslation).toBe("function");
    });

    it("should return the translation key when no translation exists", () => {
      const t = getT();
      expect(t("missing.key")).toBe("missing.key");
    });

    it("should return the translated text when translation exists", () => {
      const t = getT({ "test.key": "Hello World" });
      expect(t("test.key")).toBe("Hello World");
    });

    it("should return text without params when no params provided", () => {
      const t = getT({ "test.key": "Hello {name}" });
      expect(t("test.key")).toBe("Hello {name}");
    });

    it("should replace single placeholder with value", () => {
      const t = getT({ "test.key": "Hello {name}" });
      expect(t("test.key", { name: "World" })).toBe("Hello World");
    });

    it("should replace multiple placeholders with values", () => {
      const t = getT({ "test.key": "Hello {name}, you have {count} messages" });
      expect(t("test.key", { name: "Alice", count: 5 })).toBe("Hello Alice, you have 5 messages");
    });

    it("should replace multiple occurrences of the same placeholder", () => {
      const t = getT({ "test.key": "{name} says hello to {name}" });
      expect(t("test.key", { name: "Bob" })).toBe("Bob says hello to Bob");
    });

    it("should keep placeholder when value is not provided", () => {
      const t = getT({ "test.key": "Hello {name}, you have {count} messages" });
      expect(t("test.key", { name: "Alice" })).toBe("Hello Alice, you have {count} messages");
    });

    it("should handle numeric values", () => {
      const t = getT({ "test.key": "Count: {count}" });
      expect(t("test.key", { count: 123 })).toBe("Count: 123");
    });

    it("should handle string values with special characters", () => {
      const t = getT({ "test.key": "Message: {msg}" });
      expect(t("test.key", { msg: "Hello! How are you?" })).toBe("Message: Hello! How are you?");
    });

    it("should handle empty string translation", () => {
      const t = getT({ "test.key": "" });
      expect(t("test.key")).toBe("");
    });
  });

  describe("createUseStorageMock", () => {
    it("should return mock functions", () => {
      const mock = createUseStorageMock();
      expect(mock.useStorageMock).toBeDefined();
      expect(mock.mockSetValue).toBeDefined();
      expect(mock.resetStorage).toBeDefined();
      expect(mock.setStorageValue).toBeDefined();
    });

    it("should initialize with default value when key not in storage", () => {
      const { useStorageMock } = createUseStorageMock();
      const [value] = useStorageMock("test-key", "default-value");
      expect(value).toBe("default-value");
    });

    it("should return existing value when key in storage", () => {
      const { useStorageMock, setStorageValue } = createUseStorageMock();
      setStorageValue("test-key", "existing-value");
      const [value] = useStorageMock("test-key", "default-value");
      expect(value).toBe("existing-value");
    });

    it("should update value when setter is called with new value", () => {
      const { useStorageMock, mockSetValue } = createUseStorageMock();
      const [, setValue] = useStorageMock("test-key", "default-value");

      (setValue as (value: unknown) => void)("new-value");
      expect(mockSetValue).toHaveBeenCalledWith("new-value");
    });

    it("should update value when setter is called with function", () => {
      const { useStorageMock, mockSetValue } = createUseStorageMock();
      const [, setValue] = useStorageMock("test-key", 0);

      (setValue as (value: unknown) => void)((prev: number) => prev + 1);
      expect(mockSetValue).toHaveBeenCalled();
    });

    it("should reset storage when resetStorage is called", () => {
      const { useStorageMock, setStorageValue, resetStorage } = createUseStorageMock();
      setStorageValue("test-key", "value");
      resetStorage();
      const [value] = useStorageMock("test-key", "default-value");
      expect(value).toBe("default-value");
    });

    it("should set storage value directly with setStorageValue", () => {
      const { useStorageMock, setStorageValue } = createUseStorageMock();
      setStorageValue("test-key", "direct-value");
      const [value] = useStorageMock("test-key", "default-value");
      expect(value).toBe("direct-value");
    });
  });

  describe("createMockCookie", () => {
    it("should create a default mock cookie", () => {
      const cookie = createMockCookie();
      expect(cookie.name).toBe("test");
      expect(cookie.value).toBe("value123");
      expect(cookie.domain).toBe(".example.com");
    });

    it("should override default values with provided overrides", () => {
      const cookie = createMockCookie({
        name: "custom",
        value: "custom-value",
        domain: "test.com",
      });
      expect(cookie.name).toBe("custom");
      expect(cookie.value).toBe("custom-value");
      expect(cookie.domain).toBe("test.com");
    });
  });

  describe("createMockLogEntry", () => {
    it("should create a default mock log entry", () => {
      const logEntry = createMockLogEntry();
      expect(logEntry.id).toBe("test-log");
      expect(logEntry.domain).toBe("example.com");
      expect(logEntry.action).toBe("clear");
    });

    it("should override default values with provided overrides", () => {
      const logEntry = createMockLogEntry({
        id: "custom-id",
        domain: "test.com",
        count: 5,
      });
      expect(logEntry.id).toBe("custom-id");
      expect(logEntry.domain).toBe("test.com");
      expect(logEntry.count).toBe(5);
    });
  });

  describe("setupChromeCookieMocks", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      globalThis.chrome = {
        cookies: {
          getAll: vi.fn(),
          remove: vi.fn(),
          set: vi.fn(),
        },
      } as unknown as typeof chrome;
    });

    it("should setup chrome cookie mocks with default cookies", () => {
      setupChromeCookieMocks();
      expect(chrome.cookies.getAll).toBeDefined();
      expect(chrome.cookies.remove).toBeDefined();
      expect(chrome.cookies.set).toBeDefined();
    });

    it("should setup chrome cookie mocks with provided cookies", () => {
      const testCookie = createMockCookie({ name: "test1" });
      setupChromeCookieMocks([testCookie]);
      expect(chrome.cookies.getAll).toBeDefined();
    });

    it("should setup remove error when option is provided", async () => {
      const testError = new Error("Remove failed");
      setupChromeCookieMocks([], { removeError: testError });
      await expect(
        chrome.cookies.remove({
          name: "test",
          url: "http://example.com",
        })
      ).rejects.toThrow("Remove failed");
    });

    it("should setup set error when option is provided", async () => {
      const testError = new Error("Set failed");
      setupChromeCookieMocks([], { setError: testError });
      await expect(
        chrome.cookies.set({
          name: "test",
          url: "http://example.com",
          value: "test",
        })
      ).rejects.toThrow("Set failed");
    });
  });

  describe("setupChromeBrowsingDataMocks", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      globalThis.chrome = {
        browsingData: {},
      } as unknown as typeof chrome;
    });

    it("should setup chrome browsing data mocks", () => {
      const mockRemove = setupChromeBrowsingDataMocks();
      expect(mockRemove).toBeDefined();
    });

    it("should setup remove error when option is provided", async () => {
      const testError = new Error("Browsing data remove failed");
      const mockRemove = setupChromeBrowsingDataMocks({
        removeError: testError,
      });
      await expect(mockRemove()).rejects.toThrow("Browsing data remove failed");
    });
  });

  describe("translation objects", () => {
    it("should have common translations", () => {
      expect(commonTranslations["common.cancel"]).toBe("取消");
      expect(commonTranslations["common.save"]).toBe("保存");
      expect(commonTranslations["common.delete"]).toBe("删除");
    });

    it("should have settings translations", () => {
      expect(settingsTranslations["settings.workMode"]).toBe("工作模式");
      expect(settingsTranslations["settings.whitelistMode"]).toBe(
        "白名单模式：仅白名单内网站不执行清理"
      );
    });

    it("should have cookie editor translations", () => {
      expect(cookieEditorTranslations["cookieEditor.createCookie"]).toBe("新建 Cookie");
      expect(cookieEditorTranslations["cookieEditor.editCookie"]).toBe("编辑 Cookie");
    });

    it("should have cookie list translations", () => {
      expect(cookieListTranslations["cookieList.noCookies"]).toBe("当前网站暂无 Cookie");
      expect(cookieListTranslations["cookieList.cookieDetails"]).toBe("Cookie 详情 ({count})");
    });

    it("should have clear log translations", () => {
      expect(clearLogTranslations["clearLog.clearLogs"]).toBe("清除日志");
      expect(clearLogTranslations["clearLog.noLogs"]).toBe("暂无清除日志记录");
    });

    it("should include common translations in other translation objects", () => {
      expect(settingsTranslations["common.cancel"]).toBe("取消");
      expect(cookieEditorTranslations["common.save"]).toBe("保存");
    });
  });

  describe("createConfirmDialogWrapperMock", () => {
    type ShowConfirmFn = (
      title: string,
      message: string,
      variant: string,
      onConfirm: () => void
    ) => ReactNode;
    const createTestComponent = (
      ConfirmDialogWrapper: React.ComponentType<{
        children: (showConfirm: ShowConfirmFn) => ReactNode;
      }>,
      onConfirm: () => void
    ) => {
      const TestComponent = () => (
        <ConfirmDialogWrapper>
          {(showConfirm) => (
            <button onClick={() => showConfirm("标题", "消息", "warning", onConfirm)}>打开</button>
          )}
        </ConfirmDialogWrapper>
      );
      TestComponent.displayName = "TestComponent";
      return TestComponent;
    };

    it("should create confirm dialog wrapper mock", () => {
      const mock = createConfirmDialogWrapperMock();
      expect(mock.ConfirmDialogWrapper).toBeDefined();
      expect(typeof mock.ConfirmDialogWrapper).toBe("function");
    });

    it("should create confirm dialog wrapper with custom options", () => {
      const mock = createConfirmDialogWrapperMock({
        confirmText: "自定义确认",
        showDataTestId: false,
      });
      expect(mock.ConfirmDialogWrapper).toBeDefined();
    });

    it("should open dialog when showConfirm is called", () => {
      const mock = createConfirmDialogWrapperMock();
      const onConfirm = vi.fn();
      const TestComponent = createTestComponent(mock.ConfirmDialogWrapper, onConfirm);

      render(<TestComponent />);
      fireEvent.click(screen.getByText("打开"));
      expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    });

    it("should call onConfirm when confirm button is clicked", () => {
      const mock = createConfirmDialogWrapperMock();
      const onConfirm = vi.fn();
      const TestComponent = createTestComponent(mock.ConfirmDialogWrapper, onConfirm);

      render(<TestComponent />);
      fireEvent.click(screen.getByText("打开"));
      fireEvent.click(screen.getByTestId("confirm-yes"));
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("should close dialog when cancel button is clicked", () => {
      const mock = createConfirmDialogWrapperMock();
      const onConfirm = vi.fn();
      const TestComponent = createTestComponent(mock.ConfirmDialogWrapper, onConfirm);

      render(<TestComponent />);
      fireEvent.click(screen.getByText("打开"));
      fireEvent.click(screen.getByTestId("confirm-no"));
      expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it("should display custom confirm text when provided", () => {
      const mock = createConfirmDialogWrapperMock({ confirmText: "确认文本" });
      const onConfirm = vi.fn();
      const TestComponent = createTestComponent(mock.ConfirmDialogWrapper, onConfirm);

      render(<TestComponent />);
      fireEvent.click(screen.getByText("打开"));
      expect(screen.getByText("确认文本")).toBeInTheDocument();
    });

    it("should not add data-testid when showDataTestId is false", () => {
      const mock = createConfirmDialogWrapperMock({ showDataTestId: false });
      const onConfirm = vi.fn();
      const TestComponent = createTestComponent(mock.ConfirmDialogWrapper, onConfirm);

      render(<TestComponent />);
      fireEvent.click(screen.getByText("打开"));
      expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();
    });
  });
});
