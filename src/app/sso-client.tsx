"use client";

import { useCallback, useState } from "react";
import {
  DeviceLogin,
  type SsoUiPhase,
} from "@/app/device-login";

type SessionSummary = {
  accountId?: string;
  accountName?: string;
  roleName?: string;
  awsExpiration?: string;
};

type SsoClientProps = {
  initialSession?: SessionSummary | null;
};

/**
 * SSO shell that swaps sign-in chrome for account/role/project selection
 * once AWS authentication succeeds (or a valid SSO token is restored).
 */
export function SsoClient({ initialSession }: SsoClientProps) {
  const [phase, setPhase] = useState<SsoUiPhase>("checking");
  const onPhaseChange = useCallback((next: SsoUiPhase) => {
    setPhase(next);
  }, []);

  const authenticated =
    phase === "select-scope" || phase === "loading" || phase === "error";

  return (
    <div className="grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2">
      <section className="hidden space-y-8 lg:block">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-medium text-primary">
            <span
              className={`h-2 w-2 rounded-full ${
                authenticated
                  ? "bg-emerald-500"
                  : "animate-pulse bg-amber-500"
              }`}
            />
            {authenticated ? "SSO session active" : "Voice AI Observability"}
          </span>

          <h1 className="mt-6 text-5xl font-bold tracking-tight text-foreground xl:text-6xl">
            {authenticated ? (
              <>
                Select access
                <span className="block text-primary">Account & project</span>
              </>
            ) : (
              <>
                AWS SSO
                <span className="block text-primary">Device Login</span>
              </>
            )}
          </h1>

          <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
            {authenticated
              ? "Pick an AWS account and role. Mapped projects from twilio-mappings open when you continue."
              : "Authenticate securely with AWS IAM Identity Center, then choose the account and role assigned to you."}
          </p>
        </div>

        <div className="grid gap-4">
          {authenticated ? (
            <>
              <FeatureItem
                color="bg-emerald-500"
                title="Your AWS accounts"
                description="Every account returned by your SSO session is listed."
              />
              <FeatureItem
                color="bg-blue-500"
                title="Roles for the account"
                description="Selecting an account loads only that account’s IAM roles."
              />
              <FeatureItem
                color="bg-violet-500"
                title="Projects from twilio-mappings"
                description="Choosing a role loads mapped projects; Use This Account opens that project."
              />
              <FeatureItem
                color="bg-amber-500"
                title="Switch anytime"
                description="Switch Account returns here without a new device code while the token is valid."
              />
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </section>

      <section className="relative">
        <div
          aria-hidden="true"
          className="absolute -inset-3 rounded-[2rem] bg-primary/15 blur-3xl"
        />

        <div className="relative rounded-[2rem] border border-border/60 bg-card/85 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          {!authenticated && (
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
                {phase === "waiting" ? "Approve login" : "Sign in with AWS"}
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                {phase === "waiting"
                  ? "Complete approval in the AWS tab, then return here"
                  : "Authenticate with AWS IAM Identity Center to continue"}
              </p>
            </div>
          )}

          <DeviceLogin
            initialSession={initialSession}
            onPhaseChange={onPhaseChange}
          />
        </div>
      </section>
    </div>
  );
}

function FeatureItem({
  color,
  title,
  description,
}: {
  color: string;
  title: string;
  description: string;
}) {
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
