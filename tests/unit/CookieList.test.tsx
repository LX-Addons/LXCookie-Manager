import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useState, ReactNode } from "react";
import { CookieList, CookieListContent } from "@/components/CookieList";
import { hasDomainInText } from "../utils/mocks";
import type { Cookie } from "@/types";

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
const mockCreateCookie = vi.fn(() => Promise.resolve(true));

vi.mock("@/utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/utils")>();
  return {
    ...original,
    assessCookieRisk: vi.fn(() => ({ level: "low", reason: "安全" })),
    getRiskLevelColor: vi.fn(() => "#22c55e"),
    getRiskLevelText: vi.fn(() => "低风险"),
    clearSingleCookie: () => mockClearSingleCookie(),
    editCookie: () => mockEditCookie(),
    createCookie: () => mockCreateCookie(),
    normalizeDomain: vi.fn((domain: string) => domain.replace(/^\./, "").toLowerCase()),
    maskCookieValue: vi.fn((_value: string) => "••••••••"),
    getCookieKey: vi.fn((name: string, domain: string, path?: string, storeId?: string) => {
      return `${name}|${domain}|${path ?? "/"}|${storeId ?? "0"}`;
    }),
    isSensitiveCookie: vi.fn(() => false),
    isInList: vi.fn((domain: string, list: string[]) => {
      const normalizedDomain = domain.replace(/^\./, "").toLowerCase();
      return list.some((item) => {
        const normalizedItem = item.replace(/^\./, "").toLowerCase();
        return (
          normalizedDomain === normalizedItem || normalizedDomain.endsWith("." + normalizedItem)
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
        "cookieList.deleteSensitiveMessage":
          "选中的 Cookie 包含敏感 Cookie，确定要删除吗？{sensitiveCount}, {selectedCount}",
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
        "cookieEditor.createSuccess": "Cookie 已创建",
        "cookieEditor.createFailed": "创建 Cookie 失败",
        "cookieEditor.createCookie": "创建 Cookie",
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
    onSave: (cookie: { name: string; value: string; domain: string }) => Promise<boolean>;
  }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="cookie-editor">
        <span data-testid="editing-cookie-name">{cookie?.name}</span>
        <button onClick={onClose} data-testid="close-editor">
          关闭
        </button>
        <button
          onClick={async () =>
            await onSave({ name: "updated", value: "new", domain: "example.com" })
          }
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
            <button
              data-testid="confirm-no"
              onClick={() => {
                setIsOpen(false);
              }}
            >
              取消
            </button>
          </div>
        )}
      </>
    );
  },
}));

const setupMocks = () => {
  const mockOnUpdate = vi.fn();
  const mockOnMessage = vi.fn();
  const mockOnAddToWhitelist = vi.fn();
  const mockOnAddToBlacklist = vi.fn();

  beforeEach(() => {
    mockOnUpdate.mockClear();
    mockOnMessage.mockClear();
    mockOnAddToWhitelist.mockClear();
    mockOnAddToBlacklist.mockClear();
    mockClearSingleCookie.mockClear();
    mockEditCookie.mockClear();
    mockCreateCookie.mockClear();
  });

  return { mockOnUpdate, mockOnMessage, mockOnAddToWhitelist, mockOnAddToBlacklist };
};

const renderAndExpandCookieList = (Component: React.ComponentType<any>, props: Record<string, unknown> = {}) => {
  const result = render(<Component {...props} />);
  const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
  fireEvent.click(headerButton);
  return result;
};

const expandDomainGroup = (domain: string) => {
  const domainButtons = screen.getAllByRole("button");
  const exampleDomainBtn = domainButtons.find((btn) => hasDomainInText(btn.textContent, domain));
  if (exampleDomainBtn) {
    fireEvent.click(exampleDomainBtn);
  }
};

describe("hasDomainInText", () => {
  it("should handle null/undefined/empty textContent", () => {
    expect(hasDomainInText(null, "example.com")).toBe(false);
    expect(hasDomainInText(undefined, "example.com")).toBe(false);
    expect(hasDomainInText("", "example.com")).toBe(false);
  });

  it("should find domain in text and reject mismatches", () => {
    expect(hasDomainInText("🌐 example.com (2)", "example.com")).toBe(true);
    expect(hasDomainInText("🌐 test.com (2)", "example.com")).toBe(false);
  });

  it("should handle special cases and partial matches", () => {
    expect(hasDomainInText("🌐 test.com (2)", "test.com")).toBe(true);
    expect(hasDomainInText("🌐 sub.example.com (2)", "example.com")).toBe(true);
    expect(hasDomainInText("🌐 evil.com (2)", "example.com")).toBe(false);
    expect(hasDomainInText("🌐 example.org (2)", "example.com")).toBe(false);
  });
});

describe("CookieList", () => {
  const { mockOnUpdate, mockOnMessage, mockOnAddToWhitelist, mockOnAddToBlacklist } = setupMocks();

  it("should render empty state and create button", () => {
    render(<CookieList cookies={[]} currentDomain="example.com" />);
    expect(screen.getByText("当前网站暂无 Cookie")).toBeTruthy();
    expect(screen.getByRole("button", { name: /创建 Cookie/ })).toBeTruthy();
  });

  it("should open cookie editor from empty state", () => {
    render(<CookieList cookies={[]} currentDomain="example.com" />);
    fireEvent.click(screen.getByRole("button", { name: /创建 Cookie/ }));
    expect(screen.getByTestId("cookie-editor")).toBeTruthy();
  });

  it("should render and expand cookie list", () => {
    renderAndExpandCookieList(CookieList, { cookies: mockCookies, currentDomain: "example.com" });
    expect(screen.getByText("全选")).toBeTruthy();
    expect(screen.getByText(/example\.com/)).toBeTruthy();
    expect(screen.getByText(/test\.com/)).toBeTruthy();
  });

  it("should toggle select all and show batch actions", () => {
    renderAndExpandCookieList(CookieList, { cookies: mockCookies, currentDomain: "example.com" });
    const selectAllCheckbox = screen.getByRole("checkbox", { name: /全选/ }) as HTMLInputElement;
    fireEvent.click(selectAllCheckbox);
    expect(selectAllCheckbox.checked).toBe(true);
    expect(screen.getByText("删除选中")).toBeTruthy();
    expect(screen.getByText("加入白名单")).toBeTruthy();
    expect(screen.getByText("加入黑名单")).toBeTruthy();
  });

  const testBatchAction = (
    buttonText: string,
    mockFn: ReturnType<typeof vi.fn>,
    shouldCall: boolean = true
  ) => {
    renderAndExpandCookieList(CookieList, {
      cookies: mockCookies,
      currentDomain: "example.com",
      onMessage: mockOnMessage,
      whitelist: [],
      blacklist: [],
      onAddToWhitelist: mockOnAddToWhitelist,
      onAddToBlacklist: mockOnAddToBlacklist,
    });
    const selectAllCheckbox = screen.getByRole("checkbox", { name: /全选/ });
    fireEvent.click(selectAllCheckbox);
    fireEvent.click(screen.getByText(buttonText));
    if (shouldCall) {
      expect(mockOnMessage).toHaveBeenCalled();
      expect(mockFn).toHaveBeenCalled();
    }
  };

  it("should call add to whitelist", () => testBatchAction("加入白名单", mockOnAddToWhitelist));
  it("should call add to blacklist", () => testBatchAction("加入黑名单", mockOnAddToBlacklist));

  it("should show function unavailable when onAddToBlacklist is not provided", () => {
    renderAndExpandCookieList(CookieList, {
      cookies: mockCookies,
      currentDomain: "example.com",
      onMessage: mockOnMessage,
      whitelist: [],
      blacklist: [],
    });
    const selectAllCheckbox = screen.getByRole("checkbox", { name: /全选/ });
    fireEvent.click(selectAllCheckbox);
    fireEvent.click(screen.getByText("加入黑名单"));
    expect(mockOnMessage).toHaveBeenCalledWith("功能不可用", true);
  });

  const testCookieDetails = async () => {
    renderAndExpandCookieList(CookieList, { cookies: mockCookies, currentDomain: "example.com" });
    expandDomainGroup("example.com");

    expect(screen.getAllByLabelText("显示").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("删除").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("编辑").length).toBeGreaterThan(0);
    expect(screen.getAllByText("低风险").length).toBeGreaterThan(0);
    expect(screen.getAllByText("安全").length).toBeGreaterThan(0);
    expect(screen.getAllByText("HttpOnly").length).toBeGreaterThan(0);
  };

  it("should show cookie details", () => testCookieDetails());

  it("should toggle cookie value visibility", () => {
    renderAndExpandCookieList(CookieList, { cookies: mockCookies, currentDomain: "example.com" });
    expandDomainGroup("example.com");
    fireEvent.click(screen.getAllByLabelText("显示")[0]);
    expect(screen.getAllByLabelText("隐藏").length).toBeGreaterThan(0);
  });

  it("should open and close editor when edit button is clicked", async () => {
    renderAndExpandCookieList(CookieList, {
      cookies: mockCookies,
      currentDomain: "example.com",
      onUpdate: mockOnUpdate,
      onMessage: mockOnMessage,
    });
    expandDomainGroup("example.com");

    fireEvent.click(screen.getAllByLabelText("编辑")[0]);
    await waitFor(() => expect(screen.getByTestId("cookie-editor")).toBeTruthy());

    fireEvent.click(screen.getByTestId("close-editor"));
    expect(screen.queryByTestId("cookie-editor")).toBeNull();
  });

  it("should call onUpdate when cookie is saved", async () => {
    mockEditCookie.mockResolvedValueOnce(true);
    renderAndExpandCookieList(CookieList, {
      cookies: mockCookies,
      currentDomain: "example.com",
      onUpdate: mockOnUpdate,
      onMessage: mockOnMessage,
    });
    expandDomainGroup("example.com");

    fireEvent.click(screen.getAllByLabelText("编辑")[0]);
    await waitFor(() => expect(screen.getByTestId("cookie-editor")).toBeTruthy());

    fireEvent.click(screen.getByTestId("save-editor"));
    await waitFor(() => expect(mockOnUpdate).toHaveBeenCalled());
  });

  it("should handle individual cookie selection", () => {
    renderAndExpandCookieList(CookieList, { cookies: mockCookies, currentDomain: "example.com" });
    expandDomainGroup("example.com");
    const checkboxes = screen.getAllByRole("checkbox");
    if (checkboxes.length > 1) {
      fireEvent.click(checkboxes[1]);
    }
    expect(screen.getByText(/已选择/)).toBeTruthy();
  });

  it("should call onUpdate after deleting cookie", async () => {
    mockClearSingleCookie.mockResolvedValueOnce(true);
    renderAndExpandCookieList(CookieList, {
      cookies: mockCookies,
      currentDomain: "example.com",
      onUpdate: mockOnUpdate,
      onMessage: mockOnMessage,
    });
    expandDomainGroup("example.com");

    fireEvent.click(screen.getAllByLabelText("删除")[0]);
    await waitFor(() => expect(screen.getByTestId("confirm-dialog")).toBeTruthy());
    fireEvent.click(screen.getByTestId("confirm-yes"));
    await waitFor(() => expect(mockOnUpdate).toHaveBeenCalled());
  });
});

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
  const { mockOnUpdate, mockOnMessage, mockOnAddToWhitelist, mockOnAddToBlacklist } = setupMocks();

  it("should render content component", () => {
    render(
      <CookieListContentWithConfirm
        cookies={mockCookies}
        currentDomain="example.com"
        onUpdate={mockOnUpdate}
        onMessage={mockOnMessage}
      />
    );
    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);
    expect(screen.getByText(/example\.com/)).toBeTruthy();
  });

  it("should show empty state", () => {
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
    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);
    expandDomainGroup("example.com");

    fireEvent.click(screen.getAllByLabelText("删除")[0]);
    await waitFor(() => expect(screen.getByTestId("confirm-dialog")).toBeTruthy());
    fireEvent.click(screen.getByTestId("confirm-yes"));
    await waitFor(() => expect(mockOnUpdate).toHaveBeenCalled());
  });

  it("should handle batch operations", () => {
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
    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);
    const selectAllCheckbox = screen.getByRole("checkbox", { name: /全选/ });
    fireEvent.click(selectAllCheckbox);
    expect(screen.getByText("删除选中")).toBeTruthy();
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
    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);
    const selectAllCheckbox = screen.getByRole("checkbox", { name: /全选/ });
    fireEvent.click(selectAllCheckbox);
    fireEvent.click(screen.getByText("加入白名单"));
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
    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);
    const selectAllCheckbox = screen.getByRole("checkbox", { name: /全选/ });
    fireEvent.click(selectAllCheckbox);
    fireEvent.click(screen.getByText("加入黑名单"));
    expect(mockOnAddToBlacklist).toHaveBeenCalledWith(["test.com"]);
  });
});

describe("CookieList additional regression tests", () => {
  const { mockOnUpdate, mockOnMessage, mockOnAddToWhitelist, mockOnAddToBlacklist } = setupMocks();

  it("should handle cookies with same name and domain but different paths separately", () => {
    const cookiesWithSameName = [
      {
        name: "session",
        value: "val1",
        domain: "example.com",
        path: "/",
        secure: true,
        httpOnly: false,
        sameSite: "lax" as const,
      },
      {
        name: "session",
        value: "val2",
        domain: "example.com",
        path: "/api",
        secure: true,
        httpOnly: false,
        sameSite: "lax" as const,
      },
    ];

    render(
      <CookieListContentWithConfirm
        cookies={cookiesWithSameName}
        currentDomain="example.com"
        onUpdate={mockOnUpdate}
        onMessage={mockOnMessage}
      />
    );
    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);
    expandDomainGroup("example.com");
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThan(2);
  });

  it("should recognize full cookie key for sensitive statistics", async () => {
    const { isSensitiveCookie } = await import("@/utils");
    (isSensitiveCookie as ReturnType<typeof vi.fn>).mockImplementation(
      (cookie: Cookie) => cookie.name === "sensitive"
    );

    const sensitiveCookies = [
      {
        name: "sensitive",
        value: "val",
        domain: "example.com",
        path: "/",
        secure: true,
        httpOnly: false,
        sameSite: "lax" as const,
      },
      {
        name: "normal",
        value: "val",
        domain: "example.com",
        path: "/api",
        secure: true,
        httpOnly: false,
        sameSite: "lax" as const,
      },
    ];

    mockClearSingleCookie.mockResolvedValue(true);

    render(
      <CookieListContentWithConfirm
        cookies={sensitiveCookies}
        currentDomain="example.com"
        onUpdate={mockOnUpdate}
        onMessage={mockOnMessage}
      />
    );
    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);
    expandDomainGroup("example.com");
    const selectAllCheckbox = screen.getByRole("checkbox", { name: /全选/ });
    fireEvent.click(selectAllCheckbox);
    fireEvent.click(screen.getByText("删除选中"));
    await waitFor(() => expect(screen.getByTestId("confirm-dialog")).toBeTruthy());
  });

  it("should use cookieEditor.createFailed in catch branch", async () => {
    mockCreateCookie.mockRejectedValueOnce(new Error("Failed"));
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
    const createButton = screen.getByText(/创建 Cookie|新建 Cookie/);
    fireEvent.click(createButton);
    await waitFor(() => expect(screen.getByTestId("cookie-editor")).toBeTruthy());
    fireEvent.click(screen.getByTestId("save-editor"));
    await waitFor(() => expect(mockOnMessage).toHaveBeenCalled());
  });

  it("should display mapped sameSite values", () => {
    const cookiesWithNoRestriction = [
      {
        ...mockCookies[0],
        sameSite: "no_restriction" as const,
      },
    ];
    render(<CookieList cookies={cookiesWithNoRestriction} currentDomain="example.com" />);
    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);
    expect(screen.queryByText("no_restriction")).toBeNull();
  });

  it("should handle delete cookie with failure", async () => {
    mockClearSingleCookie.mockResolvedValueOnce(false);
    render(
      <CookieListContentWithConfirm
        cookies={mockCookies}
        currentDomain="example.com"
        onUpdate={mockOnUpdate}
        onMessage={mockOnMessage}
      />
    );
    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);
    expandDomainGroup("example.com");
    fireEvent.click(screen.getAllByLabelText("删除")[0]);
    await waitFor(() => expect(screen.getByTestId("confirm-dialog")).toBeTruthy());
    fireEvent.click(screen.getByTestId("confirm-yes"));
    await waitFor(() => expect(mockOnMessage).toHaveBeenCalled());
  });

  it("should handle delete cookie with exception", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockClearSingleCookie.mockRejectedValueOnce(new Error("Delete failed"));
    render(
      <CookieListContentWithConfirm
        cookies={mockCookies}
        currentDomain="example.com"
        onUpdate={mockOnUpdate}
        onMessage={mockOnMessage}
      />
    );
    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);
    expandDomainGroup("example.com");
    fireEvent.click(screen.getAllByLabelText("删除")[0]);
    await waitFor(() => expect(screen.getByTestId("confirm-dialog")).toBeTruthy());
    fireEvent.click(screen.getByTestId("confirm-yes"));
    await waitFor(() => expect(mockOnMessage).toHaveBeenCalled());
    consoleErrorSpy.mockRestore();
  });

  it("should handle edit cookie with failure", async () => {
    mockEditCookie.mockResolvedValueOnce(false);
    render(
      <CookieListContentWithConfirm
        cookies={mockCookies}
        currentDomain="example.com"
        onUpdate={mockOnUpdate}
        onMessage={mockOnMessage}
      />
    );
    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);
    expandDomainGroup("example.com");
    fireEvent.click(screen.getAllByLabelText("编辑")[0]);
    await waitFor(() => expect(screen.getByTestId("cookie-editor")).toBeTruthy());
    fireEvent.click(screen.getByTestId("save-editor"));
    await waitFor(() => expect(mockOnMessage).toHaveBeenCalled());
  });

  it("should handle edit cookie with exception", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockEditCookie.mockRejectedValueOnce(new Error("Edit failed"));
    render(
      <CookieListContentWithConfirm
        cookies={mockCookies}
        currentDomain="example.com"
        onUpdate={mockOnUpdate}
        onMessage={mockOnMessage}
      />
    );
    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);
    expandDomainGroup("example.com");
    fireEvent.click(screen.getAllByLabelText("编辑")[0]);
    await waitFor(() => expect(screen.getByTestId("cookie-editor")).toBeTruthy());
    fireEvent.click(screen.getByTestId("save-editor"));
    await waitFor(() => expect(mockOnMessage).toHaveBeenCalled());
    consoleErrorSpy.mockRestore();
  });

  it("should handle create cookie with failure", async () => {
    mockCreateCookie.mockResolvedValueOnce(false);
    render(
      <CookieListContentWithConfirm
        cookies={[]}
        currentDomain="example.com"
        onUpdate={mockOnUpdate}
        onMessage={mockOnMessage}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /创建 Cookie/ }));
    await waitFor(() => expect(screen.getByTestId("cookie-editor")).toBeTruthy());
    fireEvent.click(screen.getByTestId("save-editor"));
    await waitFor(() => expect(mockOnMessage).toHaveBeenCalled());
  });

  it("should handle create cookie with exception", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreateCookie.mockRejectedValueOnce(new Error("Create failed"));
    render(
      <CookieListContentWithConfirm
        cookies={[]}
        currentDomain="example.com"
        onUpdate={mockOnUpdate}
        onMessage={mockOnMessage}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /创建 Cookie/ }));
    await waitFor(() => expect(screen.getByTestId("cookie-editor")).toBeTruthy());
    fireEvent.click(screen.getByTestId("save-editor"));
    await waitFor(() => expect(mockOnMessage).toHaveBeenCalled());
    consoleErrorSpy.mockRestore();
  });

  it("should handle delete selected with some failures", async () => {
    mockClearSingleCookie
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error("Failed"));
    render(
      <CookieListContentWithConfirm
        cookies={mockCookies}
        currentDomain="example.com"
        onUpdate={mockOnUpdate}
        onMessage={mockOnMessage}
      />
    );
    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);
    const selectAllCheckbox = screen.getByRole("checkbox", { name: /全选/ });
    fireEvent.click(selectAllCheckbox);
    fireEvent.click(screen.getByText("删除选中"));
    await waitFor(() => expect(screen.getByTestId("confirm-dialog")).toBeTruthy());
    fireEvent.click(screen.getByTestId("confirm-yes"));
    await waitFor(() => expect(mockOnMessage).toHaveBeenCalled());
  });

  it("should handle sensitive cookie in delete selected", async () => {
    const { isSensitiveCookie } = await import("@/utils");
    (isSensitiveCookie as ReturnType<typeof vi.fn>).mockImplementation(
      (cookie: Cookie) => cookie.name === "sensitive"
    );

    const sensitiveCookies = [
      {
        name: "sensitive",
        value: "val",
        domain: "example.com",
        path: "/",
        secure: true,
        httpOnly: false,
        sameSite: "lax" as const,
      },
    ];

    mockClearSingleCookie.mockResolvedValue(true);
    render(
      <CookieListContentWithConfirm
        cookies={sensitiveCookies}
        currentDomain="example.com"
        onUpdate={mockOnUpdate}
        onMessage={mockOnMessage}
      />
    );
    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);
    expandDomainGroup("example.com");
    const selectAllCheckbox = screen.getByRole("checkbox", { name: /全选/ });
    fireEvent.click(selectAllCheckbox);
    fireEvent.click(screen.getByText("删除选中"));
    await waitFor(() => expect(screen.getByTestId("confirm-dialog")).toBeTruthy());
  });

  it("should filter redundant domains when adding to whitelist", () => {
    const domainsWithRedundancy = [
      {
        name: "cookie1",
        value: "val",
        domain: "example.com",
        path: "/",
        secure: true,
        httpOnly: false,
        sameSite: "lax" as const,
      },
      {
        name: "cookie2",
        value: "val",
        domain: "sub.example.com",
        path: "/",
        secure: true,
        httpOnly: false,
        sameSite: "lax" as const,
      },
    ];
    render(
      <CookieListContentWithConfirm
        cookies={domainsWithRedundancy}
        currentDomain="example.com"
        onUpdate={mockOnUpdate}
        onMessage={mockOnMessage}
        whitelist={[]}
        blacklist={[]}
        onAddToWhitelist={mockOnAddToWhitelist}
      />
    );
    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);
    const selectAllCheckbox = screen.getByRole("checkbox", { name: /全选/ });
    fireEvent.click(selectAllCheckbox);
    fireEvent.click(screen.getByText("加入白名单"));
    expect(mockOnAddToWhitelist).toHaveBeenCalledWith(["example.com"]);
  });

  it("should filter redundant domains when adding to blacklist", () => {
    const domainsWithRedundancy = [
      {
        name: "cookie1",
        value: "val",
        domain: "example.com",
        path: "/",
        secure: true,
        httpOnly: false,
        sameSite: "lax" as const,
      },
      {
        name: "cookie2",
        value: "val",
        domain: "sub.example.com",
        path: "/",
        secure: true,
        httpOnly: false,
        sameSite: "lax" as const,
      },
    ];
    render(
      <CookieListContentWithConfirm
        cookies={domainsWithRedundancy}
        currentDomain="example.com"
        onUpdate={mockOnUpdate}
        onMessage={mockOnMessage}
        whitelist={[]}
        blacklist={[]}
        onAddToBlacklist={mockOnAddToBlacklist}
      />
    );
    const headerButton = screen.getByRole("button", { name: /Cookie 详情/ });
    fireEvent.click(headerButton);
    const selectAllCheckbox = screen.getByRole("checkbox", { name: /全选/ });
    fireEvent.click(selectAllCheckbox);
    fireEvent.click(screen.getByText("加入黑名单"));
    expect(mockOnAddToBlacklist).toHaveBeenCalledWith(["example.com"]);
  });
});
