import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CookieEditor } from "@/components/CookieEditor";
import type { Cookie } from "@/types";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      const translations: Record<string, string> = {
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
        "common.cancel": "取消",
        "common.save": "保存",
        "common.saving": "保存中…",
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

const mockCookie: Cookie = {
  name: "test",
  value: "value123",
  domain: ".example.com",
  path: "/test",
  secure: true,
  httpOnly: false,
  sameSite: "lax" as const,
  expirationDate: 1234567890,
};

const setupMocks = () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();
  return { mockOnClose, mockOnSave };
};

const renderCookieEditor = (
  isOpen: boolean = true,
  cookie: Cookie | null = null,
  currentDomain?: string,
  onClose?: () => void,
  onSave?: (cookie: Cookie) => Promise<boolean>
) => {
  const { mockOnClose, mockOnSave } = setupMocks();
  const result = render(
    <CookieEditor
      isOpen={isOpen}
      cookie={cookie}
      currentDomain={currentDomain}
      onClose={onClose || mockOnClose}
      onSave={onSave || mockOnSave}
    />
  );
  return { ...result, mockOnClose: onClose || mockOnClose, mockOnSave: onSave || mockOnSave };
};

const testInputUpdate = (
  getElement: () => HTMLElement,
  newValue: string,
  cookie: Cookie | null = null
) => {
  renderCookieEditor(true, cookie);
  const element = getElement();
  fireEvent.change(element, { target: { value: newValue } });
  expect((element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value).toBe(
    newValue
  );
};

const submitForm = () => {
  const form = document.querySelector("form");
  if (form) {
    fireEvent.submit(form);
  }
};

const createDelayedOnSave = (delay: number = 100, success: boolean = true) => {
  return vi.fn().mockImplementation(
    () =>
      new Promise((resolve) => {
        setTimeout(() => resolve(success), delay);
      })
  );
};

const waitForSaving = async () => {
  await waitFor(() => {
    expect(screen.getByText("保存中…")).toBeTruthy();
  });
};

describe("CookieEditor", () => {
  it("should not render when isOpen is false", () => {
    renderCookieEditor(false);
    expect(screen.queryByText("新建 Cookie")).toBeNull();
  });

  it("should render new cookie editor when cookie is null", () => {
    renderCookieEditor(true, null);
    expect(screen.getByText("新建 Cookie")).toBeTruthy();
  });

  it("should render edit cookie editor with existing cookie", () => {
    renderCookieEditor(true, mockCookie);
    expect(screen.getByText("编辑 Cookie")).toBeTruthy();
  });

  it("should call onClose when cancel button is clicked", () => {
    const { mockOnClose } = renderCookieEditor();
    fireEvent.click(screen.getByText("取消"));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("should stop propagation when dialog is clicked", () => {
    const { mockOnClose } = renderCookieEditor();
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it("should call onSave and onClose when save button is clicked", async () => {
    const mockOnSave = vi.fn().mockResolvedValue(true);
    const { mockOnClose } = renderCookieEditor(true, mockCookie, undefined, undefined, mockOnSave);
    submitForm();
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it("should update name field when input changes", () => {
    testInputUpdate(() => screen.getAllByRole("textbox")[0], "newName");
  });

  it("should update value field when textarea changes", () => {
    testInputUpdate(() => document.querySelector("textarea") as HTMLTextAreaElement, "newValue");
  });

  it("should update domain field when input changes", () => {
    testInputUpdate(() => screen.getAllByRole("textbox")[2], "newdomain.com");
  });

  it("should update path field when input changes", () => {
    testInputUpdate(() => screen.getAllByRole("textbox")[3], "/newpath");
  });

  it("should update expiration date when input changes", () => {
    testInputUpdate(() => screen.getByRole("spinbutton"), "9999999999");
  });

  it("should clear expiration date when input is emptied", () => {
    testInputUpdate(() => screen.getByRole("spinbutton"), "", mockCookie);
  });

  it("should update sameSite when select changes", () => {
    testInputUpdate(() => screen.getByRole("combobox"), "strict");
  });

  it("should toggle secure checkbox", () => {
    renderCookieEditor();
    const checkboxes = screen.getAllByRole("checkbox");
    const secureCheckbox = checkboxes[0] as HTMLInputElement;
    expect(secureCheckbox.checked).toBe(false);
    fireEvent.click(secureCheckbox);
    expect(secureCheckbox.checked).toBe(true);
  });

  it("should toggle httpOnly checkbox", () => {
    renderCookieEditor();
    const checkboxes = screen.getAllByRole("checkbox");
    const httpOnlyCheckbox = checkboxes[1] as HTMLInputElement;
    expect(httpOnlyCheckbox.checked).toBe(false);
    fireEvent.click(httpOnlyCheckbox);
    expect(httpOnlyCheckbox.checked).toBe(true);
  });

  it("should call onClose when overlay is clicked", () => {
    const { mockOnClose } = renderCookieEditor();
    const overlay = document.querySelector(".confirm-overlay");
    if (overlay) {
      fireEvent.click(overlay);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it("should close on Escape key press", () => {
    const { mockOnClose } = renderCookieEditor();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("should update form data when cookie prop changes", () => {
    const { rerender } = renderCookieEditor(true, null);
    rerender(<CookieEditor isOpen={true} cookie={mockCookie} onClose={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByText("编辑 Cookie")).toBeTruthy();
  });

  it("should not close editor when save fails", async () => {
    const mockOnSave = vi.fn().mockResolvedValue(false);
    const { mockOnClose } = renderCookieEditor(true, mockCookie, undefined, undefined, mockOnSave);
    submitForm();
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled();
    });
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it("should show none for sameSite value no_restriction in edit mode", () => {
    const cookieWithNoRestriction = {
      ...mockCookie,
      sameSite: "no_restriction" as const,
    };
    renderCookieEditor(true, cookieWithNoRestriction);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("none");
  });

  it("should have name/domain/path inputs disabled in edit mode", () => {
    renderCookieEditor(true, mockCookie);
    const inputs = screen.getAllByRole("textbox");
    const nameInput = inputs[0] as HTMLInputElement;
    const domainInput = inputs[2] as HTMLInputElement;
    const pathInput = inputs[3] as HTMLInputElement;
    expect(nameInput.disabled).toBe(true);
    expect(domainInput.disabled).toBe(true);
    expect(pathInput.disabled).toBe(true);
  });

  it("should have save button disabled when isSaving is true", async () => {
    const onSave = createDelayedOnSave();
    renderCookieEditor(true, mockCookie, undefined, undefined, onSave);
    const saveButton = screen.getByTestId("save-editor") as HTMLButtonElement;
    expect(saveButton.disabled).toBe(false);
    submitForm();
    await waitFor(() => {
      expect(saveButton.disabled).toBe(true);
    });
  });

  it("should show saving text when isSaving is true", async () => {
    const onSave = createDelayedOnSave();
    renderCookieEditor(true, mockCookie, undefined, undefined, onSave);
    const saveButton = screen.getByTestId("save-editor");
    expect(saveButton.textContent).toContain("保存");
    submitForm();
    await waitFor(() => {
      expect(saveButton.textContent).toContain("保存中…");
    });
  });

  it("should use currentDomain as default domain for new cookie", () => {
    renderCookieEditor(true, null, "example.com");
    const inputs = screen.getAllByRole("textbox");
    const domainInput = inputs[2] as HTMLInputElement;
    expect(domainInput.value).toBe("example.com");
  });

  it("should not close when escape key is pressed while saving", async () => {
    const mockOnClose = vi.fn();
    const onSave = createDelayedOnSave();
    renderCookieEditor(true, mockCookie, undefined, mockOnClose, onSave);
    submitForm();
    await waitForSaving();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it("should not close when overlay is clicked while saving", async () => {
    const mockOnClose = vi.fn();
    const onSave = createDelayedOnSave();
    renderCookieEditor(true, mockCookie, undefined, mockOnClose, onSave);
    submitForm();
    await waitForSaving();
    const overlay = document.querySelector(".confirm-overlay");
    if (overlay) {
      fireEvent.click(overlay);
      expect(mockOnClose).not.toHaveBeenCalled();
    }
  });
});
