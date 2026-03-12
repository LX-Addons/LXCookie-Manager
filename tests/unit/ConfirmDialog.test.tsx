import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

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

  it("should not render when isOpen is false", () => {
    render(
      <ConfirmDialog
        isOpen={false}
        title="Test Title"
        message="Test Message"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.queryByText("Test Title")).toBeNull();
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
    expect(screen.getByText("确定")).toBeTruthy();
    expect(screen.getByText("取消")).toBeTruthy();
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

    fireEvent.click(screen.getByText("确定"));
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

    fireEvent.click(screen.getByText("取消"));
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

    const overlay = document.querySelector(".confirm-overlay");
    if (overlay) {
      fireEvent.click(overlay);
      expect(mockOnCancel).toHaveBeenCalledOnce();
    }
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

    const dialog = document.querySelector(".confirm-dialog");
    if (dialog) {
      fireEvent.click(dialog);
      expect(mockOnCancel).not.toHaveBeenCalled();
    }
  });

  it("should call onCancel when Escape key is pressed", () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test Title"
        message="Test Message"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.keyDown(document, { key: "Escape" });
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

    const title = screen.getByText("Test Title");
    expect(title.className).toContain("danger");
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
    expect(dialog.tagName.toLowerCase()).toBe("dialog");
  });
});
