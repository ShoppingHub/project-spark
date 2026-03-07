import { useState } from "react";
import { motion } from "framer-motion";

type TimeRange = "30d" | "90d" | "365d";

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  disabled?: boolean;
}

const ranges: TimeRange[] = ["30d", "90d", "365d"];

export function TimeRangeSelector({ value, onChange, disabled }: TimeRangeSelectorProps) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-card p-1">
      {ranges.map((range) => (
        <button
          key={range}
          onClick={() => onChange(range)}
          disabled={disabled}
          className="relative rounded-full px-4 py-1 text-sm font-medium transition-colors min-h-[32px] disabled:pointer-events-none"
        >
          {value === range && (
            <motion.div
              layoutId="activeRange"
              className="absolute inset-0 rounded-full bg-[#1F4A50]"
              transition={{ duration: 0.2, ease: "easeInOut" }}
            />
          )}
          <span
            className={`relative z-10 ${
              value === range ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {range}
          </span>
        </button>
      ))}
    </div>
  );
}

export type { TimeRange };
