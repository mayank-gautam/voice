import { AlertCircle, AlertTriangle, Bell, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";
import { formatDistanceToNow } from "date-fns";

interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  timestamp: string;
  status: 'active' | 'acknowledged' | 'resolved';
}

interface AlertsPanelProps {
  alerts: Alert[];
  className?: string;
  maxItems?: number;
}

const severityConfig = {
  critical: {
    icon: AlertCircle,
    className: 'border-destructive/30 bg-destructive/5',
    iconClass: 'text-destructive',
  },
  warning: {
    icon: AlertTriangle,
    className: 'border-warning/30 bg-warning/5',
    iconClass: 'text-warning',
  },
  info: {
    icon: Info,
    className: 'border-info/30 bg-info/5',
    iconClass: 'text-info',
  },
};

export const AlertsPanel = ({ alerts, className, maxItems = 5 }: AlertsPanelProps) => {
  const displayAlerts = alerts.slice(0, maxItems);
  const activeCount = alerts.filter(a => a.status === 'active').length;

  return (
    <div className={cn("glass-card border border-border/50 rounded-xl", className)}>
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Active Alerts</h3>
          {activeCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-destructive/20 text-destructive rounded-full">
              {activeCount}
            </span>
          )}
        </div>
      </div>
      <div className="divide-y divide-border/30">
        {displayAlerts.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No active alerts</p>
          </div>
        ) : (
          displayAlerts.map((alert) => {
            const config = severityConfig[alert.severity];
            const Icon = config.icon;
            
            return (
              <div
                key={alert.id}
                className={cn(
                  "p-4 border-l-2 transition-colors hover:bg-muted/30",
                  alert.severity === 'critical' && "border-l-destructive",
                  alert.severity === 'warning' && "border-l-warning",
                  alert.severity === 'info' && "border-l-info"
                )}
              >
                <div className="flex items-start gap-3">
                  <Icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", config.iconClass)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium truncate">{alert.title}</p>
                      <StatusBadge status={alert.status} size="sm" />
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {alert.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
