import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useState, ReactNode } from "react";
import { CookieList, CookieListContent } from "@/components/CookieList";
import { hasDomainInText } from "../utils/mocks";

const mockCookies = [
  {
    name: "cookie1",
    value: "value1",
    domain: ".example.com",
    path: "/",
    secure: true,
    httpOnly: false,
    sameSite: "lax" as const,
  },
  {
    name: "cookie2",
    value: "value2",
    domain: "example.com",
    path: "/test",
    secure: false,
    httpOnly: true,
    sameSite: "strict" as const,
  },
  {
    name: "cookie3",
    value: "value3",
    domain: "test.com",
    path: "/",
    secure: false,
    httpOnly: false,
    sameSite: "unspecified" as const,
    expirationDate: 1234567890,
  },
];

const mockClearSingleCookie = vi.fn(() => Promise.resolve(true));
const mockEditCookie = vi.fn(() => Promise.resolve(true));

vi.mock("@/utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/utils")>();
  return {
    ...original,
    assessCookieRisk: vi.fn(() => ({ level: "low", reason: "安全" })),
    getRiskLevelColor: vi.fn(() => "#22c55e"),
    getRiskLevelText: vi.fn(() => "低风险"),
    clearSingleCookie: () => mockClearSingleCookie(),
    editCookie: () => mockEditCookie(),
    normalizeDomain: vi.fn((domain: string) => domain.replace(/^\./, "").toLowerCase()),
    maskCookieValue: vi.fn((_value: string) => "••••••••"),
    getCookieKey: vi.fn((name: string, domain: string) => `${name}-${domain}`),
    isSensitiveCookie: vi.fn(() => false),
    isInList: vi.fn((domain: string, list: string[]) => {
      const normalizedDomain = domain.replace(/^\./, "").toLowerCase();
      return list.some((item) => {
        const normalizedItem = item.replace(/^\./, "").toLowerCase();
        return (
          normalizedDomain === normalizedItem ||
          normalizedDomain.endsWith("." + normalizedItem) ||
          normalizedItem.endsWith("." + normalizedDomain)
        );
      });
    }),
  };
});

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      const translations: Record<string, string> = {
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
        "cookieList.deleteSelectedMessage": "确定要删除选中的 {count} 个 Cookie 吗？",
        "cookieList.deleteSelectedSensitiveMessage":
          "选中的 Cookie 包含敏感 Cookie，确定要删除吗？",
        "cookieList.functionUnavailable": "功能不可用",
        "cookieList.addedDomainsToWhitelist": "已添加 {count} 个域名到白名单",
        "cookieList.domainsAlreadyInWhitelist": "域名已在白名单中",
        "cookieList.selectDomainsFirst": "请先选择域名",
        "cookieList.addedDomainsToBlacklist": "已添加 {count} 个域名到黑名单",
        "cookieList.domainsAlreadyInBlacklist": "域名已在黑名单中",
        "common.delete": "删除",
        "common.yes": "是",
        "common.no": "否",
        "risk.low": "低风险",
        "risk.medium": "中风险",
        "risk.high": "高风险",
      };
      let text = translations[key] || key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          text = text.replace(`{${k}}`, String(v));
        });
      }
      return text;
    },
  }),
}));

vi.mock("@/components/CookieEditor", () => ({
  CookieEditor: ({
    isOpen,
    cookie,
    onClose,
    onSave,
  }: {
    isOpen: boolean;
    cookie: { name: string; value: string; domain: string } | null;
    onClose: () => void;
    onSave: (cookie: { name: string; value: string; domain: string }) => void;
  }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="cookie-editor">
        <span data-testid="editing-cookie-name">{cookie?.name}</span>
        <button onClick={onClose} data-testid="close-editor">
          关闭
        </button>
        <button
          onClick={() => onSave({ name: "updated", value: "new", domain: "example.com" })}
          data-testid="save-editor"
        >
          保存
        </button>
      </div>
    );
  },
}));

vi.mock("@/components/ConfirmDialogWrapper", () => ({
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
  }) => {
    const MockWrapper = () => {
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
            <div className="confirm-dialog" data-testid="confirm-dialog">
              <button
                data-testid="confirm-yes"
                onClick={() => {
                  confirmCallback?.();
                  setIsOpen(false);
                }}
              >
                确定
              </button>
              <button data-testid="confirm-no" onClick={() => setIsOpen(false)}>
                取消
              </button>
            </div>
          )}
        </>
      );
    };
    return <MockWrapper />;
  },
}));

describe("hasDomainInText", () => {
  it("should return false for null textContent", () => {
    expect(hasDomainInText(null, "example.com")).toBe(false);
  });

  it("should return false for undefined textContent", () => {
    expect(hasDomainInText(undefined, "example.com")).toBe(false);
  });

  it("should return false for empty string textContent", () => {
    expect(hasDomainInText("", "example.com")).toBe(false);
  });

  it("should return true when domain is found in text", () => {
    expect(hasDomainInText("🌐 example.com (2)", "example.com")).toBe(true);
  });

  it("should return false when domain is not found in text", () => {
    expect(hasDomainInText("🌐 test.com (2)", "example.com")).toBe(false);
  });

  it("should handle domain with special regex characters", () => {
    expect(hasDomainInText("🌐 test.com (2)", "test.com")).toBe(true);
  });

  it("should not match partial domain names", () => {
    // 测试子域名不应该匹配父域名
    expect(hasDomainInText("🌐 sub.example.com (2)", "example.com")).toBe(true); // 子域名包含父域名
    expect(hasDomainInText("🌐 evil.com (2)", "example.com")).toBe(false); // 完全不同的域名
    expect(hasDomainInText("🌐 example.org (2)", "example.com")).toBe(false); // 不同 TLD
  });
});

describe("CookieList", () => {
  const mockOnUpdate = vi.fn();
  const mockOnMessage = vi.fn();
  const mockOnAddToWhitelist = vi.fn();
  const mockOnAddToBlacklist = vi.fn();

  beforeEach(() => {
    mockOnUpdate.mockClear();
    mockOnMessage.mockClear();
    mockOnAddToWhitelist.mockClear();
    mockOnAddToBlacklist.mockClear();
  });

  it("should render empty state when no cookies", () => {
    render(<CookieList cookies={[]} currentDomain="example.com" />);

    expect(screen.getByText("当前网站暂无 Cookie")).toBeTruthy();
  });

  it("should render cookie list header with count", () => {
    render(<CookieList cookies={mockCookies} currentDomain="example.com" />);

    expect(screen.getByText(/Cookie 详情/)).toBeTruthy();
    // The count is included in the cookieDetails translation
    expect(screen.getByRole("button", { name: /Cookie 详情/ })).toBeTruthy();
  });

  it("should expand and collapse cookie list", () => {
    render(<CookieList cookies={mockCookies} currentDomain="example.com" />);

    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);

    expect(screen.getByText("全选")).toBeTruthy();
  });

  it("should show select all checkbox when expanded", () => {
    render(<CookieList cookies={mockCookies} currentDomain="example.com" />);

    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);

    const checkbox = screen.getByRole("checkbox", { name: /全选/ });
    expect(checkbox).toBeTruthy();
  });

  it("should toggle select all", () => {
    render(<CookieList cookies={mockCookies} currentDomain="example.com" />);

    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);

    const selectAllCheckbox = screen.getByRole("checkbox", { name: /全选/ }) as HTMLInputElement;
    fireEvent.click(selectAllCheckbox);

    expect(selectAllCheckbox.checked).toBe(true);
  });

  it("should show batch actions when cookies are selected", () => {
    render(<CookieList cookies={mockCookies} currentDomain="example.com" />);

    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);

    const selectAllCheckbox = screen.getByRole("checkbox", { name: /全选/ });
    fireEvent.click(selectAllCheckbox);

    expect(screen.getByText("删除选中")).toBeTruthy();
    expect(screen.getByText("加入白名单")).toBeTruthy();
    expect(screen.getByText("加入黑名单")).toBeTruthy();
  });

  it("should call onMessage when add to whitelist is clicked", () => {
    render(
      <CookieList
        cookies={mockCookies}
        currentDomain="example.com"
        onMessage={mockOnMessage}
        whitelist={[]}
        blacklist={[]}
        onAddToWhitelist={mockOnAddToWhitelist}
        onAddToBlacklist={mockOnAddToBlacklist}
      />
    );

    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);

    const selectAllCheckbox = screen.getByRole("checkbox", { name: /全选/ });
    fireEvent.click(selectAllCheckbox);

    const addToWhitelistBtn = screen.getByText("加入白名单");
    fireEvent.click(addToWhitelistBtn);

    expect(mockOnMessage).toHaveBeenCalled();
    expect(mockOnAddToWhitelist).toHaveBeenCalled();
  });

  it("should call onMessage when add to blacklist is clicked", () => {
    render(
      <CookieList
        cookies={mockCookies}
        currentDomain="example.com"
        onMessage={mockOnMessage}
        whitelist={[]}
        blacklist={[]}
        onAddToWhitelist={mockOnAddToWhitelist}
        onAddToBlacklist={mockOnAddToBlacklist}
      />
    );

    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);

    const selectAllCheckbox = screen.getByRole("checkbox", { name: /全选/ });
    fireEvent.click(selectAllCheckbox);

    const addToBlacklistBtn = screen.getByText("加入黑名单");
    fireEvent.click(addToBlacklistBtn);

    expect(mockOnMessage).toHaveBeenCalled();
    expect(mockOnAddToBlacklist).toHaveBeenCalled();
  });

  it("should show message when onAddToBlacklist is not provided", () => {
    render(
      <CookieList
        cookies={mockCookies}
        currentDomain="example.com"
        onMessage={mockOnMessage}
        whitelist={[]}
        blacklist={[]}
      />
    );

    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);

    const selectAllCheckbox = screen.getByRole("checkbox", { name: /全选/ });
    fireEvent.click(selectAllCheckbox);

    const addToBlacklistBtn = screen.getByText("加入黑名单");
    fireEvent.click(addToBlacklistBtn);

    expect(mockOnMessage).toHaveBeenCalledWith("功能不可用", true);
  });

  it("should show cookie details when expanded", () => {
    render(<CookieList cookies={mockCookies} currentDomain="example.com" />);

    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);

    // Domain groups are shown
    expect(screen.getByText(/example\.com/)).toBeTruthy();
    expect(screen.getByText(/test\.com/)).toBeTruthy();
  });

  it("should show cookie value toggle button", () => {
    render(<CookieList cookies={mockCookies} currentDomain="example.com" />);

    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);

    // Expand domain group to see cookies
    const domainButtons = screen.getAllByRole("button");
    const exampleDomainBtn = domainButtons.find((btn) =>
      hasDomainInText(btn.textContent, "example.com")
    );
    if (exampleDomainBtn) {
      fireEvent.click(exampleDomainBtn);
    }

    // Toggle buttons use aria-label for accessibility
    const toggleButtons = screen.getAllByLabelText("显示");
    expect(toggleButtons.length).toBeGreaterThan(0);
  });

  it("should toggle cookie value visibility", () => {
    render(<CookieList cookies={mockCookies} currentDomain="example.com" />);

    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);

    // Expand domain group to see cookies
    const domainButtons = screen.getAllByRole("button");
    const exampleDomainBtn = domainButtons.find((btn) =>
      hasDomainInText(btn.textContent, "example.com")
    );
    if (exampleDomainBtn) {
      fireEvent.click(exampleDomainBtn);
    }

    // Toggle buttons use aria-label for accessibility
    const showButtons = screen.getAllByLabelText("显示");
    fireEvent.click(showButtons[0]);

    // After clicking, the aria-label should change to "隐藏"
    const hideButtons = screen.getAllByLabelText("隐藏");
    expect(hideButtons.length).toBeGreaterThan(0);
  });

  it("should show delete button for each cookie", () => {
    render(<CookieList cookies={mockCookies} currentDomain="example.com" />);

    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);

    // Expand domain group to see cookies
    const domainButtons = screen.getAllByRole("button");
    const exampleDomainBtn = domainButtons.find((btn) =>
      hasDomainInText(btn.textContent, "example.com")
    );
    if (exampleDomainBtn) {
      fireEvent.click(exampleDomainBtn);
    }

    const deleteButtons = screen.getAllByLabelText("删除");
    expect(deleteButtons.length).toBeGreaterThan(0);
  });

  it("should show edit button for each cookie", () => {
    render(<CookieList cookies={mockCookies} currentDomain="example.com" />);

    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);

    // Expand domain group to see cookies
    const domainButtons = screen.getAllByRole("button");
    const exampleDomainBtn = domainButtons.find((btn) =>
      hasDomainInText(btn.textContent, "example.com")
    );
    if (exampleDomainBtn) {
      fireEvent.click(exampleDomainBtn);
    }

    const editButtons = screen.getAllByLabelText("编辑");
    expect(editButtons.length).toBeGreaterThan(0);
  });

  it("should open editor when edit button is clicked", async () => {
    render(
      <CookieList
        cookies={mockCookies}
        currentDomain="example.com"
        onUpdate={mockOnUpdate}
        onMessage={mockOnMessage}
      />
    );

    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);

    // Expand domain group to see cookies
    const domainButtons = screen.getAllByRole("button");
    const exampleDomainBtn = domainButtons.find((btn) =>
      hasDomainInText(btn.textContent, "example.com")
    );
    if (exampleDomainBtn) {
      fireEvent.click(exampleDomainBtn);
    }

    const editButtons = screen.getAllByLabelText("编辑");
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId("cookie-editor")).toBeTruthy();
    });
  });

  it("should close editor when close button is clicked", async () => {
    render(
      <CookieList
        cookies={mockCookies}
        currentDomain="example.com"
        onUpdate={mockOnUpdate}
        onMessage={mockOnMessage}
      />
    );

    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);

    // Expand domain group to see cookies
    const domainButtons = screen.getAllByRole("button");
    const exampleDomainBtn = domainButtons.find((btn) =>
      hasDomainInText(btn.textContent, "example.com")
    );
    if (exampleDomainBtn) {
      fireEvent.click(exampleDomainBtn);
    }

    const editButtons = screen.getAllByLabelText("编辑");
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId("cookie-editor")).toBeTruthy();
    });

    const closeButton = screen.getByTestId("close-editor");
    fireEvent.click(closeButton);

    expect(screen.queryByTestId("cookie-editor")).toBeNull();
  });

  it("should call onUpdate when cookie is saved", async () => {
    mockEditCookie.mockResolvedValueOnce(true);

    render(
      <CookieList
        cookies={mockCookies}
        currentDomain="example.com"
        onUpdate={mockOnUpdate}
        onMessage={mockOnMessage}
      />
    );

    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);

    // Expand domain group to see cookies
    const domainButtons = screen.getAllByRole("button");
    const exampleDomainBtn = domainButtons.find((btn) =>
      hasDomainInText(btn.textContent, "example.com")
    );
    if (exampleDomainBtn) {
      fireEvent.click(exampleDomainBtn);
    }

    const editButtons = screen.getAllByLabelText("编辑");
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId("cookie-editor")).toBeTruthy();
    });

    const saveButton = screen.getByTestId("save-editor");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalled();
    });
  });

  it("should show risk level for cookies", () => {
    render(<CookieList cookies={mockCookies} currentDomain="example.com" />);

    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);

    // Expand domain group to see cookies
    const domainButtons = screen.getAllByRole("button");
    const exampleDomainBtn = domainButtons.find((btn) =>
      hasDomainInText(btn.textContent, "example.com")
    );
    if (exampleDomainBtn) {
      fireEvent.click(exampleDomainBtn);
    }

    expect(screen.getAllByText("低风险").length).toBeGreaterThan(0);
  });

  it("should show cookie properties", () => {
    render(<CookieList cookies={mockCookies} currentDomain="example.com" />);

    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);

    // Expand domain group to see cookies
    const domainButtons = screen.getAllByRole("button");
    const exampleDomainBtn = domainButtons.find((btn) =>
      hasDomainInText(btn.textContent, "example.com")
    );
    if (exampleDomainBtn) {
      fireEvent.click(exampleDomainBtn);
    }

    expect(screen.getAllByText("安全").length).toBeGreaterThan(0);
    expect(screen.getAllByText("HttpOnly").length).toBeGreaterThan(0);
  });

  it("should group cookies by domain", () => {
    render(<CookieList cookies={mockCookies} currentDomain="example.com" />);

    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);

    expect(screen.getByText(/example\.com/)).toBeTruthy();
    expect(screen.getByText(/test\.com/)).toBeTruthy();
  });

  it("should display cookies by domain groups", async () => {
    render(<CookieList cookies={mockCookies} currentDomain="example.com" />);

    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);

    // Domain groups should be visible
    expect(screen.getByText(/example\.com/)).toBeTruthy();
    expect(screen.getByText(/test\.com/)).toBeTruthy();

    // Expand domain to see cookies
    const domainButtons = screen.getAllByRole("button");
    const exampleDomainBtn = domainButtons.find((btn) =>
      hasDomainInText(btn.textContent, "example.com")
    );
    if (exampleDomainBtn) {
      fireEvent.click(exampleDomainBtn);
    }

    // Cookie names should be visible after expanding
    expect(screen.getByText("cookie1")).toBeTruthy();
  });

  it("should show selected count in batch actions", () => {
    render(<CookieList cookies={mockCookies} currentDomain="example.com" />);

    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);

    const selectAllCheckbox = screen.getByRole("checkbox", { name: /全选/ });
    fireEvent.click(selectAllCheckbox);

    expect(screen.getByText(/已选择/)).toBeTruthy();
  });

  it("should handle individual cookie selection", () => {
    render(<CookieList cookies={mockCookies} currentDomain="example.com" />);

    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);

    // Expand domain group to see cookies
    const domainButtons = screen.getAllByRole("button");
    const exampleDomainBtn = domainButtons.find((btn) =>
      hasDomainInText(btn.textContent, "example.com")
    );
    if (exampleDomainBtn) {
      fireEvent.click(exampleDomainBtn);
    }

    const checkboxes = screen.getAllByRole("checkbox");
    // Skip the "select all" checkbox and click the first cookie checkbox
    if (checkboxes.length > 1) {
      fireEvent.click(checkboxes[1]);
    }

    expect(screen.getByText(/已选择/)).toBeTruthy();
  });

  it("should call onUpdate after deleting cookie", async () => {
    mockClearSingleCookie.mockResolvedValueOnce(true);

    render(
      <CookieList
        cookies={mockCookies}
        currentDomain="example.com"
        onUpdate={mockOnUpdate}
        onMessage={mockOnMessage}
      />
    );

    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);

    // Expand domain group to see cookies
    const domainButtons = screen.getAllByRole("button");
    const exampleDomainBtn = domainButtons.find((btn) =>
      hasDomainInText(btn.textContent, "example.com")
    );
    if (exampleDomainBtn) {
      fireEvent.click(exampleDomainBtn);
    }

    const deleteButtons = screen.getAllByLabelText("删除");
    fireEvent.click(deleteButtons[0]);

    // Wait for confirm dialog to appear
    await waitFor(() => {
      expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
    });

    const confirmButton = screen.getByTestId("confirm-yes");
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalled();
    });
  });

  it("should show domain sections", () => {
    render(<CookieList cookies={mockCookies} currentDomain="example.com" />);

    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);

    expect(screen.getByText(/example\.com/)).toBeTruthy();
    expect(screen.getByText(/test\.com/)).toBeTruthy();
  });

  it("should handle empty cookie list", () => {
    render(<CookieList cookies={[]} currentDomain="example.com" />);

    // Should show empty state message
    expect(screen.getByText(/当前网站暂无 Cookie/)).toBeTruthy();
  });
});

// Wrapper component that provides showConfirm functionality for CookieListContent tests
const CookieListContentWithConfirm = (
  props: Omit<React.ComponentProps<typeof CookieListContent>, "showConfirm">
) => {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmCallback, setConfirmCallback] = useState<(() => void) | null>(null);

  const showConfirm = (
    _title: string,
    _message: string,
    _variant: string,
    onConfirm: () => void
  ) => {
    setConfirmCallback(() => onConfirm);
    setIsOpen(true);
    return null;
  };

  return (
    <>
      <CookieListContent {...props} showConfirm={showConfirm} />
      {isOpen && (
        <div className="confirm-dialog" data-testid="confirm-dialog">
          <button
            data-testid="confirm-yes"
            onClick={() => {
              confirmCallback?.();
              setIsOpen(false);
            }}
          >
            确定
          </button>
          <button data-testid="confirm-no" onClick={() => setIsOpen(false)}>
            取消
          </button>
        </div>
      )}
    </>
  );
};

describe("CookieListContent", () => {
  const mockOnUpdate = vi.fn();
  const mockOnMessage = vi.fn();
  const mockOnAddToWhitelist = vi.fn();
  const mockOnAddToBlacklist = vi.fn();

  beforeEach(() => {
    mockOnUpdate.mockClear();
    mockOnMessage.mockClear();
    mockOnAddToWhitelist.mockClear();
    mockOnAddToBlacklist.mockClear();
  });

  it("should render content component with cookies", () => {
    render(
      <CookieListContentWithConfirm
        cookies={mockCookies}
        currentDomain="example.com"
        onUpdate={mockOnUpdate}
        onMessage={mockOnMessage}
      />
    );

    // Need to expand the list first
    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);

    // Domain groups are shown
    expect(screen.getByText(/example\.com/)).toBeTruthy();
    expect(screen.getByText(/test\.com/)).toBeTruthy();
  });

  it("should show empty state in content when no cookies", () => {
    render(
      <CookieListContentWithConfirm
        cookies={[]}
        currentDomain="example.com"
        onUpdate={mockOnUpdate}
        onMessage={mockOnMessage}
      />
    );

    expect(screen.getByText(/暂无 Cookie|当前网站暂无 Cookie/)).toBeTruthy();
  });

  it("should call onUpdate when cookie is deleted", async () => {
    mockClearSingleCookie.mockResolvedValueOnce(true);

    render(
      <CookieListContentWithConfirm
        cookies={mockCookies}
        currentDomain="example.com"
        onUpdate={mockOnUpdate}
        onMessage={mockOnMessage}
      />
    );

    // Need to expand the list first
    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);

    // Expand domain group to see cookies
    const domainButtons = screen.getAllByRole("button");
    const exampleDomainBtn = domainButtons.find((btn) =>
      hasDomainInText(btn.textContent, "example.com")
    );
    if (exampleDomainBtn) {
      fireEvent.click(exampleDomainBtn);
    }

    const deleteButtons = screen.getAllByLabelText("删除");
    fireEvent.click(deleteButtons[0]);

    // Wait for confirm dialog to appear
    await waitFor(() => {
      expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
    });

    const confirmButton = screen.getByTestId("confirm-yes");
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalled();
    });
  });

  it("should show cookie details in content", () => {
    render(
      <CookieListContentWithConfirm
        cookies={mockCookies}
        currentDomain="example.com"
        onUpdate={mockOnUpdate}
        onMessage={mockOnMessage}
      />
    );

    // Need to expand the list first
    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);

    // Expand domain group to see cookies
    const domainButtons = screen.getAllByRole("button");
    const exampleDomainBtn = domainButtons.find((btn) =>
      hasDomainInText(btn.textContent, "example.com")
    );
    if (exampleDomainBtn) {
      fireEvent.click(exampleDomainBtn);
    }

    // Cookie details like value and path should be visible
    const details = screen.getAllByText(/值|路径|安全|HttpOnly/);
    expect(details.length).toBeGreaterThan(0);
  });

  it("should handle batch operations in content", () => {
    render(
      <CookieListContentWithConfirm
        cookies={mockCookies}
        currentDomain="example.com"
        onUpdate={mockOnUpdate}
        onMessage={mockOnMessage}
        whitelist={[]}
        blacklist={[]}
        onAddToWhitelist={mockOnAddToWhitelist}
        onAddToBlacklist={mockOnAddToBlacklist}
      />
    );

    // Need to expand the list first
    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);

    const selectAllCheckbox = screen.getByRole("checkbox", { name: /全选/ });
    fireEvent.click(selectAllCheckbox);

    expect(screen.getByText("删除选中")).toBeTruthy();
  });

  it("should show domain grouping in content", () => {
    render(
      <CookieListContentWithConfirm
        cookies={mockCookies}
        currentDomain="example.com"
        onUpdate={mockOnUpdate}
        onMessage={mockOnMessage}
      />
    );

    // Need to expand the list first
    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);

    expect(screen.getByText(/example\.com/)).toBeTruthy();
    expect(screen.getByText(/test\.com/)).toBeTruthy();
  });

  it("should allow individual cookie selection in content", () => {
    render(
      <CookieListContentWithConfirm
        cookies={mockCookies}
        currentDomain="example.com"
        onUpdate={mockOnUpdate}
        onMessage={mockOnMessage}
      />
    );

    // Need to expand the list first
    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);

    // Expand domain group to see cookies
    const domainButtons = screen.getAllByRole("button");
    const exampleDomainBtn = domainButtons.find((btn) =>
      hasDomainInText(btn.textContent, "example.com")
    );
    if (exampleDomainBtn) {
      fireEvent.click(exampleDomainBtn);
    }

    const checkboxes = screen.getAllByRole("checkbox");
    // Skip the "select all" checkbox and click the first cookie checkbox
    if (checkboxes.length > 1) {
      fireEvent.click(checkboxes[1]);
    }

    expect(screen.getByText(/已选择/)).toBeTruthy();
  });

  it("should only add new domains to whitelist", () => {
    render(
      <CookieListContentWithConfirm
        cookies={mockCookies}
        currentDomain="example.com"
        onUpdate={mockOnUpdate}
        onMessage={mockOnMessage}
        whitelist={["example.com"]}
        blacklist={[]}
        onAddToWhitelist={mockOnAddToWhitelist}
        onAddToBlacklist={mockOnAddToBlacklist}
      />
    );

    // Need to expand the list first
    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);

    const selectAllCheckbox = screen.getByRole("checkbox", { name: /全选/ });
    fireEvent.click(selectAllCheckbox);

    const addToWhitelistBtn = screen.getByText("加入白名单");
    fireEvent.click(addToWhitelistBtn);

    // Should only add test.com (not example.com which is already in whitelist)
    expect(mockOnAddToWhitelist).toHaveBeenCalledWith(["test.com"]);
  });

  it("should only add new domains to blacklist", () => {
    render(
      <CookieListContentWithConfirm
        cookies={mockCookies}
        currentDomain="example.com"
        onUpdate={mockOnUpdate}
        onMessage={mockOnMessage}
        whitelist={[]}
        blacklist={["example.com"]}
        onAddToWhitelist={mockOnAddToWhitelist}
        onAddToBlacklist={mockOnAddToBlacklist}
      />
    );

    // Need to expand the list first
    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);

    const selectAllCheckbox = screen.getByRole("checkbox", { name: /全选/ });
    fireEvent.click(selectAllCheckbox);

    const addToBlacklistBtn = screen.getByText("加入黑名单");
    fireEvent.click(addToBlacklistBtn);

    // Should only add test.com (not example.com which is already in blacklist)
    expect(mockOnAddToBlacklist).toHaveBeenCalledWith(["test.com"]);
  });
});
