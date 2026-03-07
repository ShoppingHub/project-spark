import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { Mail, AlertCircle, Loader2 } from "lucide-react";
import { z } from "zod";

const emailSchema = z.string().email();

type Screen = "welcome" | "check-email" | "link-expired";

const Login = () => {
  const { session, loading } = useAuth();
  const [screen, setScreen] = useState<Screen>("welcome");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [genericError, setGenericError] = useState("");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (session) {
    return <Navigate to="/" replace />;
  }

  const validateEmail = (value: string): boolean => {
    const result = emailSchema.safeParse(value);
    if (!result.success) {
      setEmailError("Please enter a valid email address.");
      return false;
    }
    setEmailError("");
    return true;
  };

  const handleSendMagicLink = async () => {
    if (!validateEmail(email)) return;
    setMagicLinkLoading(true);
    setGenericError("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        setGenericError("Something went wrong. Please try again.");
      } else {
        setScreen("check-email");
      }
    } catch {
      setGenericError("Something went wrong. Please try again.");
    } finally {
      setMagicLinkLoading(false);
    }
  };

  const handleResend = async () => {
    setMagicLinkLoading(true);
    setGenericError("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        setGenericError("Something went wrong. Please try again.");
      }
    } catch {
      setGenericError("Something went wrong. Please try again.");
    } finally {
      setMagicLinkLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setGenericError("");
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        const errMsg = result.error?.message || "";
        // User cancelled — no error shown
        if (errMsg.includes("cancelled") || errMsg.includes("closed") || errMsg.includes("popup")) {
          // silent
        } else {
          setGenericError("Google login failed. Please try again.");
        }
      }
    } catch {
      setGenericError("Google login failed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  // Check email screen
  if (screen === "check-email") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 max-w-[428px] mx-auto">
        <div className="flex flex-col items-center gap-6 w-full">
          <Mail size={48} className="text-primary" strokeWidth={1.5} />
          <div className="text-center space-y-2">
            <h1 className="text-[28px] font-semibold leading-[1.2]">Check your email.</h1>
            <p className="text-sm text-muted-foreground">
              We sent you a magic link to
            </p>
            <p className="text-sm font-medium">{email}</p>
          </div>
          <button
            onClick={handleResend}
            disabled={magicLinkLoading}
            className="text-sm text-primary underline underline-offset-4 hover:opacity-80 disabled:opacity-50"
          >
            {magicLinkLoading ? "Sending..." : "Didn't get it? Send again"}
          </button>
          {genericError && (
            <p className="text-sm text-destructive">{genericError}</p>
          )}
        </div>
      </div>
    );
  }

  // Link expired screen
  if (screen === "link-expired") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 max-w-[428px] mx-auto">
        <div className="flex flex-col items-center gap-6 w-full">
          <AlertCircle size={48} className="text-graph-decline" strokeWidth={1.5} />
          <h1 className="text-[28px] font-semibold leading-[1.2] text-center">
            This link has expired or is invalid.
          </h1>
          <div className="w-full space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
              placeholder="your@email.com"
              className="w-full h-12 rounded-xl bg-card px-4 text-base text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-border focus:ring-primary transition-colors"
            />
            {emailError && (
              <p className="text-sm text-destructive">{emailError}</p>
            )}
            <button
              onClick={() => {
                if (validateEmail(email)) {
                  handleSendMagicLink();
                }
              }}
              disabled={magicLinkLoading || !email}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-medium text-base flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity min-h-[44px]"
            >
              {magicLinkLoading && <Loader2 size={18} className="animate-spin" />}
              Send a new link
            </button>
          </div>
          {genericError && (
            <p className="text-sm text-destructive">{genericError}</p>
          )}
        </div>
      </div>
    );
  }

  // Welcome screen (default)
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 max-w-[428px] mx-auto">
      <div className="flex flex-col items-center gap-8 w-full">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-[28px] font-semibold leading-[1.2]">BetonMe</h1>
          <p className="text-sm text-muted-foreground">Observe your direction.</p>
        </div>

        {/* Email + Magic Link */}
        <div className="w-full space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailError(""); setGenericError(""); }}
            placeholder="your@email.com"
            className="w-full h-12 rounded-xl bg-card px-4 text-base text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-border focus:ring-primary transition-colors"
          />
          {emailError && (
            <p className="text-sm text-destructive">{emailError}</p>
          )}
          <button
            onClick={handleSendMagicLink}
            disabled={!email || magicLinkLoading}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-medium text-base flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity min-h-[44px]"
          >
            {magicLinkLoading && <Loader2 size={18} className="animate-spin" />}
            Send me a link
          </button>
        </div>

        {/* Divider */}
        <div className="flex w-full items-center gap-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Google */}
        <button
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          className="w-full h-12 rounded-xl bg-card ring-1 ring-border font-medium text-base flex items-center justify-center gap-3 hover:opacity-90 disabled:opacity-50 transition-opacity min-h-[44px]"
        >
          {googleLoading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
          )}
          Continue with Google
        </button>

        {/* Caption */}
        <p className="text-xs text-muted-foreground">No password needed.</p>

        {genericError && (
          <p className="text-sm text-destructive text-center">{genericError}</p>
        )}
      </div>
    </div>
  );
};

export default Login;
