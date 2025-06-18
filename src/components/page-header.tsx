
import type { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, icon: Icon, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start sm:items-center gap-3">
        {Icon && <Icon className="h-6 w-6 sm:h-7 sm:w-7 text-primary mt-1 sm:mt-0" />}
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground font-headline sm:text-2xl lg:text-3xl">{title}</h1>
          {description && <p className="text-sm text-muted-foreground sm:text-base">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">{actions}</div>}
    </div>
  );
}
