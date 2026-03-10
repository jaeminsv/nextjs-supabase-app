import { LogoutButton } from "@/components/logout-button";

/**
 * Approval pending page — shown to users whose profile role is 'pending'.
 *
 * After completing onboarding, users wait here until an admin approves
 * their membership. The proxy redirects pending users to this page
 * regardless of which URL they try to access.
 *
 * Phase 3 (Task 011): Proxy will enforce redirect to this page for pending users.
 */
export default function PendingPage() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-bold">승인 대기 중</h1>
        <p className="mt-2 text-muted-foreground">
          관리자가 가입을 검토 중입니다. 승인되면 모든 기능을 사용할 수
          있습니다.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          문의 사항이 있으면 동문회 운영진에게 연락해주세요.
        </p>
        <div className="mt-6">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
