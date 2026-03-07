import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { AreaTypePill } from "@/components/AreaTypePill";
import { ArrowLeft, Minus, Plus, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import type { Database } from "@/integrations/supabase/types";
import type { TranslationKey } from "@/i18n/translations";

type AreaType = Database["public"]["Enums"]["area_type"];
const typeOptions: AreaType[] = ["health", "study", "reduce", "finance"];

const typeStylesSelected: Record<AreaType, string> = {
  health: "bg-[#7DA3A0]/20 text-[#7DA3A0] border-[#7DA3A0]",
  study: "bg-[#8C9496]/20 text-[#B9C0C1] border-[#8C9496]",
  reduce: "bg-[#BFA37A]/20 text-[#BFA37A] border-[#BFA37A]",
  finance: "bg-[#1F4A50] text-[#EAEAEA] border-[#7DA3A0]/60",
};

const typeLabelKeys: Record<AreaType, TranslationKey> = {
  health: "areaType.health",
  study: "areaType.study",
  reduce: "areaType.reduce",
  finance: "areaType.finance",
};

interface AreaFormProps { mode: "add" | "edit"; }

export default function AreaForm({ mode }: AreaFormProps) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const preselectedType = searchParams.get("type") as AreaType | null;
  const [name, setName] = useState("");
  const [type, setType] = useState<AreaType | null>(mode === "add" && preselectedType && typeOptions.includes(preselectedType) ? preselectedType : null);
  const [frequency, setFrequency] = useState(7);
  const [typeError, setTypeError] = useState("");
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState("");
  const [loadingData, setLoadingData] = useState(mode === "edit");

  useEffect(() => {
    if (mode !== "edit" || !id) return;
    (async () => {
      const { data } = await supabase.from("areas").select("*").eq("id", id).single();
      if (data) { setName(data.name); setType(data.type); setFrequency(data.frequency_per_week); }
      setLoadingData(false);
    })();
  }, [mode, id]);

  const handleSave = async () => {
    if (!user) return;
    const trimmedName = name.trim();
    if (!trimmedName) return;
    if (!type) { setTypeError(t("areaForm.typeError")); return; }
    setTypeError(""); setSaving(true); setError("");
    try {
      if (mode === "add") {
        const { error: insertError } = await supabase.from("areas").insert({ user_id: user.id, name: trimmedName, type, frequency_per_week: frequency });
        if (insertError) throw insertError;
        navigate("/", { replace: true });
      } else if (id) {
        const { error: updateError } = await supabase.from("areas").update({ name: trimmedName, type, frequency_per_week: frequency }).eq("id", id);
        if (updateError) throw updateError;
        navigate(`/areas/${id}`, { replace: true });
      }
    } catch { setError(t("areaForm.error")); setSaving(false); }
  };

  const handleArchive = async () => {
    if (!id) return;
    setArchiving(true); setError("");
    try {
      const { error: archiveError } = await supabase.from("areas").update({ archived_at: new Date().toISOString() }).eq("id", id);
      if (archiveError) throw archiveError;
      navigate("/", { replace: true });
    } catch { setError(t("areaForm.error")); setArchiving(false); }
  };

  const isValid = name.trim().length > 0 && type !== null;

  if (loadingData) {
    return (<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>);
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="flex flex-col min-h-full px-4 pt-2 pb-8">
      <div className="flex items-center gap-3 h-14">
        <button onClick={() => navigate(mode === "edit" ? `/areas/${id}` : "/")} className="flex items-center justify-center h-10 w-10 min-h-[44px] min-w-[44px]"><ArrowLeft size={24} strokeWidth={1.5} /></button>
        <h1 className="text-[18px] font-semibold">{mode === "add" ? t("areaForm.add.title") : t("areaForm.edit.title")}</h1>
      </div>
      <div className="flex flex-col gap-8 mt-4 flex-1">
        <div className="space-y-2">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("areaForm.namePlaceholder")}
            className="w-full h-12 rounded-xl bg-card px-4 text-base text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-border focus:ring-primary transition-colors" />
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {typeOptions.map((tp) => {
              const selected = type === tp;
              return (
                <button key={tp} onClick={() => { setType(tp); setTypeError(""); }}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors min-h-[36px] ${selected ? typeStylesSelected[tp] : "bg-transparent border-border text-muted-foreground"}`}>
                  {t(typeLabelKeys[tp])}
                </button>
              );
            })}
          </div>
          {typeError && <p className="text-sm text-destructive">{typeError}</p>}
        </div>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("areaForm.frequency")}</p>
          <div className="flex items-center justify-center gap-6">
            <button onClick={() => setFrequency((f) => Math.max(1, f - 1))} disabled={frequency <= 1}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-border text-foreground hover:bg-card disabled:opacity-30 transition-opacity min-h-[44px] min-w-[44px]"><Minus size={18} /></button>
            <span className="text-[28px] font-semibold w-8 text-center leading-none">{frequency}</span>
            <button onClick={() => setFrequency((f) => Math.min(7, f + 1))} disabled={frequency >= 7}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-border text-foreground hover:bg-card disabled:opacity-30 transition-opacity min-h-[44px] min-w-[44px]"><Plus size={18} /></button>
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="mt-auto pt-8 space-y-4">
          <button onClick={handleSave} disabled={!isValid || saving}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-medium text-base flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity min-h-[44px]">
            {saving && <Loader2 size={18} className="animate-spin" />}
            {mode === "add" ? t("areaForm.add.button") : t("areaForm.edit.button")}
          </button>
          {mode === "edit" && (
            <button onClick={handleArchive} disabled={archiving}
              className="w-full text-sm text-destructive hover:opacity-80 transition-opacity min-h-[44px] flex items-center justify-center gap-2">
              {archiving && <Loader2 size={16} className="animate-spin" />}
              {t("areaForm.archive")}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
