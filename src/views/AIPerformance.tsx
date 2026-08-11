"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { LatencyChart } from "@/components/dashboard/LatencyChart";
import { cn } from "@/lib/utils";
import {
  Mic,
  Brain,
  Volume2,
  Zap,
  Target,
  AlertTriangle,
  TrendingUp,
  Gauge,
} from "lucide-react";
import { aiPerformanceMetrics, latencyData, topIntents, behaviorMetrics } from "@/lib/mockData";

const AIPerformance = () => {
  const { stt, llm, tts } = aiPerformanceMetrics;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">AI Performance</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Monitor STT, LLM, and TTS performance metrics
          </p>
        </div>

        {/* STT Metrics */}
        <div className="glass-card border border-border/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-chart-1/10">
              <Mic className="w-4 h-4 text-chart-1" />
            </div>
            <h3 className="font-semibold">Speech-to-Text (STT)</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              title="Avg Latency"
              value={`${stt.avgLatency}ms`}
              size="sm"
            />
            <MetricCard
              title="P99 Latency"
              value={`${stt.p99}ms`}
              size="sm"
              variant={stt.p99 > 200 ? "warning" : "default"}
            />
            <MetricCard
              title="Confidence"
              value={`${(stt.confidence * 100).toFixed(1)}%`}
              size="sm"
              variant="success"
            />
            <MetricCard
              title="Error Rate"
              value={`${stt.errorRate}%`}
              size="sm"
              variant={stt.errorRate > 3 ? "destructive" : "default"}
            />
          </div>
        </div>

        {/* LLM Metrics */}
        <div className="glass-card border border-border/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-chart-4/10">
              <Brain className="w-4 h-4 text-chart-4" />
            </div>
            <h3 className="font-semibold">Large Language Model (LLM)</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              title="Avg Latency"
              value={`${llm.avgLatency}ms`}
              size="sm"
            />
            <MetricCard
              title="P99 Latency"
              value={`${llm.p99}ms`}
              size="sm"
              variant={llm.p99 > 1000 ? "warning" : "default"}
            />
            <MetricCard
              title="Tokens Used"
              value={llm.tokensUsed.toLocaleString()}
              size="sm"
            />
            <MetricCard
              title="Rate Limits"
              value={llm.rateLimitEvents}
              size="sm"
              variant={llm.rateLimitEvents > 10 ? "destructive" : "warning"}
            />
          </div>
        </div>

        {/* TTS Metrics */}
        <div className="glass-card border border-border/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-chart-2/10">
              <Volume2 className="w-4 h-4 text-chart-2" />
            </div>
            <h3 className="font-semibold">Text-to-Speech (TTS)</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              title="Avg Latency"
              value={`${tts.avgLatency}ms`}
              size="sm"
            />
            <MetricCard
              title="P99 Latency"
              value={`${tts.p99}ms`}
              size="sm"
              variant={tts.p99 > 300 ? "warning" : "default"}
            />
            <MetricCard
              title="Error Rate"
              value={`${tts.errorRate}%`}
              size="sm"
              variant="success"
            />
            <div className="glass-card border border-border/50 p-3 rounded-xl">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </p>
              <p className="text-success text-xl font-semibold mt-1">Healthy</p>
            </div>
          </div>
        </div>

        {/* Latency Chart */}
        <LatencyChart data={latencyData} title="Latency Over Time (24h)" />

        {/* Intent Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card border border-border/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Top Intents</h3>
            </div>
            <div className="space-y-3">
              {topIntents.map((intent, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">{intent.intent.replace('_', ' ')}</span>
                      <span className="text-xs text-muted-foreground">
                        {intent.count.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          intent.successRate >= 90 ? "bg-success" :
                          intent.successRate >= 80 ? "bg-warning" : "bg-destructive"
                        )}
                        style={{ width: `${intent.successRate}%` }}
                      />
                    </div>
                  </div>
                  <span className={cn(
                    "text-xs font-medium w-12 text-right",
                    intent.successRate >= 90 ? "text-success" :
                    intent.successRate >= 80 ? "text-warning" : "text-destructive"
                  )}>
                    {intent.successRate}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card border border-border/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Gauge className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Behavior Metrics</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Intent Accuracy</p>
                <p className="text-2xl font-bold text-success">{behaviorMetrics.intentAccuracy}%</p>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Task Completion</p>
                <p className="text-2xl font-bold text-success">{behaviorMetrics.taskCompletion}%</p>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Repair Attempts</p>
                <p className="text-2xl font-bold text-warning">{behaviorMetrics.repairAttempts}</p>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Dead-end Loops</p>
                <p className="text-2xl font-bold text-destructive">{behaviorMetrics.deadEndLoops}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AIPerformance;
