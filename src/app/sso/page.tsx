import { SsoClient } from "@/app/sso-client";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { getValidatedSession } from "@/lib/session";

export default async function SsoPage() {
  const session = await getValidatedSession();
  const initialSession = session.accountId
    ? {
        accountId: session.accountId,
        accountName: session.accountName,
        roleName: session.roleName,
        awsExpiration: session.expiration,
      }
    : null;

  return (
    <div className="relative flex min-h-screen items-start justify-center overflow-x-hidden bg-background p-4 sm:p-6 lg:items-center lg:p-8">
      <div className="fixed right-4 top-4 z-50">
        <ThemeToggle />
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.12),transparent_55%),radial-gradient(ellipse_at_bottom_right,hsl(var(--accent)/0.08),transparent_50%)]"
      />

      <main className="relative z-10 w-full max-w-6xl animate-fade-in py-8 lg:py-0">
        <SsoClient initialSession={initialSession} />
      </main>
    </div>
  );
}
