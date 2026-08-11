import { cn } from "@/lib/utils";

interface HealthScoreProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const HealthScore = ({ score, size = 'md', showLabel = true, className }: HealthScoreProps) => {
  const getColor = (score: number) => {
    if (score >= 90) return 'text-success';
    if (score >= 70) return 'text-warning';
    return 'text-destructive';
  };

  const getGradient = (score: number) => {
    if (score >= 90) return 'from-success to-success/50';
    if (score >= 70) return 'from-warning to-warning/50';
    return 'from-destructive to-destructive/50';
  };

  const getLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Fair';
    return 'Critical';
  };

  const sizes = {
    sm: { container: 'w-20 h-20', text: 'text-xl', label: 'text-xs' },
    md: { container: 'w-32 h-32', text: 'text-3xl', label: 'text-sm' },
    lg: { container: 'w-40 h-40', text: 'text-4xl', label: 'text-base' },
  };

  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className={cn("relative", sizes[size].container)}>
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted/30"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="url(#healthGradient)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
          />
          <defs>
            <linearGradient id="healthGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" className={cn("stop-current", getColor(score))} />
              <stop offset="100%" className={cn("stop-current", getColor(score), "opacity-50")} />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-bold", sizes[size].text, getColor(score))}>
            {score}
          </span>
        </div>
      </div>
      {showLabel && (
        <div className="text-center">
          <p className={cn("font-medium", sizes[size].label, getColor(score))}>
            {getLabel(score)}
          </p>
          <p className="text-xs text-muted-foreground">System Health</p>
        </div>
      )}
    </div>
  );
};
