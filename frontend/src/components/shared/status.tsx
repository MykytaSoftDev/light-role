import { Badge } from "@/components/ui/badge";

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  trialing: { label: "Trialing", className: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  canceled: { label: "Canceled", className: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20" },
  past_due: { label: "Past Due", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  paused: { label: "Paused", className: "bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/20" },
  completed: { label: "Completed", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  paid: { label: "Paid", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  billed: { label: "Billed", className: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20" },
};

interface Props {
  status: string;
}

export function Status({ status }: Props) {
  const config = statusConfig[status] ?? { label: status, className: "bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/20" };

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
