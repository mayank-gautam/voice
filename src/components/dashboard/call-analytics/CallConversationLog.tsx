import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, AlertTriangle } from "lucide-react";
import { conversationTurns } from "@/lib/realCallAnalytics";
import { cn } from "@/lib/utils";

export const CallConversationLog = () => {
  const [q, setQ] = useState("");
  const rows = conversationTurns.filter(
    (t) =>
      !q ||
      t.userInput.toLowerCase().includes(q.toLowerCase()) ||
      t.botOutput.toLowerCase().includes(q.toLowerCase()) ||
      t.agent.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="glass-card border border-border/50 rounded-xl flex flex-col min-h-0">
      <div className="px-4 py-2.5 border-b border-border/50 flex items-center gap-3 shrink-0">
        <h3 className="font-semibold text-sm shrink-0">Turn-by-Turn Log</h3>
        <div className="relative ml-auto w-56">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search turns…"
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>
      <div className="overflow-auto scrollbar-thin">
        <table className="w-full text-xs">
          <thead className="bg-muted/30 text-muted-foreground sticky top-0">
            <tr>
              <th className="text-left font-medium px-3 py-2 w-8">#</th>
              <th className="text-left font-medium px-3 py-2">Agent</th>
              <th className="text-left font-medium px-3 py-2">User input</th>
              <th className="text-left font-medium px-3 py-2">Bot output</th>
              <th className="text-right font-medium px-3 py-2">LLM ms</th>
              <th className="text-right font-medium px-3 py-2">Tokens</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.index} className="border-t border-border/40 align-top hover:bg-muted/20">
                <td className="px-3 py-2 font-mono text-muted-foreground">{t.index}</td>
                <td className="px-3 py-2">
                  <span className="px-1.5 py-0.5 rounded bg-secondary text-[10px]">{t.agent.replace("Agent", "")}</span>
                  {t.disconnect && (
                    <span className="ml-1 inline-flex items-center gap-1 text-[10px] text-warning">
                      <AlertTriangle className="w-3 h-3" /> disc
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 max-w-[16rem]">{t.userInput}</td>
                <td className="px-3 py-2 max-w-[24rem] text-muted-foreground">{t.botOutput}</td>
                <td
                  className={cn(
                    "px-3 py-2 text-right font-mono",
                    t.llmMs > 1000 ? "text-destructive" : t.llmMs > 700 ? "text-warning" : "text-success"
                  )}
                >
                  {t.llmMs}
                </td>
                <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                  {t.tokensIn}/{t.tokensOut}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
