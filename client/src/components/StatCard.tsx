import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  descriptionClassName?: string;
  descriptionNode?: React.ReactNode;
  titleAddon?: React.ReactNode;
}

export default function StatCard({ title, value, icon: Icon, description, descriptionClassName, descriptionNode, titleAddon }: StatCardProps) {
  return (
    <Card data-testid={`card-stat-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              {titleAddon}
            </div>
            <p className="text-3xl font-bold tracking-tight mt-2" data-testid={`text-stat-value-${title.toLowerCase().replace(/\s+/g, '-')}`}>{value}</p>
            {descriptionNode ? (
              <div className={descriptionClassName ? descriptionClassName : "text-xs text-muted-foreground mt-1"}>{descriptionNode}</div>
            ) : description ? (
              <p className={descriptionClassName ? descriptionClassName : "text-xs text-muted-foreground mt-1"}>{description}</p>
            ) : null}
          </div>
          <div className="p-3 rounded-lg bg-primary/10">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
