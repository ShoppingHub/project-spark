import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOnboarding } from "@/pages/OnboardingLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AreaTypePill } from "@/components/AreaTypePill";
import { Minus, Plus, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import type { Database } from "@/integrations/supabase/types";

type AreaType = Database["public"]["Enums"]["area_type"];

export default function OnboardingFrequency() {
  const { areas, setAreas } = useOnboarding();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // If no areas selected, redirect back
  if (areas.length === 0) {
    navigate("/onboarding/areas", { replace: true });
    return null;
  }

  const updateFrequency = (name: string, delta: number) => {
    setAreas(
      areas.map((a) =>
        a.name === name
          ? { ...a, frequency: Math.min(7, Math.max(1, a.frequency + delta)) }
          : a
      )
    );
  };

  const updateType = (name: string, type: AreaType) => {
    setAreas(
      areas.map((a) => (a.name === name ? { ...a, type } : a))
    );
  };

  const allTypesAssigned = areas.every((a) => a.type !== null);

  const handleSave = async () => {
    if (!user || !allTypesAssigned) return;
    setSaving(true);
    setError("");

    try {
      // Insert areas
      const { error: areasError } = await supabase.from("areas").insert(
        areas.map((a) => ({
          user_id: user.id,
          name: a.name,
          type: a.type as AreaType,
          frequency_per_week: a.frequency,
        }))
      );

      if (areasError) throw areasError;

      navigate("/", { replace: true });
    } catch {
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
  };

  const typeOptions: AreaType[] = ["health", "study", "reduce", "finance"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="flex flex-1 flex-col gap-8"
    >
      <h1 className="text-[28px] font-semibold leading-[1.2]">
        How many days per week?
      </h1>

      <div className="flex flex-col gap-4">
        {areas.map((area) => (
          <div key={area.name} className="rounded-xl bg-card p-4 space-y-3">
            {/* Name + type pill */}
            <div className="flex items-center justify-between">
              <span className="text-base font-medium">{area.name}</span>
              {area.type && <AreaTypePill type={area.type} />}
            </div>

            {/* Type selector for custom areas */}
            {!area.isPreset && (
              <div className="flex gap-2 flex-wrap">
                {typeOptions.map((t) => (
                  <button
                    key={t}
                    onClick={() => updateType(area.name, t)}
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors min-h-[32px] ${
                      area.type === t
                        ? "bg-primary/20 border-primary text-foreground"
                        : "bg-transparent border-border text-muted-foreground"
                    }`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            )}

            {/* Stepper */}
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={() => updateFrequency(area.name, -1)}
                disabled={area.frequency <= 1}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-border text-foreground hover:bg-card disabled:opacity-30 transition-opacity min-h-[44px] min-w-[44px]"
              >
                <Minus size={18} />
              </button>
              <span className="text-[28px] font-semibold w-8 text-center leading-none">
                {area.frequency}
              </span>
              <button
                onClick={() => updateFrequency(area.name, 1)}
                disabled={area.frequency >= 7}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-border text-foreground hover:bg-card disabled:opacity-30 transition-opacity min-h-[44px] min-w-[44px]"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* CTA */}
      <div className="mt-auto pt-8">
        <button
          onClick={handleSave}
          disabled={saving || !allTypesAssigned}
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-medium text-base flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity min-h-[44px]"
        >
          {saving && <Loader2 size={18} className="animate-spin" />}
          Start observing
        </button>
      </div>
    </motion.div>
  );
}
