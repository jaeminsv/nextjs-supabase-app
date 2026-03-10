import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PaymentStatus } from "@/lib/types/payment";

// Props for the payment status badge component
interface PaymentStatusBadgeProps {
  // The current payment status. null/undefined means no payment submitted yet.
  status: PaymentStatus | null | undefined;
}

// Maps each payment status to its display label and Tailwind color classes
const STATUS_CONFIG: Record<
  PaymentStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "확인 대기",
    className: "bg-yellow-100 text-yellow-800 border border-yellow-200",
  },
  confirmed: {
    label: "납부 완료",
    className: "bg-green-100 text-green-800 border border-green-200",
  },
  rejected: {
    label: "반려",
    className: "bg-red-100 text-red-800 border border-red-200",
  },
};

// Default config for when status is null/undefined (no payment submitted yet)
const DEFAULT_CONFIG = {
  label: "미제출",
  className: "bg-gray-100 text-gray-600 border border-gray-200",
};

/**
 * Displays a payment's current verification state as a colored badge.
 * Yellow = awaiting review, Green = payment confirmed, Red = payment rejected.
 * Gray = no payment submitted yet.
 */
export function PaymentStatusBadge({ status }: PaymentStatusBadgeProps) {
  const config = status
    ? (STATUS_CONFIG[status] ?? DEFAULT_CONFIG)
    : DEFAULT_CONFIG;

  return <Badge className={cn(config.className)}>{config.label}</Badge>;
}
