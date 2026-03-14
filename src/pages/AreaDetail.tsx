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
      setCheckinMap(getDemoCheckinsLast30(id));
      const todayMap = getDemoTodayCheckins();
      setTodayCheckedIn(!!todayMap[id]);
      setLoading(false);
      return;
    }

    if (!user) return;
    const { data: areaData } = await supabase.from("areas").select("*").eq("id", id).single();
    if (!areaData) { setLoading(false); return; }
    setArea(areaData);
    const [checkinsRes, todayRes] = await Promise.all([
      supabase.from("checkins").select("date, completed").eq("area_id", id).eq("user_id", user.id).gte("date", format(subDays(new Date(), 29), "yyyy-MM-dd")),
      supabase.from("checkins").select("completed").eq("area_id", id).eq("user_id", user.id).eq("date", today).single(),
    ]);
    const cMap: Record<string, boolean> = {};
    if (checkinsRes.data) { for (const c of checkinsRes.data) { cMap[c.date] = c.completed; } }
    setCheckinMap(cMap);
    setTodayCheckedIn(todayRes.data?.completed ?? false);
    setLoading(false);
  }, [user, isDemo, id, today]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCheckIn = async () => {
    if (isDemo) return;
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
    } catch { setCheckInError(t("dashboard.error")); }
    finally { setCheckInLoading(false); }
  };

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="flex flex-col px-4 pt-2 pb-8 gap-4">
        <div className="flex items-center gap-3 h-14"><div className="h-6 w-6 rounded bg-card animate-pulse" /><div className="h-5 w-32 rounded bg-card animate-pulse" /></div>
        <div className="rounded-xl bg-card animate-pulse h-20" />
        <div className="rounded-xl bg-card animate-pulse h-20" />
      </motion.div>
    );
  }

  if (!area) {
    return (<div className="flex min-h-[60vh] items-center justify-center px-4"><p className="text-sm text-muted-foreground">{t("areaDetail.notFound")}</p></div>);
  }

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

      <div className="mt-4"><CalendarHeatmap checkins={checkinMap} /></div>

      {!isDemo && (
        <div className="mt-4">
          <button onClick={handleCheckIn} disabled={todayCheckedIn || checkInLoading}
            className={`w-full min-h-[44px] rounded-lg text-base font-medium border transition-all flex items-center justify-center gap-2 ${todayCheckedIn ? "bg-primary/20 text-primary border-primary" : "bg-transparent text-foreground border-primary"} ${checkInLoading ? "opacity-50 cursor-not-allowed" : ""}`}>
            {checkInLoading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : todayCheckedIn ? t("card.observed") : t("card.logToday")}
          </button>
        </div>
      )}
      {checkInError && <p className="mt-2 text-sm text-destructive text-center">{checkInError}</p>}

      {!isDemo && isGymArea && id && (
        <GymCard areaId={id} onAutoCheckIn={handleAutoCheckIn} />
      )}

      {!isDemo && (
        <button onClick={() => navigate(`/activities/${id}/edit`)} className="mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px] self-center">{t("areaDetail.editArea")}</button>
      )}
    </motion.div>
  );
}
