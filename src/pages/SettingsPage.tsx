import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
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

const SettingsPage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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
    <div className="flex flex-col px-4 pt-6 gap-8">
      <h1 className="text-[28px] font-semibold leading-[1.2]">Settings</h1>

      <div className="flex flex-col gap-4">
        {/* Account section */}
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Signed in as</p>
          <p className="text-base">{user?.email}</p>
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full h-12 rounded-xl bg-card ring-1 ring-border font-medium text-base flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity min-h-[44px]"
        >
          {signingOut && <Loader2 size={18} className="animate-spin" />}
          Sign out
        </button>

        {/* Delete account */}
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
    </div>
  );
};

export default SettingsPage;
