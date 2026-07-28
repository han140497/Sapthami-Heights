"use client";

import { Droplets, TrendingUp, HelpCircle } from "lucide-react";

export interface WaterTrendItem {
  periodLabel: string;
  litres: number;
  isEstimated: boolean;
}

export function WaterTrendChart({
  trend,
  societyAvgLitres = 12000,
  flatType = "3BHK",
}: {
  trend: WaterTrendItem[];
  societyAvgLitres?: number;
  flatType?: string;
}) {
  if (!trend || trend.length === 0) return null;

  const maxLitres = Math.max(...trend.map((t) => t.litres), societyAvgLitres, 5000);

  return (
    <div className="mb-6 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent">
            <TrendingUp className="h-3.5 w-3.5" /> Consumption History
          </div>
          <h3 className="text-base font-bold">Water Usage Trend (Recent Periods)</h3>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-accent" />
            <span>Your Flat</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 border-t border-dashed border-muted-foreground" />
            <span>{flatType} Society Avg ({societyAvgLitres.toLocaleString()} L)</span>
          </div>
        </div>
      </div>

      {/* Ultra-crisp SVG Bar Chart */}
      <div className="relative h-48 w-full pt-4 pb-2">
        {/* Dashed Average Line */}
        <div
          className="absolute left-0 right-0 z-10 flex items-center border-t border-dashed border-muted-foreground/60 text-[10px] text-muted font-medium"
          style={{ bottom: `${(societyAvgLitres / maxLitres) * 80 + 10}%` }}
        >
          <span className="bg-surface px-1 text-muted-foreground">
            Avg: {societyAvgLitres.toLocaleString()} L
          </span>
        </div>

        <div className="flex h-full items-end justify-around gap-2 px-2">
          {trend.map((item, idx) => {
            const heightPct = Math.min(100, Math.max(8, (item.litres / maxLitres) * 80));
            const isHigh = item.litres > societyAvgLitres * 1.2;

            return (
              <div key={idx} className="group relative flex flex-col items-center flex-1 max-w-[64px] h-full justify-end">
                {/* Value Badge */}
                <div className="mb-1 text-[11px] font-bold tabular text-foreground group-hover:scale-110 transition-transform">
                  {(item.litres / 1000).toFixed(1)}k
                </div>

                {/* SVG Bar */}
                <div
                  className={`w-full rounded-t-md transition-all duration-300 ${
                    isHigh
                      ? "bg-warning hover:bg-warning/90"
                      : "bg-accent hover:bg-accent/90"
                  } ${item.isEstimated ? "opacity-60 border border-dashed border-foreground/40" : ""}`}
                  style={{ height: `${heightPct}%` }}
                />

                {/* Period Month Label */}
                <div className="mt-2 text-[11px] font-medium text-muted truncate w-full text-center">
                  {item.periodLabel}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-2 text-right text-[11px] text-muted italic flex items-center justify-end gap-1">
        <HelpCircle className="h-3 w-3" /> k = Thousand Litres (e.g. 12.5k = 12,500 L)
      </p>
    </div>
  );
}
