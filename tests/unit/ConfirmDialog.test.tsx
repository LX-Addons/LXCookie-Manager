import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "common.confirm": "确定",
        "common.cancel": "取消",
      })[key] ?? key,
  }),
}));

describe("ConfirmDialog", () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    mockOnConfirm.mockClear();
    mockOnCancel.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should not be open when isOpen is false", () => {
    render(
      <ConfirmDialog
        isOpen={false}
        title="Test Title"
        message="Test Message"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const dialog = document.querySelector(".confirm-modal") as HTMLDialogElement;
    expect(dialog).not.toBeNull();
    expect(dialog.open).toBe(false);
  });

  it("should render with default props", () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test Title"
        message="Test Message"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText("Test Title")).toBeTruthy();
    expect(screen.getByText("Test Message")).toBeTruthy();
    expect(screen.getByRole("button", { name: "确定" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "取消" })).toBeTruthy();
  });

  it("should render with custom button text", () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test Title"
        message="Test Message"
        confirmText="删除"
        cancelText="返回"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText("删除")).toBeTruthy();
    expect(screen.getByText("返回")).toBeTruthy();
  });

  it("should call onConfirm when confirm button is clicked", () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test Title"
        message="Test Message"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "确定" }));
    expect(mockOnConfirm).toHaveBeenCalledOnce();
  });

  it("should call onCancel when cancel button is clicked", () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test Title"
        message="Test Message"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(mockOnCancel).toHaveBeenCalledOnce();
  });

  it("should call onCancel when overlay is clicked", () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test Title"
        message="Test Message"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const dialog = document.querySelector(".confirm-modal");
    expect(dialog).not.toBeNull();
    fireEvent.click(dialog as HTMLDivElement);
    expect(mockOnCancel).toHaveBeenCalledOnce();
  });

  it("should not call onCancel when dialog content is clicked", () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test Title"
        message="Test Message"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const modalBody = document.querySelector(".modal-body");
    expect(modalBody).not.toBeNull();
    fireEvent.click(modalBody as HTMLDivElement);
    expect(mockOnCancel).not.toHaveBeenCalled();
  });

  it("should call onCancel when dialog is closed via Escape", () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test Title"
        message="Test Message"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const dialog = document.querySelector(".confirm-modal") as HTMLDialogElement;
    expect(dialog).not.toBeNull();
    expect(dialog.open).toBe(true);

    fireEvent(dialog, new Event("close"));
    expect(mockOnCancel).toHaveBeenCalledOnce();
  });

  it("should not call onCancel when other keys are pressed", () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test Title"
        message="Test Message"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.keyDown(document, { key: "Enter" });
    expect(mockOnCancel).not.toHaveBeenCalled();
  });

  it("should not respond to Escape key when dialog is closed", () => {
    render(
      <ConfirmDialog
        isOpen={false}
        title="Test Title"
        message="Test Message"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(mockOnCancel).not.toHaveBeenCalled();
  });

  it("should render with danger variant", () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test Title"
        message="Test Message"
        variant="danger"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const icon = document.querySelector(".modal-icon");
    expect(icon?.className).toContain("danger");
  });

  it("should have correct dialog attributes", () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test Title"
        message="Test Message"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
  });
});
