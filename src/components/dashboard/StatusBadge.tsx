import { cn } from "@/lib/utils";

type Status = 'healthy' | 'warning' | 'critical' | 'unknown' | 'completed' | 'failed' | 'dropped' | 'escalated' | 'active' | 'acknowledged' | 'resolved';

interface StatusBadgeProps {
  status: Status;
  pulse?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

const statusConfig: Record<Status, { label: string; className: string }> = {
  healthy: { label: 'Healthy', className: 'bg-success/20 text-success border-success/30' },
  warning: { label: 'Warning', className: 'bg-warning/20 text-warning border-warning/30' },
  critical: { label: 'Critical', className: 'bg-destructive/20 text-destructive border-destructive/30' },
  unknown: { label: 'Unknown', className: 'bg-muted text-muted-foreground border-border' },
  completed: { label: 'Completed', className: 'bg-success/20 text-success border-success/30' },
  failed: { label: 'Failed', className: 'bg-destructive/20 text-destructive border-destructive/30' },
  dropped: { label: 'Dropped', className: 'bg-warning/20 text-warning border-warning/30' },
  escalated: { label: 'Escalated', className: 'bg-info/20 text-info border-info/30' },
  active: { label: 'Active', className: 'bg-info/20 text-info border-info/30' },
  acknowledged: { label: 'Acknowledged', className: 'bg-warning/20 text-warning border-warning/30' },
  resolved: { label: 'Resolved', className: 'bg-success/20 text-success border-success/30' },
};

export const StatusBadge = ({ status, pulse = false, size = 'sm', className }: StatusBadgeProps) => {
  const config = statusConfig[status] || statusConfig.unknown;
  
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border rounded-full font-medium",
        size === 'sm' ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
        config.className,
        className
      )}
    >
      {pulse && (
        <span className={cn(
          "w-1.5 h-1.5 rounded-full animate-pulse",
          status === 'healthy' || status === 'completed' || status === 'resolved' ? "bg-success" :
          status === 'warning' || status === 'dropped' || status === 'acknowledged' ? "bg-warning" :
          status === 'critical' || status === 'failed' ? "bg-destructive" :
          status === 'active' || status === 'escalated' ? "bg-info" :
          "bg-info"
        )} />
      )}
      {config.label}
    </span>
  );
};
