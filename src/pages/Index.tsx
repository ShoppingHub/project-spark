import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { Settings } from "lucide-react";
import { TimeRangeSelector, type TimeRange } from "@/components/TimeRangeSelector";
import { TrajectoryCard } from "@/components/TrajectoryCard";
import { TrajectoryCardSkeleton } from "@/components/TrajectoryCardSkeleton";
import { DashboardEmptyState } from "@/components/DashboardEmptyState";
import { motion } from "framer-motion";
import { subDays, format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type Area = Database["public"]["Tables"]["areas"]["Row"];

const rangeToDays: Record<TimeRange, number> = { "30d": 30, "90d": 90, "365d": 365 };

const Index = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [areas, setAreas] = useState<Area[]>([]);
  const [scores, setScores] = useState<Record<string, { date: string; score: number }[]>>({});
  const [todayCheckins, setTodayCheckins] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [checkInLoading, setCheckInLoading] = useState<Record<string, boolean>>({});
  const today = format(new Date(), "yyyy-MM-dd");

  const fetchData = useCallback(async () => {
    if (!user) return;
    const { data: areasData } = await supabase.from("areas").select("*").eq("user_id", user.id).is("archived_at", null).order("created_at", { ascending: true });
    if (!areasData) { setLoading(false); return; }
    setAreas(areasData);
    if (areasData.length === 0) { setLoading(false); return; }
    const areaIds = areasData.map((a) => a.id);
    const startDate = format(subDays(new Date(), rangeToDays[timeRange]), "yyyy-MM-dd");
    const { data: scoresData } = await supabase.from("score_daily").select("*").in("area_id", areaIds).gte("date", startDate).order("date", { ascending: true });
    const grouped: Record<string, { date: string; score: number }[]> = {};
    for (const area of areasData) { grouped[area.id] = []; }
    if (scoresData) { for (const s of scoresData) { if (grouped[s.area_id]) { grouped[s.area_id].push({ date: s.date, score: s.cumulative_score }); } } }
    setScores(grouped);
    const { data: checkinsData } = await supabase.from("checkins").select("area_id, completed").eq("user_id", user.id).eq("date", today).in("area_id", areaIds);
    const checkinMap: Record<string, boolean> = {};
    if (checkinsData) { for (const c of checkinsData) { checkinMap[c.area_id] = c.completed; } }
    setTodayCheckins(checkinMap);
    setLoading(false);
  }, [user, timeRange, today]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const [checkInError, setCheckInError] = useState("");

  const handleCheckIn = async (areaId: string) => {
    if (!user) return;
    setCheckInLoading((prev) => ({ ...prev, [areaId]: true }));
    setCheckInError("");
    try {
      const { error } = await supabase.from("checkins").upsert(
        { area_id: areaId, user_id: user.id, date: today, completed: true },
        { onConflict: "area_id,date" }
      );
      if (error) throw error;
      const { data: sessionData } = await supabase.auth.getSession();
      await supabase.functions.invoke("calculate-score", {
        body: { area_id: areaId, date: today },
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
      });
      setTodayCheckins((prev) => ({ ...prev, [areaId]: true }));
      const startDate = format(subDays(new Date(), rangeToDays[timeRange]), "yyyy-MM-dd");
      const { data: newScores } = await supabase.from("score_daily").select("*").eq("area_id", areaId).gte("date", startDate).order("date", { ascending: true });
      if (newScores) { setScores((prev) => ({ ...prev, [areaId]: newScores.map((s) => ({ date: s.date, score: s.cumulative_score })) })); }
    } catch { setCheckInError(t("dashboard.error")); }
    finally { setCheckInLoading((prev) => ({ ...prev, [areaId]: false })); }
  };

  return (
    <div className="flex flex-col min-h-full">
      <div className="sticky top-0 z-40 bg-background">
        <div className="flex items-center justify-between px-4 h-14">
          <span className="text-[18px] font-semibold">BetonMe</span>
          <button onClick={() => navigate("/settings")} className="flex items-center justify-center h-10 w-10 min-h-[44px] min-w-[44px]">
            <Settings size={24} strokeWidth={1.5} className="text-muted-foreground" />
          </button>
        </div>
        <div className="flex justify-center px-4 pb-3">
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} disabled={loading} />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-4 px-4 pb-4">
          <TrajectoryCardSkeleton />
          <TrajectoryCardSkeleton />
        </div>
      ) : areas.length === 0 ? (
        <DashboardEmptyState />
      ) : (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="flex flex-col gap-4 px-4 pb-4">
          {areas.map((area) => (
            <TrajectoryCard key={area.id} areaId={area.id} name={area.name} type={area.type}
              data={scores[area.id] || []} todayCheckedIn={!!todayCheckins[area.id]}
              onCheckIn={() => handleCheckIn(area.id)} checkInLoading={!!checkInLoading[area.id]} />
          ))}
          {checkInError && <p className="text-sm text-destructive text-center pb-2">{checkInError}</p>}
        </motion.div>
      )}
    </div>
  );
};

export default Index;
