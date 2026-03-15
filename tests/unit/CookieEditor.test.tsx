import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CookieEditor } from "@/components/CookieEditor";

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

const mockCookie = {
  name: "test",
  value: "value123",
  domain: ".example.com",
  path: "/test",
  secure: true,
  httpOnly: false,
  sameSite: "lax" as const,
  expirationDate: 1234567890,
};

describe("CookieEditor", () => {
  it("should not render when isOpen is false", () => {
    render(<CookieEditor isOpen={false} cookie={null} onClose={vi.fn()} onSave={vi.fn()} />);

    expect(screen.queryByText("新建 Cookie")).toBeNull();
  });

  it("should render new cookie editor when cookie is null", () => {
    render(<CookieEditor isOpen={true} cookie={null} onClose={vi.fn()} onSave={vi.fn()} />);

    expect(screen.getByText("新建 Cookie")).toBeTruthy();
  });

  it("should render edit cookie editor with existing cookie", () => {
    render(<CookieEditor isOpen={true} cookie={mockCookie} onClose={vi.fn()} onSave={vi.fn()} />);

    expect(screen.getByText("编辑 Cookie")).toBeTruthy();
  });

  it("should call onClose when cancel button is clicked", () => {
    const onClose = vi.fn();
    render(<CookieEditor isOpen={true} cookie={null} onClose={onClose} onSave={vi.fn()} />);

    fireEvent.click(screen.getByText("取消"));
    expect(onClose).toHaveBeenCalled();
  });

  it("should stop propagation when dialog is clicked", () => {
    const onClose = vi.fn();
    render(<CookieEditor isOpen={true} cookie={null} onClose={onClose} onSave={vi.fn()} />);

    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("should call onSave and onClose when save button is clicked", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();
    render(<CookieEditor isOpen={true} cookie={mockCookie} onClose={onClose} onSave={onSave} />);

    const form = document.querySelector("form");
    if (form) {
      fireEvent.submit(form);
    }

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("should update name field when input changes", () => {
    render(<CookieEditor isOpen={true} cookie={null} onClose={vi.fn()} onSave={vi.fn()} />);

    const inputs = screen.getAllByRole("textbox");
    const nameInput = inputs[0] as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "newName" } });

    expect(nameInput.value).toBe("newName");
  });

  it("should update value field when textarea changes", () => {
    render(<CookieEditor isOpen={true} cookie={null} onClose={vi.fn()} onSave={vi.fn()} />);

    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "newValue" } });

    expect(textarea.value).toBe("newValue");
  });

  it("should update domain field when input changes", () => {
    render(<CookieEditor isOpen={true} cookie={null} onClose={vi.fn()} onSave={vi.fn()} />);

    const inputs = screen.getAllByRole("textbox");
    const domainInput = inputs[2] as HTMLInputElement;
    fireEvent.change(domainInput, { target: { value: "newdomain.com" } });

    expect(domainInput.value).toBe("newdomain.com");
  });

  it("should update path field when input changes", () => {
    render(<CookieEditor isOpen={true} cookie={null} onClose={vi.fn()} onSave={vi.fn()} />);

    const inputs = screen.getAllByRole("textbox");
    const pathInput = inputs[3] as HTMLInputElement;
    fireEvent.change(pathInput, { target: { value: "/newpath" } });

    expect(pathInput.value).toBe("/newpath");
  });

  it("should update expiration date when input changes", () => {
    render(<CookieEditor isOpen={true} cookie={null} onClose={vi.fn()} onSave={vi.fn()} />);

    const numberInput = screen.getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(numberInput, { target: { value: "9999999999" } });

    expect(numberInput.value).toBe("9999999999");
  });

  it("should clear expiration date when input is emptied", () => {
    render(<CookieEditor isOpen={true} cookie={mockCookie} onClose={vi.fn()} onSave={vi.fn()} />);

    const numberInput = screen.getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(numberInput, { target: { value: "" } });

    expect(numberInput.value).toBe("");
  });

  it("should update sameSite when select changes", () => {
    render(<CookieEditor isOpen={true} cookie={null} onClose={vi.fn()} onSave={vi.fn()} />);

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "strict" } });

    expect(select.value).toBe("strict");
  });

  it("should toggle secure checkbox", () => {
    render(<CookieEditor isOpen={true} cookie={null} onClose={vi.fn()} onSave={vi.fn()} />);

    const checkboxes = screen.getAllByRole("checkbox");
    const secureCheckbox = checkboxes[0] as HTMLInputElement;

    expect(secureCheckbox.checked).toBe(false);
    fireEvent.click(secureCheckbox);
    expect(secureCheckbox.checked).toBe(true);
  });

  it("should toggle httpOnly checkbox", () => {
    render(<CookieEditor isOpen={true} cookie={null} onClose={vi.fn()} onSave={vi.fn()} />);

    const checkboxes = screen.getAllByRole("checkbox");
    const httpOnlyCheckbox = checkboxes[1] as HTMLInputElement;

    expect(httpOnlyCheckbox.checked).toBe(false);
    fireEvent.click(httpOnlyCheckbox);
    expect(httpOnlyCheckbox.checked).toBe(true);
  });

  it("should call onClose when overlay is clicked", () => {
    const onClose = vi.fn();
    render(<CookieEditor isOpen={true} cookie={null} onClose={onClose} onSave={vi.fn()} />);

    const overlay = document.querySelector(".confirm-overlay");
    if (overlay) {
      fireEvent.click(overlay);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it("should close on Escape key press", () => {
    const onClose = vi.fn();
    render(<CookieEditor isOpen={true} cookie={null} onClose={onClose} onSave={vi.fn()} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("should update form data when cookie prop changes", () => {
    const { rerender } = render(
      <CookieEditor isOpen={true} cookie={null} onClose={vi.fn()} onSave={vi.fn()} />
    );

    rerender(<CookieEditor isOpen={true} cookie={mockCookie} onClose={vi.fn()} onSave={vi.fn()} />);

    expect(screen.getByText("编辑 Cookie")).toBeTruthy();
  });

  it("should not close editor when save fails", async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    const onClose = vi.fn();
    render(<CookieEditor isOpen={true} cookie={mockCookie} onClose={onClose} onSave={onSave} />);

    const form = document.querySelector("form");
    if (form) {
      fireEvent.submit(form);
    }

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("should show none for sameSite value no_restriction in edit mode", () => {
    const cookieWithNoRestriction = {
      ...mockCookie,
      sameSite: "no_restriction" as const,
    };

    render(
      <CookieEditor
        isOpen={true}
        cookie={cookieWithNoRestriction}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("none");
  });

  it("should have name/domain/path inputs disabled in edit mode", () => {
    render(<CookieEditor isOpen={true} cookie={mockCookie} onClose={vi.fn()} onSave={vi.fn()} />);

    const inputs = screen.getAllByRole("textbox");
    const nameInput = inputs[0] as HTMLInputElement;
    const domainInput = inputs[2] as HTMLInputElement;
    const pathInput = inputs[3] as HTMLInputElement;

    expect(nameInput.disabled).toBe(true);
    expect(domainInput.disabled).toBe(true);
    expect(pathInput.disabled).toBe(true);
  });

  it("should have save button disabled when isSaving is true", async () => {
    const onSave = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(true), 100);
        })
    );
    render(<CookieEditor isOpen={true} cookie={mockCookie} onClose={vi.fn()} onSave={onSave} />);

    const saveButton = screen.getByTestId("save-editor") as HTMLButtonElement;
    expect(saveButton.disabled).toBe(false);

    const form = document.querySelector("form");
    if (form) {
      fireEvent.submit(form);
    }

    await waitFor(() => {
      expect(saveButton.disabled).toBe(true);
    });
  });

  it("should show saving text when isSaving is true", async () => {
    const onSave = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(true), 100);
        })
    );
    render(<CookieEditor isOpen={true} cookie={mockCookie} onClose={vi.fn()} onSave={onSave} />);

    const saveButton = screen.getByTestId("save-editor");
    expect(saveButton.textContent).toContain("保存");

    const form = document.querySelector("form");
    if (form) {
      fireEvent.submit(form);
    }

    await waitFor(() => {
      expect(saveButton.textContent).toContain("保存中…");
    });
  });

  it("should use currentDomain as default domain for new cookie", () => {
    render(
      <CookieEditor
        isOpen={true}
        cookie={null}
        currentDomain="example.com"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    const inputs = screen.getAllByRole("textbox");
    const domainInput = inputs[2] as HTMLInputElement;
    expect(domainInput.value).toBe("example.com");
  });

  it("should not close when escape key is pressed while saving", async () => {
    const onClose = vi.fn();
    const onSave = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(true), 100);
        })
    );
    render(<CookieEditor isOpen={true} cookie={mockCookie} onClose={onClose} onSave={onSave} />);

    const form = document.querySelector("form");
    if (form) {
      fireEvent.submit(form);
    }

    await waitFor(() => {
      expect(screen.getByText("保存中…")).toBeTruthy();
    });

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("should not close when overlay is clicked while saving", async () => {
    const onClose = vi.fn();
    const onSave = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(true), 100);
        })
    );
    render(<CookieEditor isOpen={true} cookie={mockCookie} onClose={onClose} onSave={onSave} />);

    const form = document.querySelector("form");
    if (form) {
      fireEvent.submit(form);
    }

    await waitFor(() => {
      expect(screen.getByText("保存中…")).toBeTruthy();
    });

    const overlay = document.querySelector(".confirm-overlay");
    if (overlay) {
      fireEvent.click(overlay);
      expect(onClose).not.toHaveBeenCalled();
    }
  });
});
