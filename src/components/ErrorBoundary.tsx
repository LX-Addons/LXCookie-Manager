import { Component, ErrorInfo, ReactNode } from "react";
import { useTranslation } from "@/hooks/useTranslation";

interface Props {
  children: ReactNode;
}

export interface State {
  hasError: boolean;
  error: Error | null;
}

function ErrorBoundaryContent({
  hasError,
  error,
  onRetry,
}: {
  hasError: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  const { t } = useTranslation();

  if (hasError) {
    return (
      <div className="error-boundary" role="alert">
        <h2>
          <span aria-hidden="true">⚠️</span> {t("errorBoundary.error")}
        </h2>
        <p>{error?.message || t("errorBoundary.errorMessage")}</p>
        <button onClick={onRetry} aria-label={t("errorBoundary.retry")}>
          {t("errorBoundary.retry")}
        </button>
      </div>
    );
  }

  return null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorBoundaryContent
          hasError={this.state.hasError}
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}
