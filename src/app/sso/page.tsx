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
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="fixed right-5 top-5 z-50">
        <ThemeToggle />
      </div>

      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.15),transparent_30%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,hsl(var(--accent)/0.12),transparent_40%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.1)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.1)_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="absolute left-1/2 top-1/2 h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[130px]" />
      </div>

      <main className="relative z-10 flex min-h-screen items-center justify-center px-6 py-16">
        <SsoClient initialSession={initialSession} />
      </main>
    </div>
  );
}
