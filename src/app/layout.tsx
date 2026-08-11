import type { Metadata } from "next";
import { Providers } from "./providers";
import "@/index.css";

export const metadata: Metadata = {
  title: "VoiceAI Observability | Real-time Monitoring Dashboard",
  description:
    "Production-grade observability dashboard for Agentic Voice AI applications. Monitor calls, AI performance, system health, and costs in real-time.",
  authors: [{ name: "VoiceAI" }],
  keywords: ["voice ai", "observability", "monitoring", "dashboard", "stt", "llm", "tts", "telephony"],
  icons: {
    icon: [{ url: "/favico.png", type: "image/png" }],
    shortcut: "/favico.png",
    apple: "/favico.png",
  },
  openGraph: {
    title: "VoiceAI Observability Dashboard",
    description: "Real-time monitoring for Agentic Voice AI applications",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@VoiceAI",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
