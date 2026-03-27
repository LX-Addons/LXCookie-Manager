import { Icon } from "./Icon";
import type { ReactNode } from "react";

export type StatusPanelVariant = "error" | "warning" | "info" | "empty" | "loading";

interface StatusPanelProps {
  readonly variant: StatusPanelVariant;
  readonly title?: string;
  readonly message?: string;
  readonly icon?: ReactNode;
  readonly action?: ReactNode;
  readonly className?: string;
}

const variantConfig: Record<
  StatusPanelVariant,
  {
    icon: ReactNode;
    iconClass: string;
    wrapperClass: string;
  }
> = {
  error: {
    icon: <Icon name="alertTriangle" size={24} />,
    iconClass: "status-panel-icon--error",
    wrapperClass: "status-panel--error",
  },
  warning: {
    icon: <Icon name="alertCircle" size={24} />,
    iconClass: "status-panel-icon--warning",
    wrapperClass: "status-panel--warning",
  },
  info: {
    icon: <Icon name="cookie" size={24} />,
    iconClass: "status-panel-icon--info",
    wrapperClass: "status-panel--info",
  },
  empty: {
    icon: <Icon name="info" size={24} />,
    iconClass: "status-panel-icon--empty",
    wrapperClass: "status-panel--empty",
  },
  loading: {
    icon: <Icon name="refresh" size={24} className="status-panel-spinner" />,
    iconClass: "status-panel-icon--loading",
    wrapperClass: "status-panel--loading",
  },
};

export function StatusPanel({
  variant,
  title,
  message,
  icon,
  action,
  className = "",
}: StatusPanelProps) {
  const config = variantConfig[variant];

  return (
    <div className={`status-panel ${config.wrapperClass} ${className}`.trim()}>
      <div className={`status-panel-icon ${config.iconClass}`}>{icon || config.icon}</div>
      {title && <h2 className="status-panel-title">{title}</h2>}
      {message && <p className="status-panel-message">{message}</p>}
      {action && <div className="status-panel-action">{action}</div>}
    </div>
  );
}
