import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  Bell,
  Clock,
  Columns3,
  Filter,
  Layers,
  LayoutGrid,
  List,
  Lock,
  PenLine,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type FeatureIconName =
  | "bolt"
  | "target"
  | "shield"
  | "spark"
  | "sparkle"
  | "pencil"
  | "list"
  | "columns"
  | "bell"
  | "chart"
  | "funnel"
  | "clock"
  | "layers"
  | "lock"
  | "swap"
  | "grid"
  | "activity";

const ICONS: Record<FeatureIconName, LucideIcon> = {
  bolt: Zap,
  target: Target,
  shield: ShieldCheck,
  spark: Sparkles,
  sparkle: Sparkles,
  pencil: PenLine,
  list: List,
  columns: Columns3,
  bell: Bell,
  chart: BarChart3,
  funnel: Filter,
  clock: Clock,
  layers: Layers,
  lock: Lock,
  swap: ArrowLeftRight,
  grid: LayoutGrid,
  activity: Activity,
};

interface FeatureIconProps {
  name: FeatureIconName;
  className?: string;
}

export function FeatureIcon({ name, className }: FeatureIconProps) {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon size={22} strokeWidth={1.8} className={className} aria-hidden="true" />;
}
