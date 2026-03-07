import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { format } from "date-fns";
import { Plus, ChevronDown, ChevronUp, Trash2, Dumbbell } from "lucide-react";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Exercise {
  id: string;
  session_id: string;
  name: string;
  sets: number;
  reps: number;
  weight_kg: number | null;
  notes: string | null;
  order: number;
}

interface Session {
  id: string;
  date: string;
  exercises: Exercise[];
}

interface GymCardProps {
  areaId: string;
  onAutoCheckIn: () => void;
}

export function GymCard({ areaId, onAutoCheckIn }: GymCardProps) {
  const { user } = useAuth();
  const { t } = useI18n();
  const today = format(new Date(), "yyyy-MM-dd");

  const [todayExercises, setTodayExercises] = useState<Exercise[]>([]);
  const [todaySessionId, setTodaySessionId] = useState<string | null>(null);
  const [pastSessions, setPastSessions] = useState<Session[]>([]);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Bottom sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [formName, setFormName] = useState("");
  const [formSets, setFormSets] = useState("");
  const [formReps, setFormReps] = useState("");
  const [formWeight, setFormWeight] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;

    // Today's session
    const { data: todaySession } = await supabase
      .from("gym_sessions")
      .select("id")
      .eq("area_id", areaId)
      .eq("user_id", user.id)
      .eq("date", today)
      .single();

    if (todaySession) {
      setTodaySessionId(todaySession.id);
      const { data: exercises } = await supabase
        .from("gym_exercises")
        .select("*")
        .eq("session_id", todaySession.id)
        .order("order", { ascending: true });
      setTodayExercises((exercises as Exercise[]) || []);
    } else {
      setTodaySessionId(null);
      setTodayExercises([]);
    }

    // Past sessions
    const { data: sessions } = await supabase
      .from("gym_sessions")
      .select("id, date")
      .eq("area_id", areaId)
      .eq("user_id", user.id)
      .neq("date", today)
      .order("date", { ascending: false })
      .limit(30);

    if (sessions && sessions.length > 0) {
      const sessionIds = sessions.map((s) => s.id);
      const { data: allExercises } = await supabase
        .from("gym_exercises")
        .select("*")
        .in("session_id", sessionIds)
        .order("order", { ascending: true });

      const exerciseMap: Record<string, Exercise[]> = {};
      for (const ex of (allExercises as Exercise[]) || []) {
        if (!exerciseMap[ex.session_id]) exerciseMap[ex.session_id] = [];
        exerciseMap[ex.session_id].push(ex);
      }

      setPastSessions(
        sessions
          .filter((s) => exerciseMap[s.id]?.length > 0)
          .map((s) => ({ id: s.id, date: s.date, exercises: exerciseMap[s.id] || [] }))
      );
    } else {
      setPastSessions([]);
    }

    setLoading(false);
  }, [user, areaId, today]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAddSheet = () => {
    setEditingExercise(null);
    setFormName(""); setFormSets(""); setFormReps(""); setFormWeight(""); setFormNotes("");
    setSheetOpen(true);
  };

  const openEditSheet = (ex: Exercise) => {
    setEditingExercise(ex);
    setFormName(ex.name);
    setFormSets(String(ex.sets));
    setFormReps(String(ex.reps));
    setFormWeight(ex.weight_kg ? String(ex.weight_kg) : "");
    setFormNotes(ex.notes || "");
    setSheetOpen(true);
  };

  const isFormValid = formName.trim() !== "" && parseInt(formSets) > 0 && parseInt(formReps) > 0;

  const handleSave = async () => {
    if (!user || !isFormValid) return;
    setSaving(true);

    try {
      let sessionId = todaySessionId;
      const isFirstExercise = !sessionId;

      // Create session if needed
      if (!sessionId) {
        const { data: newSession, error } = await supabase
          .from("gym_sessions")
          .insert({ area_id: areaId, user_id: user.id, date: today })
          .select("id")
          .single();
        if (error || !newSession) { setSaving(false); return; }
        sessionId = newSession.id;
        setTodaySessionId(sessionId);
      }

      if (editingExercise) {
        // Update
        await supabase
          .from("gym_exercises")
          .update({
            name: formName.trim(),
            sets: parseInt(formSets),
            reps: parseInt(formReps),
            weight_kg: formWeight ? parseFloat(formWeight) : null,
            notes: formNotes.trim() || null,
          })
          .eq("id", editingExercise.id);
      } else {
        // Insert
        const nextOrder = todayExercises.length;
        await supabase
          .from("gym_exercises")
          .insert({
            session_id: sessionId,
            name: formName.trim(),
            sets: parseInt(formSets),
            reps: parseInt(formReps),
            weight_kg: formWeight ? parseFloat(formWeight) : null,
            notes: formNotes.trim() || null,
            order: nextOrder,
          });
      }

      // Auto check-in on first exercise
      if (isFirstExercise) {
        onAutoCheckIn();
      }

      setSheetOpen(false);
      await fetchData();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingExercise) return;
    setSaving(true);
    await supabase.from("gym_exercises").delete().eq("id", editingExercise.id);

    // If last exercise in session, delete session too
    if (todayExercises.length <= 1 && todaySessionId) {
      await supabase.from("gym_sessions").delete().eq("id", todaySessionId);
    }

    setSheetOpen(false);
    setSaving(false);
    await fetchData();
  };

  const formatExerciseDetail = (ex: Exercise) => {
    if (ex.weight_kg && ex.weight_kg > 0) {
      return `${ex.sets} × ${ex.weight_kg}kg`;
    }
    return `${ex.sets} ${t("gym.sets")} × ${ex.reps} ${t("gym.reps")}`;
  };

  if (loading) {
    return (
      <div className="mt-6 flex flex-col gap-3">
        <div className="h-5 w-32 rounded bg-card animate-pulse" />
        <div className="h-14 rounded-lg bg-card animate-pulse" />
        <div className="h-14 rounded-lg bg-card animate-pulse" />
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      {/* Section title */}
      <div className="flex items-center gap-2">
        <Dumbbell size={18} strokeWidth={1.5} className="text-[#7DA3A0]" />
        <h2 className="text-base font-semibold">{t("gym.title")}</h2>
      </div>

      {/* Today's session */}
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground font-medium">{t("gym.todaySession")}</p>

        {todayExercises.length === 0 ? (
          <div className="rounded-lg bg-card flex flex-col items-center justify-center py-6 gap-2">
            <p className="text-sm text-muted-foreground">{t("gym.empty")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {todayExercises.map((ex) => (
              <button
                key={ex.id}
                onClick={() => openEditSheet(ex)}
                className="flex flex-col px-4 py-3 rounded-lg bg-[#1F4A50] text-left min-h-[48px] hover:opacity-90 transition-opacity"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-medium text-sm">{ex.name}</span>
                  <span className="text-sm text-muted-foreground">{formatExerciseDetail(ex)}</span>
                </div>
                {ex.notes && (
                  <span className="text-xs text-muted-foreground mt-0.5">{ex.notes}</span>
                )}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={openAddSheet}
          className="flex items-center justify-center gap-1.5 text-sm font-medium text-[#7DA3A0] min-h-[44px] hover:opacity-80 transition-opacity"
        >
          <Plus size={16} />
          {t("gym.addExercise")}
        </button>
      </div>

      {/* Past sessions */}
      {pastSessions.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground font-medium">{t("gym.history")}</p>
          <div className="flex flex-col gap-1.5">
            {pastSessions.map((session) => {
              const isExpanded = expandedSession === session.id;
              const dateLabel = format(new Date(session.date + "T00:00:00"), "dd/MM/yyyy");
              return (
                <div key={session.id} className="rounded-lg bg-card overflow-hidden">
                  <button
                    onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                    className="flex items-center justify-between w-full px-4 py-3 min-h-[48px]"
                  >
                    <span className="text-sm">{dateLabel}</span>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="text-xs">{session.exercises.length} {t("gym.exercises")}</span>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-3 flex flex-col gap-1">
                      {session.exercises.map((ex) => (
                        <div key={ex.id} className="flex items-center justify-between py-1.5">
                          <span className="text-sm font-medium">{ex.name}</span>
                          <span className="text-xs text-muted-foreground">{formatExerciseDetail(ex)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom sheet */}
      <Drawer open={sheetOpen} onOpenChange={setSheetOpen}>
        <DrawerContent className="bg-card border-border">
          <DrawerHeader>
            <DrawerTitle>
              {editingExercise ? t("gym.editExercise") : t("gym.addExercise")}
            </DrawerTitle>
          </DrawerHeader>

          <div className="px-4 flex flex-col gap-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">{t("gym.form.name")}</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t("gym.form.namePlaceholder")}
                maxLength={100}
                className="bg-background border-border"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">{t("gym.form.sets")}</label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={formSets}
                  onChange={(e) => setFormSets(e.target.value)}
                  min={1}
                  max={99}
                  className="bg-background border-border"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">{t("gym.form.reps")}</label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={formReps}
                  onChange={(e) => setFormReps(e.target.value)}
                  min={1}
                  max={999}
                  className="bg-background border-border"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">{t("gym.form.weight")}</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={formWeight}
                  onChange={(e) => setFormWeight(e.target.value)}
                  min={0}
                  step={0.5}
                  placeholder={t("gym.form.weightPlaceholder")}
                  className="bg-background border-border"
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-1 block">{t("gym.form.notes")}</label>
              <Textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder={t("gym.form.notesPlaceholder")}
                maxLength={500}
                rows={2}
                className="bg-background border-border resize-none"
              />
            </div>
          </div>

          <DrawerFooter className="flex flex-col gap-2">
            <button
              onClick={handleSave}
              disabled={!isFormValid || saving}
              className="w-full min-h-[48px] rounded-lg bg-[#7DA3A0] text-[#0F2F33] font-medium text-base disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              {saving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mx-auto" /> : t("gym.form.save")}
            </button>

            {editingExercise && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="w-full min-h-[44px] rounded-lg text-[#E24A4A] font-medium text-sm hover:opacity-80 transition-opacity disabled:opacity-40"
              >
                {t("gym.form.delete")}
              </button>
            )}

            <DrawerClose asChild>
              <button className="w-full min-h-[44px] text-sm text-muted-foreground">
                {t("gym.form.cancel")}
              </button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
