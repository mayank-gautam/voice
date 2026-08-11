"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Cpu, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

const Login = () => {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-chart-success/5 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md bg-card/50 border-border/50 backdrop-blur-xl relative z-10">
        <CardHeader className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3 mx-auto">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 border border-primary/20">
              <Cpu className="w-6 h-6 text-primary" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl">VoiceAI Observability</CardTitle>
            <CardDescription className="mt-2">
              Sign in with AWS IAM Identity Center to continue
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button onClick={() => router.push("/sso")} className="w-full gap-2" size="lg">
            Continue with AWS SSO
            <ArrowRight className="w-4 h-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
