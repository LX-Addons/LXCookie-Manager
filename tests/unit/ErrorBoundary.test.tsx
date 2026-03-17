import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "errorBoundary.error": "出错了",
        "errorBoundary.errorMessage": "抱歉，扩展遇到了一个错误。请尝试重新加载。",
        "errorBoundary.retry": "重试",
      };
      return translations[key] || key;
    },
  }),
}));

const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <div>Normal content</div>;
};

describe("ErrorBoundary", () => {
  const originalError = console.error;

  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalError;
  });

  it("should render children when no error", () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText("Test content")).toBeTruthy();
  });

  it("should render error UI when error is thrown", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("出错了")).toBeTruthy();
    expect(screen.getByText("Test error")).toBeTruthy();
  });

  it("should render default message when error has no message", () => {
    const ThrowErrorNoMessage = () => {
      throw new Error();
    };

    render(
      <ErrorBoundary>
        <ThrowErrorNoMessage />
      </ErrorBoundary>
    );

    expect(screen.getByText(/抱歉，扩展遇到了一个错误/)).toBeTruthy();
  });

  it("should have correct aria attributes", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const alert = screen.getByRole("alert");
    expect(alert).toBeTruthy();
  });

  it("should call console.error when error is caught", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(console.error).toHaveBeenCalled();
  });

  it("should render retry button", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const retryButton = screen.getByText("重试");
    expect(retryButton).toBeTruthy();
  });

  it("should reset error state when retry button is clicked", () => {
    let shouldThrow = true;
    const ControlledComponent = () => {
      if (shouldThrow) {
        throw new Error("Test error");
      }
      return <div>Normal content</div>;
    };

    const { rerender } = render(
      <ErrorBoundary>
        <ControlledComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText("出错了")).toBeTruthy();

    shouldThrow = false;

    const retryButton = screen.getByText("重试");
    fireEvent.click(retryButton);

    rerender(
      <ErrorBoundary>
        <ControlledComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText("Normal content")).toBeTruthy();
  });

  it("should render error boundary with emoji icon", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toContainHTML("⚠️");
  });

  it("should handle error without stack trace", () => {
    const ThrowSimpleError = () => {
      throw new Error("Simple error");
    };

    render(
      <ErrorBoundary>
        <ThrowSimpleError />
      </ErrorBoundary>
    );

    expect(screen.getByText("Simple error")).toBeTruthy();
  });

  it("should handle multiple consecutive errors", () => {
    const AlwaysError = () => {
      throw new Error("Always errors");
    };

    const { rerender } = render(
      <ErrorBoundary>
        <AlwaysError />
      </ErrorBoundary>
    );

    expect(screen.getByText("出错了")).toBeTruthy();

    const retryButton = screen.getByText("重试");
    fireEvent.click(retryButton);

    rerender(
      <ErrorBoundary>
        <AlwaysError />
      </ErrorBoundary>
    );

    expect(screen.getByText("出错了")).toBeTruthy();
  });

  it("should handle error in nested children", () => {
    const NestedError = () => {
      throw new Error("Nested error");
    };

    render(
      <ErrorBoundary>
        <div>
          <NestedError />
        </div>
      </ErrorBoundary>
    );

    expect(screen.getByText("出错了")).toBeTruthy();
    expect(screen.getByText("Nested error")).toBeTruthy();
  });

  it("should have correct CSS class", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const errorBoundary = screen.getByRole("alert");
    expect(errorBoundary.classList.contains("error-boundary")).toBeTruthy();
  });
});
