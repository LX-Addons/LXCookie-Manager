import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";

describe("useConfirmDialog", () => {
  it("should initialize with closed state", () => {
    const { result } = renderHook(() => useConfirmDialog());

    expect(result.current.confirmState.isOpen).toBe(false);
    expect(result.current.confirmState.title).toBe("");
    expect(result.current.confirmState.message).toBe("");
    expect(result.current.confirmState.variant).toBe("warning");
  });

  it("should show confirm dialog with correct parameters", () => {
    const { result } = renderHook(() => useConfirmDialog());
    const mockOnConfirm = () => {};

    act(() => {
      result.current.showConfirm("Test Title", "Test Message", "danger", mockOnConfirm);
    });

    expect(result.current.confirmState.isOpen).toBe(true);
    expect(result.current.confirmState.title).toBe("Test Title");
    expect(result.current.confirmState.message).toBe("Test Message");
    expect(result.current.confirmState.variant).toBe("danger");
  });

  it("should close confirm dialog", () => {
    const { result } = renderHook(() => useConfirmDialog());
    const mockOnConfirm = () => {};

    act(() => {
      result.current.showConfirm("Title", "Message", "warning", mockOnConfirm);
    });
    expect(result.current.confirmState.isOpen).toBe(true);

    act(() => {
      result.current.closeConfirm();
    });
    expect(result.current.confirmState.isOpen).toBe(false);
  });

  it("should call onConfirm when handleConfirm is called", () => {
    const { result } = renderHook(() => useConfirmDialog());
    let confirmed = false;
    const mockOnConfirm = () => {
      confirmed = true;
    };

    act(() => {
      result.current.showConfirm("Title", "Message", "warning", mockOnConfirm);
    });

    act(() => {
      result.current.handleConfirm();
    });

    expect(confirmed).toBe(true);
    expect(result.current.confirmState.isOpen).toBe(false);
  });

  it("should update confirm state when showConfirm is called multiple times", () => {
    const { result } = renderHook(() => useConfirmDialog());

    act(() => {
      result.current.showConfirm("First Title", "First Message", "warning", () => {});
    });
    expect(result.current.confirmState.title).toBe("First Title");

    act(() => {
      result.current.showConfirm("Second Title", "Second Message", "danger", () => {});
    });
    expect(result.current.confirmState.title).toBe("Second Title");
    expect(result.current.confirmState.variant).toBe("danger");
  });
});
