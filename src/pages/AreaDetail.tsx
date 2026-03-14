import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemo } from "@/hooks/useDemo";
import { useI18n } from "@/hooks/useI18n";
import { ArrowLeft } from "lucide-react";
import { AreaTypePill } from "@/components/AreaTypePill";
import { CalendarHeatmap } from "@/components/CalendarHeatmap";
import { GymCard } from "@/components/GymCard";
import { motion } from "framer-motion";
import { subDays, format } from "date-fns";
import { getDemoAreas, getDemoCheckinsLast30, getDemoTodayCheckins } from "@/lib/demoData";
import type { Database } from "@/integrations/supabase/types";

type Area = Database["public"]["Tables"]["areas"]["Row"];

export default function AreaDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { isDemo } = useDemo();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [area, setArea] = useState<Area | null>(null);
  const [checkinMap, setCheckinMap] = useState<Record<string, boolean>>({});
  const [todayCheckedIn, setTodayCheckedIn] = useState(false);
  const [scoreVisible, setScoreVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkInError, setCheckInError] = useState("");
  const today = format(new Date(), "yyyy-MM-dd");

  const fetchData = useCallback(async () => {
    if (!id) return;

    if (isDemo) {
      const demoArea = getDemoAreas().find((a) => a.id === id);
      if (!demoArea) { setLoading(false); return; }
      setArea(demoArea);
      const demoScores = getDemoScoresForRange(rangeToDays[timeRange]);
      setScores(demoScores[id] || []);
      setCheckinMap(getDemoCheckinsLast30(id));
      const todayMap = getDemoTodayCheckins();
      setTodayCheckedIn(!!todayMap[id]);
      setScoreVisible(true);
      setLoading(false);
      return;
    }

    if (!user) return;
    const { data: areaData } = await supabase.from("areas").select("*").eq("id", id).single();
    if (!areaData) { setLoading(false); return; }
    setArea(areaData);
    const startDate = format(subDays(new Date(), rangeToDays[timeRange]), "yyyy-MM-dd");
    const [scoresRes, checkinsRes, todayRes, userRes] = await Promise.all([
      supabase.from("score_daily").select("*").eq("area_id", id).gte("date", startDate).order("date", { ascending: true }),
      supabase.from("checkins").select("date, completed").eq("area_id", id).eq("user_id", user.id).gte("date", format(subDays(new Date(), 29), "yyyy-MM-dd")),
      supabase.from("checkins").select("completed").eq("area_id", id).eq("user_id", user.id).eq("date", today).single(),
      supabase.from("users").select("settings_score_visible").eq("user_id", user.id).single(),
    ]);
    if (scoresRes.data) { setScores(scoresRes.data.map((s) => ({ date: s.date, score: s.cumulative_score }))); }
    const cMap: Record<string, boolean> = {};
    if (checkinsRes.data) { for (const c of checkinsRes.data) { cMap[c.date] = c.completed; } }
    setCheckinMap(cMap);
    setTodayCheckedIn(todayRes.data?.completed ?? false);
    setScoreVisible(userRes.data?.settings_score_visible ?? false);
    setLoading(false);
  }, [user, isDemo, id, timeRange, today]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCheckIn = async () => {
    if (isDemo) return; // no-op in demo
    if (!user || !id) return;
    setCheckInLoading(true); setCheckInError("");
    try {
      const { error } = await supabase.from("checkins").upsert(
        { area_id: id, user_id: user.id, date: today, completed: true },
        { onConflict: "area_id,date" }
      );
      if (error) throw error;
      const { data: sessionData } = await supabase.auth.getSession();
      await supabase.functions.invoke("calculate-score", {
        body: { area_id: id, date: today },
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
      });
      setTodayCheckedIn(true);
      setCheckinMap((prev) => ({ ...prev, [today]: true }));
      const startDate = format(subDays(new Date(), rangeToDays[timeRange]), "yyyy-MM-dd");
      const { data: newScores } = await supabase.from("score_daily").select("*").eq("area_id", id).gte("date", startDate).order("date", { ascending: true });
      if (newScores) { setScores(newScores.map((s) => ({ date: s.date, score: s.cumulative_score }))); }
    } catch { setCheckInError(t("dashboard.error")); }
    finally { setCheckInLoading(false); }
  };

  const slope = computeSlope(scores);
  const lineColor = getLineColor(slope);
  const chartData = scores.length > 0 ? scores : [{ date: today, score: 0 }];
  const latestScore = scores.length > 0 ? scores[scores.length - 1].score : 0;

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="flex flex-col px-4 pt-2 pb-8 gap-4">
        <div className="flex items-center gap-3 h-14"><div className="h-6 w-6 rounded bg-card animate-pulse" /><div className="h-5 w-32 rounded bg-card animate-pulse" /></div>
        <div className="rounded-xl bg-card animate-pulse" style={{ height: "60vh" }} />
      </motion.div>
    );
  }

  if (!area) {
    return (<div className="flex min-h-[60vh] items-center justify-center px-4"><p className="text-sm text-muted-foreground">{t("areaDetail.notFound")}</p></div>);
  }

  const hasData = scores.length > 0 && scores.some((s) => s.score !== 0);
  const isGymArea = area.type === "health" && /^(gym|palestra)$/i.test(area.name);

  const handleAutoCheckIn = async () => {
    if (!user || !id || todayCheckedIn) return;
    try {
      await supabase.from("checkins").upsert(
        { area_id: id, user_id: user.id, date: today, completed: true },
        { onConflict: "area_id,date" }
      );
      const { data: sessionData } = await supabase.auth.getSession();
      await supabase.functions.invoke("calculate-score", {
        body: { area_id: id, date: today },
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
      });
      setTodayCheckedIn(true);
      setCheckinMap((prev) => ({ ...prev, [today]: true }));
      const startDate = format(subDays(new Date(), rangeToDays[timeRange]), "yyyy-MM-dd");
      const { data: newScores } = await supabase.from("score_daily").select("*").eq("area_id", id).gte("date", startDate).order("date", { ascending: true });
      if (newScores) { setScores(newScores.map((s) => ({ date: s.date, score: s.cumulative_score }))); }
    } catch { /* silent */ }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="flex flex-col px-4 pt-2 pb-8">
      <div className="flex items-center justify-between h-14">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/activities")} className="flex items-center justify-center h-10 w-10 min-h-[44px] min-w-[44px]"><ArrowLeft size={24} strokeWidth={1.5} /></button>
          <span className="text-[18px] font-semibold">{area.name}</span>
          <AreaTypePill type={area.type} />
        </div>
        {!isDemo && (
          <button onClick={() => navigate(`/activities/${id}/edit`)} className="text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px] flex items-center">{t("areaDetail.editArea")}</button>
        )}
      </div>
      <div className="flex justify-center py-3"><TimeRangeSelector value={timeRange} onChange={setTimeRange} /></div>

      {hasData ? (
        <div className="rounded-xl bg-card p-4" style={{ height: "60vh" }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="0" horizontal vertical={false} stroke="#EAEAEA" strokeOpacity={0.1} />
              <XAxis dataKey="date" tick={{ fill: "#B9C0C1", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(d: string) => `${new Date(d).getDate()}/${new Date(d).getMonth() + 1}`} interval="preserveStartEnd" />
              <YAxis hide />
              <Line type="monotone" dataKey="score" stroke={lineColor} strokeWidth={2} dot={false} isAnimationActive animationDuration={300} animationEasing="ease-in-out" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="rounded-xl bg-card flex flex-col items-center justify-center gap-4" style={{ height: "60vh" }}>
          <TrendingUp size={48} className="text-muted-foreground" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground text-center px-8">{t("areaDetail.emptyGraph")}</p>
        </div>
      )}

      <div className="mt-4"><CalendarHeatmap checkins={checkinMap} /></div>

      {scoreVisible && (
        <div className="mt-4 space-y-1">
          <p className="text-sm text-muted-foreground">{t("areaDetail.score")}</p>
          <p className="text-[28px] font-semibold">{latestScore.toFixed(1)}</p>
        </div>
      )}

      {!isDemo && (
        <div className="mt-4">
          <button onClick={handleCheckIn} disabled={todayCheckedIn || checkInLoading}
            className={`w-full min-h-[44px] rounded-lg text-base font-medium border transition-all flex items-center justify-center gap-2 ${todayCheckedIn ? "bg-[#7DA3A0]/20 text-[#7DA3A0] border-[#7DA3A0]" : "bg-transparent text-foreground border-[#7DA3A0]"} ${checkInLoading ? "opacity-50 cursor-not-allowed" : ""}`}>
            {checkInLoading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : todayCheckedIn ? t("card.observed") : t("card.logToday")}
          </button>
        </div>
      )}
      {checkInError && <p className="mt-2 text-sm text-destructive text-center">{checkInError}</p>}

      {/* Gym Card */}
      {!isDemo && isGymArea && id && (
        <GymCard areaId={id} onAutoCheckIn={handleAutoCheckIn} />
      )}

      {!isDemo && (
        <button onClick={() => navigate(`/activities/${id}/edit`)} className="mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px] self-center">{t("areaDetail.editArea")}</button>
      )}
    </motion.div>
  );
}
