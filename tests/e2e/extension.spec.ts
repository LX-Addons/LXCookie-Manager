import { test, expect, Page } from "./extension-fixture";

async function openPopup(
  context: { newPage: () => Promise<Page> },
  extensionId: string
): Promise<Page> {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  return popup;
}

test.describe("Extension Loading", () => {
  test("should load extension with valid service worker", async ({ extensionId }) => {
    expect(extensionId).toBeTruthy();
    expect(extensionId.length).toBeGreaterThan(0);
  });
});

test.describe("Popup Basic Functionality", () => {
  test("should open popup and display title with tabs", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);

    await expect(popup.locator("h1")).toContainText("Cookie Manager Pro");

    await expect(popup.getByRole("tab", { name: /管理|Manage/ })).toBeVisible();
    await expect(
      popup.getByRole("tab", { name: /白名单|黑名单|Whitelist|Blacklist/ })
    ).toBeVisible();
    await expect(popup.getByRole("tab", { name: /设置|Settings/ })).toBeVisible();
    await expect(popup.getByRole("tab", { name: /日志|Logs/ })).toBeVisible();

    await popup.close();
  });

  test("should switch tabs correctly", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);

    const manageTab = popup.getByRole("tab", { name: /管理|Manage/ });
    const settingsTab = popup.getByRole("tab", { name: /设置|Settings/ });

    await expect(manageTab).toHaveAttribute("aria-selected", "true");

    await settingsTab.click();
    await expect(settingsTab).toHaveAttribute("aria-selected", "true");
    await expect(manageTab).toHaveAttribute("aria-selected", "false");
    await expect(popup.getByRole("tabpanel")).toContainText(/工作模式|Work Mode/);

    await popup.close();
  });
});

test.describe("Cookie Operations", () => {
  test("should display cookie statistics", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);

    await expect(
      popup.locator(".cookie-overview-panel").filter({ hasText: /Cookie 概览|Cookie Overview/ })
    ).toBeVisible();

    const statLabels = popup.locator(".stat-label");
    await expect(statLabels.nth(0)).toContainText(/(会话|Session)/);
    await expect(statLabels.nth(1)).toContainText(/(持久|Persistent)/);

    await popup.close();
  });

  test("should display quick action buttons", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);

    await expect(popup.getByRole("button", { name: /加入白名单|Add to Whitelist/ })).toBeVisible();
    await expect(popup.getByRole("button", { name: /加入黑名单|Add to Blacklist/ })).toBeVisible();
    await expect(popup.getByRole("button", { name: /清除当前|Clear Current/ })).toBeVisible();
    await expect(popup.getByRole("button", { name: /清除全部|Clear All/ })).toBeVisible();

    await popup.close();
  });

  test("should show and close confirm dialog", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);

    const clearCurrentBtn = popup.getByRole("button", { name: /清除当前网站|Clear Current/ });
    await clearCurrentBtn.click();

    await expect(popup.locator(".confirm-dialog")).toBeVisible();
    await expect(popup.getByText(/清除确认|Confirm Clear/)).toBeVisible();

    const cancelBtn = popup.getByRole("button", { name: /取消|Cancel/ });
    await cancelBtn.click();

    await expect(popup.locator(".confirm-dialog")).not.toBeVisible();

    await popup.close();
  });

  test("should show cookie list or empty state", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);

    const cookieListHeader = popup.locator(".cookie-list-header");
    const emptyState = popup.locator(".cookie-list-empty");

    const hasHeader = (await cookieListHeader.count()) > 0;
    const hasEmptyState = (await emptyState.count()) > 0;

    expect(hasHeader || hasEmptyState).toBeTruthy();

    await popup.close();
  });
});

test.describe("Domain Management", () => {
  test("should display domain management interface", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);

    const domainTab = popup.getByRole("tab", { name: /白名单|黑名单|Whitelist|Blacklist/ });
    await domainTab.click();

    await expect(popup.locator('input[placeholder*="google.com"]')).toBeVisible();
    await expect(popup.getByRole("button", { name: /^添加$|^Add$/ })).toBeVisible();
    await expect(
      popup.getByRole("button", { name: /(添加当前网站|Add current website)/ })
    ).toBeVisible();

    await popup.close();
  });

  test("should show error for empty domain", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);

    const domainTab = popup.getByRole("tab", { name: /白名单|黑名单|Whitelist|Blacklist/ });
    await domainTab.click();

    const addButton = popup.getByRole("button", { name: /^添加$|^Add$/ });
    await addButton.click();

    await expect(popup.locator(".message")).toBeVisible();

    await popup.close();
  });

  test("should show error for invalid domain", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);

    const domainTab = popup.getByRole("tab", { name: /白名单|黑名单|Whitelist|Blacklist/ });
    await domainTab.click();

    const input = popup.locator('input[placeholder*="google.com"]');
    await input.fill("invalid domain with spaces");

    const addButton = popup.getByRole("button", { name: /^添加$|^Add$/ });
    await addButton.click();

    await expect(popup.locator(".message")).toBeVisible();

    await popup.close();
  });
});

test.describe("Settings", () => {
  test("should display settings panel with all options", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);

    const settingsTab = popup.getByRole("tab", { name: /设置|Settings/ });
    await settingsTab.click();

    await expect(popup.getByRole("heading", { name: /工作模式|Work Mode/ })).toBeVisible();
    await expect(
      popup.getByRole("heading", { name: /Cookie清除类型|Cookie Clear Type/ })
    ).toBeVisible();
    await expect(popup.getByRole("heading", { name: /定时清理|Scheduled Cleanup/ })).toBeVisible();
    await expect(popup.getByRole("heading", { name: /日志保留时长|Log Retention/ })).toBeVisible();
    await expect(popup.getByRole("heading", { name: /主题模式|Theme Mode/ })).toBeVisible();
    await expect(popup.getByRole("heading", { name: /自动清理|Auto Cleanup/ })).toBeVisible();
    await expect(popup.getByRole("heading", { name: /隐私保护|Privacy Protection/ })).toBeVisible();
    await expect(popup.getByRole("heading", { name: /高级清理|Advanced Cleanup/ })).toBeVisible();

    await popup.close();
  });

  test("should display theme options", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);

    const settingsTab = popup.getByRole("tab", { name: /设置|Settings/ });
    await settingsTab.click();

    await expect(popup.getByRole("radio", { name: /跟随浏览器|Follow Browser/ })).toBeVisible();
    await expect(popup.getByRole("radio", { name: /亮色|Light/ })).toBeVisible();
    await expect(popup.getByRole("radio", { name: /暗色|Dark/ })).toBeVisible();
    await expect(popup.getByRole("radio", { name: /自定义|Custom/ })).toBeVisible();

    await popup.close();
  });

  test("should show custom theme settings when selected", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);

    const settingsTab = popup.getByRole("tab", { name: /设置|Settings/ });
    await settingsTab.click();

    const customRadio = popup.getByLabel(/自定义|Custom/);
    await customRadio.click();

    await expect(popup.locator(".custom-theme-settings")).toBeVisible();
    await expect(
      popup.locator(".custom-theme-settings").getByText(/主色调|Primary Color/)
    ).toBeVisible();
    await expect(
      popup.locator(".custom-theme-settings").getByText(/成功色|Success Color/)
    ).toBeVisible();
    await expect(
      popup.locator(".custom-theme-settings").getByText(/警告色|Warning Color/)
    ).toBeVisible();
    await expect(
      popup.locator(".custom-theme-settings").getByText(/危险色|Danger Color/)
    ).toBeVisible();

    await popup.close();
  });
});

test.describe("Clear Log", () => {
  test("should display log panel with buttons", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);

    const logTab = popup.getByRole("tab", { name: /日志|Logs/ });
    await logTab.click();

    await expect(popup.getByRole("heading", { name: /清除日志|Clear Logs/ })).toBeVisible();
    await expect(popup.getByRole("button", { name: /清除全部|Clear All/ })).toBeVisible();

    await popup.close();
  });
});

test.describe("Accessibility", () => {
  test("should have proper tab ARIA attributes", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);

    const tabs = popup.locator('[role="tab"]');
    expect(await tabs.count()).toBe(4);

    const manageTab = popup.getByRole("tab", { name: /管理|Manage/ });
    await expect(manageTab).toHaveAttribute("aria-selected", "true");
    await expect(manageTab).toHaveAttribute("aria-controls", "manage-panel");

    await popup.close();
  });

  test("should have proper tabpanel structure", async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);

    const managePanel = popup.locator("#manage-panel");
    await expect(managePanel).toBeVisible();
    await expect(managePanel).toHaveAttribute("role", "tabpanel");

    await popup.close();
  });

  test("should have aria-expanded on cookie list header when cookies exist", async ({
    context,
    extensionId,
  }) => {
    const popup = await openPopup(context, extensionId);

    const cookieListHeader = popup.locator(".cookie-list-header");
    const count = await cookieListHeader.count();

    if (count > 0) {
      await expect(cookieListHeader).toHaveAttribute("aria-expanded");
    } else {
      const emptyState = popup.locator(".cookie-list-empty");
      await expect(emptyState).toBeVisible();
    }

    await popup.close();
  });
});
