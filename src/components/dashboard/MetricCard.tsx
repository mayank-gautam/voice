import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { ReactNode } from "react";
import Link from "next/link";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: ReactNode;
  variant?: "default" | "success" | "warning" | "destructive" | "info";
  size?: "sm" | "md" | "lg";
  className?: string;
  glow?: boolean;
  href?: string;
  onClick?: () => void;
  clickHint?: string;
}

export const MetricCard = ({
  title,
  value,
  change,
  changeLabel = "vs last period",
  icon,
  variant = "default",
  size = "md",
  className,
  glow = false,
  href,
  onClick,
  clickHint,
}: MetricCardProps) => {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const isNeutral = change === 0;
  const clickable = Boolean(href || onClick);

  const variantStyles = {
    default: "border-border/50",
    success: "border-success/30",
    warning: "border-warning/30",
    destructive: "border-destructive/30",
    info: "border-info/30",
  };

  const glowStyles = {
    default: "metric-glow",
    success: "metric-glow-success",
    warning: "metric-glow-warning",
    destructive: "metric-glow-destructive",
    info: "metric-glow",
  };

  const sizeStyles = {
    sm: "p-3",
    md: "p-4",
    lg: "p-6",
  };

  const valueSizes = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-4xl",
  };

  const body = (
    <>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {title}
          </p>
          <p className={cn("font-semibold tracking-tight", valueSizes[size])}>{value}</p>
        </div>
        {icon && (
          <div
            className={cn(
              "p-2 rounded-lg",
              variant === "default" && "bg-primary/10 text-primary",
              variant === "success" && "bg-success/10 text-success",
              variant === "warning" && "bg-warning/10 text-warning",
              variant === "destructive" && "bg-destructive/10 text-destructive",
              variant === "info" && "bg-info/10 text-info"
            )}
          >
            {icon}
          </div>
        )}
      </div>
      {change !== undefined && (
        <div className="flex items-center gap-1 mt-2">
          {isPositive && <ArrowUp className="w-3 h-3 text-success" />}
          {isNegative && <ArrowDown className="w-3 h-3 text-destructive" />}
          {isNeutral && <Minus className="w-3 h-3 text-muted-foreground" />}
          <span
            className={cn(
              "text-xs font-medium",
              isPositive && "text-success",
              isNegative && "text-destructive",
              isNeutral && "text-muted-foreground"
            )}
          >
            {Math.abs(change).toFixed(1)}%
          </span>
          <span className="text-xs text-muted-foreground">{changeLabel}</span>
        </div>
      )}
      {clickable && clickHint && (
        <p className="text-[10px] text-muted-foreground mt-2">{clickHint}</p>
      )}
    </>
  );

  const classes = cn(
    "glass-card border transition-all duration-300 hover:border-primary/30 block",
    variantStyles[variant],
    sizeStyles[size],
    glow && glowStyles[variant],
    clickable &&
      "cursor-pointer hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    className
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {body}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(classes, "text-left w-full")}>
        {body}
      </button>
    );
  }

  return <div className={classes}>{body}</div>;
};
