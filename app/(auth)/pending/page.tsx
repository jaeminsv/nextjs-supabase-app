import { Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LogoutButton } from "@/components/logout-button";

/**
 * Approval pending page — shown to users whose profile role is 'pending'.
 *
 * After completing onboarding, users wait here until an admin approves
 * their membership. The proxy redirects pending users to this page
 * regardless of which URL they try to access.
 *
 * This is a Server Component. The LogoutButton is a separate Client Component
 * so it can handle the Supabase signOut call on the client side.
 *
 * Phase 3 (Task 011): Proxy will enforce redirect to this page for pending users.
 */
export default function PendingPage() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="mx-auto w-full max-w-md">
        <CardHeader className="items-center text-center">
          {/* Large clock icon to visually communicate "waiting" state */}
          <Clock className="mb-4 size-12 text-muted-foreground" />
          <CardTitle>승인 대기 중</CardTitle>
          <CardDescription>가입 신청이 접수되었습니다.</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 text-center">
          {/* Main guidance text */}
          <p className="text-sm text-muted-foreground">
            관리자가 검토 후 승인하면 모든 기능을 이용하실 수 있습니다. 승인까지
            1-2 영업일이 소요될 수 있습니다.
          </p>

          {/* Contact information */}
          <p className="text-sm text-muted-foreground">
            문의 사항은 동문회 운영진에게 연락해주세요.
          </p>

          {/* Logout button — Client Component that calls supabase.auth.signOut() */}
          <div className="mt-2">
            <LogoutButton />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
