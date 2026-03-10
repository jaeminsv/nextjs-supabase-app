import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  // The Lucide icon component to display (e.g. CalendarX, Inbox)
  icon: LucideIcon;
  // Main heading text
  title: string;
  // Optional descriptive text below the title
  description?: string;
  // Optional action element (e.g. a Button to create something)
  action?: React.ReactNode;
}

/**
 * Placeholder component shown when a list or section has no content.
 * Displays an icon, title, optional description, and optional action button.
 *
 * Example usage:
 *   <EmptyState icon={CalendarX} title="이벤트가 없습니다" description="아직 예정된 이벤트가 없어요." />
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {/* Large icon in muted color */}
      <Icon className="mb-4 h-12 w-12 text-muted-foreground" />

      {/* Main title */}
      <h3 className="mb-1 text-base font-semibold">{title}</h3>

      {/* Optional description */}
      {description && (
        <p className="mb-4 max-w-xs text-sm text-muted-foreground">
          {description}
        </p>
      )}

      {/* Optional action (e.g. create button) */}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
