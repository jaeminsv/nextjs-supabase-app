/**
 * Onboarding page — multi-step sign-up wizard for first-time users.
 *
 * After Google OAuth login, new users (without a profile) are redirected here
 * to fill in their alumni information before gaining access to the app.
 *
 * Phase 2 (Task 004): Replace with actual multi-step form
 * (name, phone → KAIST info → company/payment info).
 */
export default function OnboardingPage() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-bold">회원가입</h1>
        <p className="mt-2 text-muted-foreground">
          동문 정보를 입력하여 가입을 완료하세요.
        </p>
      </div>
    </div>
  );
}
