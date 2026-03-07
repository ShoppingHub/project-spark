import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { motion } from "framer-motion";

const SettingsPage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [scoreVisible, setScoreVisible] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Load settings
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("users")
        .select("settings_score_visible, settings_notifications")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setScoreVisible(data.settings_score_visible);
        setNotifications(data.settings_notifications);
      }
    })();
  }, [user]);

  const updateSetting = useCallback(
    async (field: "settings_score_visible" | "settings_notifications", value: boolean, rollback: () => void) => {
      if (!user) return;
      const { error } = await supabase
        .from("users")
        .update({ [field]: value })
        .eq("user_id", user.id);
      if (error) rollback();
    },
    [user]
  );

  const handleScoreToggle = (checked: boolean) => {
    const prev = scoreVisible;
    setScoreVisible(checked);
    updateSetting("settings_score_visible", checked, () => setScoreVisible(prev));
  };

  const handleNotificationsToggle = (checked: boolean) => {
    const prev = notifications;
    setNotifications(checked);
    updateSetting("settings_notifications", checked, () => setNotifications(prev));
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    navigate("/login", { replace: true });
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await supabase.functions.invoke("delete-account", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.error) {
        setDeleteError("Something went wrong. Please try again.");
        setDeleting(false);
        return;
      }

      await supabase.auth.signOut();
      navigate("/login", { replace: true });
    } catch {
      setDeleteError("Something went wrong. Please try again.");
      setDeleting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="flex flex-col px-4 pt-6 pb-8 gap-8"
    >
      <h1 className="text-[28px] font-semibold leading-[1.2]">Settings</h1>

      {/* Toggles */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between min-h-[44px]">
          <span className="text-base">Show trajectory score</span>
          <Switch
            checked={scoreVisible}
            onCheckedChange={handleScoreToggle}
            className="data-[state=checked]:bg-[#7DA3A0]"
          />
        </div>
        <div className="flex items-center justify-between min-h-[44px]">
          <span className="text-base">Notifications</span>
          <Switch
            checked={notifications}
            onCheckedChange={handleNotificationsToggle}
            className="data-[state=checked]:bg-[#7DA3A0]"
          />
        </div>
      </div>

      {/* Account section */}
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground font-medium">Account</p>

        <p className="text-base text-muted-foreground truncate">{user?.email}</p>

        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full h-12 rounded-xl bg-card ring-1 ring-border font-medium text-base flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity min-h-[44px]"
        >
          {signingOut && <Loader2 size={18} className="animate-spin" />}
          Sign out
        </button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="text-sm text-destructive hover:opacity-80 transition-opacity min-h-[44px]">
              Delete account
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="max-w-[340px] bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete account</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                This will permanently delete all your observation history. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
              <AlertDialogAction
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="bg-transparent text-destructive hover:bg-destructive/10 border-0 shadow-none flex items-center justify-center gap-2"
              >
                {deleting && <Loader2 size={18} className="animate-spin" />}
                Delete permanently
              </AlertDialogAction>
              <AlertDialogCancel className="bg-transparent border-0 shadow-none text-muted-foreground hover:text-foreground">
                Cancel
              </AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {deleteError && (
          <p className="text-sm text-destructive">{deleteError}</p>
        )}
      </div>
    </motion.div>
  );
};

export default SettingsPage;
