import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
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

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary" role="alert">
          <h2>
            <span aria-hidden="true">⚠️</span> 出错了
          </h2>
          <p>{this.state.error?.message || "抱歉，扩展遇到了一个错误。请尝试重新加载。"}</p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
            }}
            aria-label="重试"
          >
            重试
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
