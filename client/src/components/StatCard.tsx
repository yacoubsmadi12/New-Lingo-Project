import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: "primary" | "secondary" | "orange" | "blue";
  trend?: string;
  className?: string;
}

export function StatCard({ label, value, icon: Icon, color = "primary", trend, className }: StatCardProps) {
  const colorStyles = {
    primary: "bg-primary/10 text-primary border-primary/20",
    secondary: "bg-secondary/10 text-secondary border-secondary/20",
    orange: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    blue: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  };

  return (
    <div className={cn(
      "bg-card rounded-2xl p-6 border shadow-sm hover:shadow-md transition-all duration-300",
      className
    )}>
      <div className="flex items-start justify-between mb-4">
        <div className={cn("p-3 rounded-xl border", colorStyles[color])}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100">
            {trend}
          </span>
        )}
      </div>
      <div>
        <h3 className="text-3xl font-display font-bold text-foreground mb-1">{value}</h3>
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
      </div>
    </div>
  );
}
