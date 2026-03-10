import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// Size variants mapped to Tailwind classes
const SIZE_CLASSES = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
} as const;

interface UserAvatarProps {
  // The user's display name — first character used as fallback
  displayName: string;
  // Optional URL for the avatar image
  avatarUrl?: string | null;
  // Size of the avatar: sm=32px, md=40px (default), lg=48px
  size?: keyof typeof SIZE_CLASSES;
}

/**
 * Circular avatar showing the user's profile image.
 * Falls back to the first letter of displayName when no image is available.
 *
 * Example: displayName="김철수" → fallback shows "김"
 */
export function UserAvatar({
  displayName,
  avatarUrl,
  size = "md",
}: UserAvatarProps) {
  // Get the first character of the display name for the fallback
  const fallbackChar = displayName.charAt(0).toUpperCase();

  return (
    <Avatar className={cn(SIZE_CLASSES[size])}>
      {/* Show avatar image if URL is provided */}
      {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}

      {/* Fallback: shows first letter when image is unavailable or loading */}
      <AvatarFallback className="text-sm font-medium">
        {fallbackChar}
      </AvatarFallback>
    </Avatar>
  );
}
