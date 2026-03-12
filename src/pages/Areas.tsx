import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemo } from "@/hooks/useDemo";
import { useI18n } from "@/hooks/useI18n";
import { Plus, ChevronRight, Heart, BookOpen, TrendingDown, Wallet } from "lucide-react";
import { motion } from "framer-motion";
import { getDemoAreas } from "@/lib/demoData";
import type { Database } from "@/integrations/supabase/types";
import type { TranslationKey } from "@/i18n/translations";

type Area = Database["public"]["Tables"]["areas"]["Row"];
type AreaType = Database["public"]["Enums"]["area_type"];

const sections: { type: AreaType; labelKey: TranslationKey; icon: typeof Heart }[] = [
  { type: "health", labelKey: "areas.section.health", icon: Heart },
  { type: "study", labelKey: "areas.section.study", icon: BookOpen },
  { type: "reduce", labelKey: "areas.section.reduce", icon: TrendingDown },
  { type: "finance", labelKey: "areas.section.finance", icon: Wallet },
];

const Areas = () => {
  const { user } = useAuth();
  const { isDemo } = useDemo();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAreas = useCallback(async () => {
    if (isDemo) {
      setAreas(getDemoAreas());
      setLoading(false);
      return;
    }
    if (!user) return;
    const { data } = await supabase
      .from("areas").select("*").eq("user_id", user.id)
      .is("archived_at", null).order("created_at", { ascending: true });
    if (data) setAreas(data);
    setLoading(false);
  }, [user, isDemo]);

  useEffect(() => { fetchAreas(); }, [fetchAreas]);

  const grouped = (type: AreaType) => areas.filter((a) => a.type === type);

  if (loading) {
    return (
      <div className="flex flex-col px-4 pt-2 pb-8">
        <div className="flex items-center justify-between h-14">
          <div className="h-5 w-16 rounded bg-card animate-pulse" />
          <div className="h-8 w-8 rounded bg-card animate-pulse" />
        </div>
        <div className="flex flex-col gap-8 mt-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-3">
              <div className="h-4 w-24 rounded bg-card animate-pulse" />
              <div className="h-12 w-full rounded-lg bg-card animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }} className="flex flex-col px-4 pt-2 pb-8">
      <div className="flex items-center justify-between h-14">
        <h1 className="text-[18px] font-semibold">{t("areas.title")}</h1>
        {!isDemo && (
          <button onClick={() => navigate("/activities/new")}
            className="flex items-center justify-center h-10 w-10 min-h-[44px] min-w-[44px]">
            <Plus size={24} strokeWidth={1.5} className="text-[#7DA3A0]" />
          </button>
        )}
      </div>
      <div className="flex flex-col gap-8 mt-2">
        {sections.map(({ type, labelKey, icon: Icon }) => {
          const items = grouped(type);
          return (
            <div key={type} className="space-y-3">
              <div className="flex items-center gap-2">
                <Icon size={16} strokeWidth={1.5} className="text-[#B9C0C1]" />
                <span className="text-sm font-medium text-[#B9C0C1]">{t(labelKey)}</span>
              </div>
              {items.map((area) => (
                <button key={area.id} onClick={() => navigate(`/areas/${area.id}`)}
                  className="w-full flex items-center justify-between rounded-lg bg-[#1F4A50] px-4 min-h-[48px] hover:opacity-90 transition-opacity">
                  <span className="text-base text-foreground truncate mr-3">{area.name}</span>
                  <ChevronRight size={18} strokeWidth={1.5} className="text-[#B9C0C1] flex-shrink-0" />
                </button>
              ))}
              {!isDemo && (
                <button onClick={() => navigate(`/areas/new?type=${type}`)}
                  className="text-sm font-medium text-[#7DA3A0] hover:opacity-80 transition-opacity min-h-[36px] flex items-center">
                  {t("areas.add")}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default Areas;
