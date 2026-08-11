import { DeviceLogin } from "@/app/device-login";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { getValidatedSession } from "@/lib/session";

export default async function SsoPage() {
  const session = await getValidatedSession();
  /*
   * Always render DeviceLogin so returning users can reuse a cached SSO
   * token, pick account/role again, and only re-approve when AWS requires it.
   */
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
      {/* Theme toggle */}
      <div className="fixed right-5 top-5 z-50">
        <ThemeToggle />
      </div>

      {/* Background effects */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.15),transparent_30%)]" />

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,hsl(var(--accent)/0.12),transparent_40%)]" />

        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.1)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.1)_1px,transparent_1px)] bg-[size:48px_48px]" />

        <div className="absolute left-1/2 top-1/2 h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[130px]" />
      </div>

      <main className="relative z-10 flex min-h-screen items-center justify-center px-6 py-16">
        <div className="grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2">
          {/* Left section */}
          <section className="hidden space-y-8 lg:block">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-medium text-primary">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                Voice AI Observability
              </span>

              <h1 className="mt-6 text-5xl font-bold tracking-tight text-foreground xl:text-6xl">
                AWS SSO
                <span className="block text-primary">Device Login</span>
              </h1>

              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Authenticate securely with AWS IAM Identity Center and choose
                from all AWS accounts and roles assigned to you.
              </p>
            </div>

            <div className="grid gap-4">
              <FeatureItem
                color="bg-emerald-500"
                title="Real-Time Log Streaming"
                description="Monitor Lambda and ECS application logs."
              />

              <FeatureItem
                color="bg-blue-500"
                title="Multiple AWS Accounts"
                description="Choose from every AWS account assigned to you."
              />

              <FeatureItem
                color="bg-violet-500"
                title="Temporary AWS Credentials"
                description="Use short-lived credentials generated through AWS SSO."
              />

              <FeatureItem
                color="bg-amber-500"
                title="Secure IAM Role Access"
                description="Select an authorized IAM role for the chosen account."
              />
            </div>
          </section>

          {/* Right section */}
          <section className="relative">
            <div
              aria-hidden="true"
              className="absolute -inset-3 rounded-[2rem] bg-primary/15 blur-3xl"
            />

            <div className="relative rounded-[2rem] border border-border/60 bg-card/85 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
              <div className="mb-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                  <svg
                    aria-hidden="true"
                    className="h-8 w-8 text-primary"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 3 4.5 7.2v4.9c0 4.7 3.1 8.7 7.5 9.9 4.4-1.2 7.5-5.2 7.5-9.9V7.2L12 3Z"
                    />

                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m9.5 12 1.6 1.6 3.7-3.8"
                    />
                  </svg>
                </div>

                <h2 className="text-3xl font-bold tracking-tight text-foreground">
                  Authenticate
                </h2>

                <p className="mt-2 text-sm text-muted-foreground">
                  Sign in using AWS IAM Identity Center
                </p>
              </div>

              {/*
               * DeviceLogin browser IndexedDB check karega:
               *
               * 1. Valid role credentials:
               *    restore session and redirect dashboard.
               *
               * 2. Invalid role credentials + valid SSO token:
               *    skip approval and fetch accounts.
               *
               * 3. Invalid SSO token:
               *    show AWS approval action.
               */}
              <DeviceLogin initialSession={initialSession} />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

type FeatureItemProps = {
  color: string;
  title: string;
  description: string;
};

function FeatureItem({ color, title, description }: FeatureItemProps) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border/50 bg-card/50 p-4 backdrop-blur-md transition-colors hover:border-primary/30 hover:bg-card/70">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background/70">
        <span aria-hidden="true" className={`h-3 w-3 rounded-full ${color}`} />
      </div>

      <div className="min-w-0">
        <p className="font-medium text-foreground">{title}</p>

        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}
