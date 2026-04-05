import { Component, ErrorInfo, ReactNode } from "react";
import { useTranslation } from "@/hooks";
import { Icon } from "./Icon";

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
  readonly hasError: boolean;
  readonly error: Error | null;
  readonly onRetry: () => void;
}) {
  const { t } = useTranslation();

  if (hasError) {
    return (
      <div className="error-panel panel" role="alert">
        <div className="error-icon-wrapper">
          <Icon name="alertCircle" size={24} className="error-icon" />
        </div>
        <h3 className="error-title">{t("errorBoundary.error")}</h3>
        <p className="error-message">{error?.message || t("errorBoundary.errorMessage")}</p>
        <button
          type="button"
          onClick={onRetry}
          className="btn btn-primary"
          aria-label={t("errorBoundary.retry")}
        >
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
