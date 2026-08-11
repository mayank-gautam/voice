import { cn } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";
import {
  Server,
  Database,
  Cloud,
  MessageSquare,
  Cpu,
  Activity,
  Zap,
  Phone,
} from "lucide-react";

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'warning' | 'critical';
  [key: string]: any;
}

interface SystemHealthGridProps {
  services: Record<string, ServiceHealth>;
  className?: string;
}

const serviceIcons: Record<string, any> = {
  appService: Server,
  functionApp: Zap,
  cosmosDb: Database,
  queue: Activity,
  azureStt: MessageSquare,
  azureTts: MessageSquare,
  azureOpenai: Cpu,
  twilio: Phone,
};

export const SystemHealthGrid = ({ services, className }: SystemHealthGridProps) => {
  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-3", className)}>
      {Object.entries(services).map(([key, service]) => {
        const Icon = serviceIcons[key] || Cloud;
        
        return (
          <div
            key={key}
            className={cn(
              "glass-card border border-border/50 p-4 rounded-xl transition-all hover:border-primary/30",
              service.status === 'warning' && "border-warning/30",
              service.status === 'critical' && "border-destructive/30"
            )}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className={cn(
                "p-1.5 rounded-lg",
                service.status === 'healthy' && "bg-success/10 text-success",
                service.status === 'warning' && "bg-warning/10 text-warning",
                service.status === 'critical' && "bg-destructive/10 text-destructive"
              )}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium truncate">{service.name}</span>
            </div>
            <StatusBadge status={service.status} pulse size="sm" />
            
            {/* Show key metrics based on service type */}
            <div className="mt-3 space-y-1">
              {service.cpu !== undefined && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">CPU</span>
                  <span className={cn(
                    service.cpu > 80 ? "text-destructive" : service.cpu > 60 ? "text-warning" : "text-foreground"
                  )}>{service.cpu}%</span>
                </div>
              )}
              {service.memory !== undefined && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Memory</span>
                  <span>{service.memory}%</span>
                </div>
              )}
              {service.ruUsage !== undefined && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">RU Usage</span>
                  <span className={cn(
                    service.ruUsage > 80 ? "text-destructive" : service.ruUsage > 60 ? "text-warning" : "text-foreground"
                  )}>{service.ruUsage}%</span>
                </div>
              )}
              {service.quotaUsed !== undefined && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Quota</span>
                  <span className={cn(
                    service.quotaUsed > 80 ? "text-destructive" : service.quotaUsed > 60 ? "text-warning" : "text-foreground"
                  )}>{service.quotaUsed}%</span>
                </div>
              )}
              {service.latency !== undefined && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Latency</span>
                  <span>{service.latency}ms</span>
                </div>
              )}
              {service.errorRate !== undefined && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Errors</span>
                  <span className={cn(
                    service.errorRate > 5 ? "text-destructive" : service.errorRate > 2 ? "text-warning" : "text-foreground"
                  )}>{service.errorRate}%</span>
                </div>
              )}
              {service.depth !== undefined && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Depth</span>
                  <span>{service.depth}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
