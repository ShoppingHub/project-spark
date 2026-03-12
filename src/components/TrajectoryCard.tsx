import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from "recharts";
import { AreaTypePill } from "@/components/AreaTypePill";
import { useI18n } from "@/hooks/useI18n";
import type { Database } from "@/integrations/supabase/types";

type AreaType = Database["public"]["Enums"]["area_type"];

interface ScorePoint { date: string; score: number; }

interface TrajectoryCardProps {
  areaId: string;
  name: string;
  type: AreaType;
  data: ScorePoint[];
  todayCheckedIn?: boolean;
  onCheckIn?: () => void;
  checkInLoading?: boolean;
}

function computeSlope(data: ScorePoint[]): number {
  if (data.length < 2) return 0;
  const last7 = data.slice(-7);
  if (last7.length < 2) return 0;
  const n = last7.length;
  const sumX = last7.reduce((s, _, i) => s + i, 0);
  const sumY = last7.reduce((s, d) => s + d.score, 0);
  const sumXY = last7.reduce((s, d, i) => s + i * d.score, 0);
  const sumX2 = last7.reduce((s, _, i) => s + i * i, 0);
  return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
}

function getLineColor(slope: number): string {
  if (slope > 0.1) return "#7DA3A0";
  if (slope < -0.1) return "#BFA37A";
  return "#8C9496";
}

function formatDateTick(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export function TrajectoryCard({
  areaId, name, type, data, todayCheckedIn, onCheckIn, checkInLoading,
}: TrajectoryCardProps) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const slope = useMemo(() => computeSlope(data), [data]);
  const lineColor = useMemo(() => getLineColor(slope), [slope]);
  const chartData = data.length > 0 ? data : [{ date: new Date().toISOString().split("T")[0], score: 0 }];

  return (
    <div className="rounded-xl bg-card p-4 flex flex-col" style={{ height: "55vh" }}>
      <div className="flex items-center justify-between mb-3 cursor-pointer" onClick={() => navigate(`/activities/${areaId}`)}>
        <span className="text-[18px] font-medium">{name}</span>
        <AreaTypePill type={type} />
      </div>
      <div className="flex-1 min-h-0 cursor-pointer" onClick={() => navigate(`/areas/${areaId}`)}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="0" horizontal vertical={false} stroke="#EAEAEA" strokeOpacity={0.1} />
            <XAxis dataKey="date" tick={{ fill: "#B9C0C1", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={formatDateTick} interval="preserveStartEnd" />
            <YAxis hide />
            <Line type="monotone" dataKey="score" stroke={lineColor} strokeWidth={2} dot={false} isAnimationActive animationDuration={300} animationEasing="ease-in-out" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onCheckIn?.(); }}
        disabled={todayCheckedIn || checkInLoading}
        className={`mt-3 w-full min-h-[44px] rounded-lg text-base font-medium border transition-all flex items-center justify-center gap-2 ${
          todayCheckedIn ? "bg-[#7DA3A0]/20 text-[#7DA3A0] border-[#7DA3A0]" : "bg-transparent text-foreground border-[#7DA3A0]"
        } ${checkInLoading ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {checkInLoading ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : todayCheckedIn ? t("card.observed") : t("card.logToday")}
      </button>
    </div>
  );
}
