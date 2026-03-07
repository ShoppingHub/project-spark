import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { Settings, TrendingUp } from "lucide-react";
import { TimeRangeSelector, type TimeRange } from "@/components/TimeRangeSelector";
import { DashboardEmptyState } from "@/components/DashboardEmptyState";
import { motion } from "framer-motion";
import { subDays, format } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import type { Database } from "@/integrations/supabase/types";
import type { TranslationKey } from "@/i18n/translations";

type Area = Database["public"]["Tables"]["areas"]["Row"];
type AreaType = Database["public"]["Enums"]["area_type"];
type Filter = "all" | AreaType;

const rangeToDays: Record<TimeRange, number> = { "30d": 30, "90d": 90, "365d": 365 };

const filterOptions: { value: Filter; labelKey: TranslationKey }[] = [
  { value: "all", labelKey: "dashboard.filter.all" },
  { value: "health", labelKey: "areaType.health" },
  { value: "study", labelKey: "areaType.study" },
  { value: "reduce", labelKey: "areaType.reduce" },
  { value: "finance", labelKey: "areaType.finance" },
];

function computeSlope(data: { score: number }[]): number {
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

const Index = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [filter, setFilter] = useState<Filter>("all");
  const [areas, setAreas] = useState<Area[]>([]);
  const [scores, setScores] = useState<Record<string, { date: string; score: number }[]>>({});
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const { data: areasData } = await supabase
      .from("areas").select("*").eq("user_id", user.id)
      .is("archived_at", null).order("created_at", { ascending: true });
    if (!areasData) { setLoading(false); return; }
    setAreas(areasData);
    if (areasData.length === 0) { setLoading(false); return; }

    const areaIds = areasData.map((a) => a.id);
    const startDate = format(subDays(new Date(), rangeToDays[timeRange]), "yyyy-MM-dd");
    const { data: scoresData } = await supabase
      .from("score_daily").select("*").in("area_id", areaIds)
      .gte("date", startDate).order("date", { ascending: true });

    const grouped: Record<string, { date: string; score: number }[]> = {};
    for (const area of areasData) { grouped[area.id] = []; }
    if (scoresData) {
      for (const s of scoresData) {
        if (grouped[s.area_id]) {
          grouped[s.area_id].push({ date: s.date, score: s.cumulative_score });
        }
      }
    }
    setScores(grouped);
    setLoading(false);
  }, [user, timeRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Compute aggregated moving average based on filter
  const { chartData, lineColor } = useMemo(() => {
    const filteredAreas = filter === "all"
      ? areas
      : areas.filter((a) => a.type === filter);

    if (filteredAreas.length === 0) return { chartData: [], lineColor: "#8C9496" };

    // Collect all scores for filtered areas, grouped by date
    const dateMap: Record<string, number[]> = {};
    for (const area of filteredAreas) {
      const areaScores = scores[area.id] || [];
      for (const s of areaScores) {
        if (!dateMap[s.date]) dateMap[s.date] = [];
        dateMap[s.date].push(s.score);
      }
    }

    // Build averaged data sorted by date
    const averaged = Object.entries(dateMap)
      .map(([date, values]) => ({
        date,
        score: values.reduce((a, b) => a + b, 0) / values.length,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const slope = computeSlope(averaged);
    return { chartData: averaged, lineColor: getLineColor(slope) };
  }, [areas, scores, filter]);

  const hasData = chartData.length > 0 && chartData.some((d) => d.score !== 0);

  return (
    <div className="flex flex-col min-h-full">
      {/* Sticky header */}
      <div className="sticky top-0 z-40 bg-background">
        <div className="flex items-center justify-between px-4 h-14">
          <span className="text-[18px] font-semibold">BetonMe</span>
          <button onClick={() => navigate("/settings")}
            className="flex items-center justify-center h-10 w-10 min-h-[44px] min-w-[44px] lg:hidden">
            <Settings size={24} strokeWidth={1.5} className="text-muted-foreground" />
          </button>
        </div>
        <div className="flex justify-center px-4 pb-3">
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} disabled={loading} />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col gap-4 px-4 pb-4">
          <div className="rounded-xl bg-card animate-pulse" style={{ height: "60vh" }} />
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-8 w-20 rounded-full bg-card animate-pulse flex-shrink-0" />
            ))}
          </div>
        </div>
      ) : areas.length === 0 ? (
        <DashboardEmptyState />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="flex flex-col gap-4 px-4 pb-4"
        >
          {/* Aggregated chart */}
          {hasData ? (
            <div className="rounded-xl bg-card p-4" style={{ height: "60vh" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="0" horizontal vertical={false}
                    stroke="#EAEAEA" strokeOpacity={0.1} />
                  <XAxis dataKey="date" tick={{ fill: "#B9C0C1", fontSize: 12 }}
                    axisLine={false} tickLine={false}
                    tickFormatter={(d: string) => `${new Date(d).getDate()}/${new Date(d).getMonth() + 1}`}
                    interval="preserveStartEnd" />
                  <YAxis hide />
                  <Line type="monotone" dataKey="score" stroke={lineColor} strokeWidth={2}
                    dot={false} isAnimationActive animationDuration={300} animationEasing="ease-in-out" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="rounded-xl bg-card flex flex-col items-center justify-center gap-4"
              style={{ height: "60vh" }}>
              <TrendingUp size={48} className="text-muted-foreground" strokeWidth={1.5} />
              <p className="text-sm text-muted-foreground text-center px-8">
                {filter === "all"
                  ? t("areaDetail.emptyGraph")
                  : t("dashboard.emptyFilter")}
              </p>
            </div>
          )}

          {/* Filter pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {filterOptions.map(({ value, labelKey }) => {
              const active = filter === value;
              return (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors min-h-[36px] ${
                    active
                      ? "bg-[#7DA3A0] text-[#0F2F33]"
                      : "border border-[#B9C0C1]/30 text-[#B9C0C1]"
                  }`}
                >
                  {t(labelKey)}
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Index;
