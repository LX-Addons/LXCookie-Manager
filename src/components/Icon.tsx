import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Cookie,
  Edit3,
  Eye,
  EyeOff,
  Info,
  MoreHorizontal,
  Plus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Trash2,
  X,
  Clock,
  Filter,
  Search,
  Settings,
  List,
  Ban,
  CheckCircle2,
  XCircle,
  Loader2,
  Globe,
  Lock,
  Unlock,
  ExternalLink,
  Copy,
  Download,
  Upload,
  RefreshCw,
  Sun,
  Moon,
  Monitor,
  Palette,
  Save,
  FileText,
  Type,
  FileDown,
  FileUp,
  Eraser,
} from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";

export type IconName =
  | "alertCircle"
  | "alertTriangle"
  | "check"
  | "chevronDown"
  | "chevronRight"
  | "cookie"
  | "edit"
  | "eye"
  | "eyeOff"
  | "info"
  | "moreHorizontal"
  | "plus"
  | "shield"
  | "shieldAlert"
  | "shieldCheck"
  | "shieldOff"
  | "trash"
  | "x"
  | "clock"
  | "filter"
  | "search"
  | "settings"
  | "list"
  | "ban"
  | "checkCircle"
  | "xCircle"
  | "loader"
  | "globe"
  | "lock"
  | "unlock"
  | "externalLink"
  | "copy"
  | "download"
  | "upload"
  | "refresh"
  | "sun"
  | "moon"
  | "monitor"
  | "palette"
  | "save"
  | "fileText"
  | "type"
  | "fileDown"
  | "fileUp"
  | "eraser";

const iconMap: Record<IconName, LucideIcon> = {
  alertCircle: AlertCircle,
  alertTriangle: AlertTriangle,
  check: Check,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
  cookie: Cookie,
  edit: Edit3,
  eye: Eye,
  eyeOff: EyeOff,
  info: Info,
  moreHorizontal: MoreHorizontal,
  plus: Plus,
  shield: Shield,
  shieldAlert: ShieldAlert,
  shieldCheck: ShieldCheck,
  shieldOff: ShieldOff,
  trash: Trash2,
  x: X,
  clock: Clock,
  filter: Filter,
  search: Search,
  settings: Settings,
  list: List,
  ban: Ban,
  checkCircle: CheckCircle2,
  xCircle: XCircle,
  loader: Loader2,
  globe: Globe,
  lock: Lock,
  unlock: Unlock,
  externalLink: ExternalLink,
  copy: Copy,
  download: Download,
  upload: Upload,
  refresh: RefreshCw,
  sun: Sun,
  moon: Moon,
  monitor: Monitor,
  palette: Palette,
  save: Save,
  fileText: FileText,
  type: Type,
  fileDown: FileDown,
  fileUp: FileUp,
  eraser: Eraser,
};

export interface IconProps extends ComponentPropsWithoutRef<"svg"> {
  readonly name: IconName;
  readonly size?: number;
}

export function Icon({
  name,
  size = 16,
  className,
  "aria-hidden": ariaHidden,
  ...props
}: IconProps) {
  const IconComponent = iconMap[name];
  return (
    <IconComponent size={size} className={className} aria-hidden={ariaHidden ?? true} {...props} />
  );
}
