"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Cpu } from "lucide-react";

/**
 * Manual project configuration is disabled.
 * Projects and Twilio come from account-hierarchy.json after SSO.
 */
const ProjectSetup = () => {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg bg-card/50 border-border/50 backdrop-blur-xl">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 border border-primary/20">
            <Cpu className="w-6 h-6 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl">Projects come from account-hierarchy</CardTitle>
            <CardDescription>
              After AWS SSO, projects and Twilio credentials are loaded automatically from{" "}
              <code className="text-[11px]">account-hierarchy.json</code>. Manual project setup is
              not required.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => router.replace("/")}>
            Go to application
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectSetup;
