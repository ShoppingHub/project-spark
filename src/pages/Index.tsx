import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemo } from "@/hooks/useDemo";
import { useI18n } from "@/hooks/useI18n";
import { Eye } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { it, enUS } from "date-fns/locale";
import { getDemoAreas, getDemoTodayCheckins } from "@/lib/demoData";
import type { Database } from "@/integrations/supabase/types";

type Area = Database["public"]["Tables"]["areas"]["Row"];

interface GymDayInfo {
  areaId: string;
  dayLabel: string;
  dayName: string;
}

const Index = () => {
  const { user } = useAuth();
  const { isDemo } = useDemo();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [areas, setAreas] = useState<Area[]>([]);
  const [checkedIn, setCheckedIn] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [checkInLoadingId, setCheckInLoadingId] = useState<string | null>(null);
  const [gymDayInfo, setGymDayInfo] = useState<GymDayInfo | null>(null);

  const today = format(new Date(), "yyyy-MM-dd");
  const todayFormatted = format(new Date(), "d MMMM", { locale: locale === "it" ? it : enUS });

  const fetchData = useCallback(async () => {
    if (isDemo) {
      setAreas(getDemoAreas());
      setCheckedIn(getDemoTodayCheckins());
      setLoading(false);
      return;
    }
    if (!user) return;

    const [areasRes, checkinsRes] = await Promise.all([
      supabase.from("areas").select("*").eq("user_id", user.id).is("archived_at", null).order("created_at", { ascending: true }),
      supabase.from("checkins").select("area_id, completed").eq("user_id", user.id).eq("date", today).eq("completed", true),
    ]);

    const areasData = areasRes.data || [];
    setAreas(areasData);

    const map: Record<string, boolean> = {};
    if (checkinsRes.data) {
      for (const c of checkinsRes.data) map[c.area_id] = true;
    }
    setCheckedIn(map);

    // Gym day info
    const gymArea = areasData.find(
      (a) => a.type === "health" && /^(gym|palestra)$/i.test(a.name)
    );
    if (gymArea) {
      await fetchGymDayInfo(gymArea.id, user.id);
    }

    setLoading(false);
  }, [user, isDemo, today]);

  const fetchGymDayInfo = async (areaId: string, userId: string) => {
    try {
      const { data: program } = await supabase
        .from("gym_programs").select("id").eq("area_id", areaId).single();
      if (!program) return;

      // Check if today's session exists
      const { data: todaySession } = await supabase
        .from("gym_sessions").select("id").eq("area_id", areaId).eq("date", today).single();
      if (todaySession) return; // already done today

      // Get all days
      const { data: days } = await supabase
        .from("gym_program_days").select("id, name, order").eq("program_id", program.id).order("order");
      if (!days || days.length === 0) return;

      // Get last session to determine next day
      const { data: lastSession } = await supabase
        .from("gym_sessions").select("day_id").eq("area_id", areaId).eq("user_id", userId)
        .order("date", { ascending: false }).limit(1).single();

      let nextDay = days[0];
      if (lastSession) {
        const lastIdx = days.findIndex((d) => d.id === lastSession.day_id);
        nextDay = days[(lastIdx + 1) % days.length];
      }

      // Get muscle group names for this day
      const { data: groups } = await supabase
        .from("gym_muscle_groups").select("name").eq("day_id", nextDay.id).order("order");
      const groupNames = groups?.map((g) => g.name).join(", ") || "";

      const dayNumber = nextDay.order + 1;
      const dayLabel = locale === "it" ? `Giorno ${dayNumber}` : `Day ${dayNumber}`;

      setGymDayInfo({
        areaId,
        dayLabel,
        dayName: groupNames,
      });
    } catch { /* silent */ }
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCheckIn = async (areaId: string) => {
    if (isDemo || !user) return;
    setCheckInLoadingId(areaId);
    // Optimistic update
    setCheckedIn((prev) => ({ ...prev, [areaId]: true }));
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
    } catch {
      // Revert optimistic update
      setCheckedIn((prev) => ({ ...prev, [areaId]: false }));
    } finally {
      setCheckInLoadingId(null);
    }
  };

  const allCheckedIn = areas.length > 0 && areas.every((a) => checkedIn[a.id]);

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14">
        <span className="text-[18px] font-semibold"><span className="text-foreground">opad</span><span style={{ color: '#B5453A' }}>.me</span></span>
        <span className="text-sm text-muted-foreground capitalize">{todayFormatted}</span>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3 px-4 pb-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-card animate-pulse h-20" />
          ))}
        </div>
      ) : areas.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
          <Eye size={48} className="text-primary" strokeWidth={1.5} />
          <div className="text-center space-y-2">
            <p className="text-[18px] font-medium">{t("home.empty.title")}</p>
            <p className="text-sm text-muted-foreground">{t("home.empty.description")}</p>
          </div>
          <button
            onClick={() => navigate("/activities")}
            className="h-12 px-6 rounded-xl bg-primary text-primary-foreground font-medium text-base hover:opacity-90 transition-opacity min-h-[44px]"
          >
            {t("home.empty.button")}
          </button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="flex flex-col gap-3 px-4 pb-4"
        >
          {areas.map((area) => {
            const done = !!checkedIn[area.id];
            const isLoading = checkInLoadingId === area.id;
            const isGym = gymDayInfo?.areaId === area.id;

            return (
              <div
                key={area.id}
                className="rounded-xl bg-card p-4 flex items-center justify-between gap-3 cursor-pointer active:opacity-80 transition-opacity"
                onClick={() => navigate(`/activities/${area.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium truncate">{area.name}</p>
                  {isGym && gymDayInfo && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {gymDayInfo.dayLabel}{gymDayInfo.dayName ? ` — ${gymDayInfo.dayName}` : ""} →
                    </p>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); if (!done && !isLoading) handleCheckIn(area.id); }}
                  disabled={done || isLoading}
                  className={`flex-shrink-0 min-h-[36px] px-4 rounded-lg text-sm font-medium border transition-all flex items-center justify-center gap-2 ${
                    done
                      ? "bg-primary/20 text-primary border-primary"
                      : "bg-transparent text-foreground border-primary"
                  } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {isLoading ? (
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : done ? t("card.observed") : t("card.logToday")}
                </button>
              </div>
            );
          })}

          {allCheckedIn && (
            <p className="text-sm text-muted-foreground text-center mt-2">
              {t("home.allLogged")}
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default Index;
