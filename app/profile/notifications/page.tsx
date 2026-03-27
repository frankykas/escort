"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, MessageCircle, UserPlus, Crown,
  Mail, Smartphone, Heart, Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";

type Prefs = {
  email_new_message:    boolean;
  email_new_enquiry:    boolean;
  email_new_subscriber: boolean;
  email_new_follower:   boolean;
  push_enabled:         boolean;
};

const DEFAULT_PREFS: Prefs = {
  email_new_message:    true,
  email_new_enquiry:    true,
  email_new_subscriber: true,
  email_new_follower:   false,
  push_enabled:         false,
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 rounded-full transition-colors",
        checked ? "bg-amber-400" : "bg-zinc-700"
      )}
    >
      <div className={cn(
        "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-all",
        checked ? "left-[22px]" : "left-0.5"
      )} />
    </button>
  );
}

function Row({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
  iconColor = "text-zinc-400",
  disabled = false,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  iconColor?: string;
  disabled?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-4 px-4 py-4", disabled && "opacity-40")}>
      <div className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-zinc-800", iconColor)}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium text-white">{title}</p>
        <p className="text-[12px] text-zinc-500 leading-snug mt-0.5">{description}</p>
      </div>
      <Toggle checked={checked} onChange={disabled ? () => {} : onChange} />
    </div>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const { user, checked } = useSession();

  const [prefs, setPrefs]   = useState<Prefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast]   = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!checked) return;
    if (!user) { router.replace("/auth/signin"); return; }
    supabase
      .from("profiles")
      .select("notification_prefs")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.notification_prefs) {
          setPrefs({ ...DEFAULT_PREFS, ...(data.notification_prefs as Prefs) });
        }
        setLoaded(true);
      });
  }, [user, checked]);

  async function updatePref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    if (!user) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    const { error } = await supabase
      .from("profiles")
      .update({ notification_prefs: next })
      .eq("id", user.id);
    if (error) {
      showToast("Failed to save", false);
      setPrefs(prefs); // revert
    } else {
      showToast("Saved", true);
    }
  }

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2000);
  }

  return (
    <div className="min-h-screen bg-zinc-950 pb-20">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/5 bg-zinc-950/90 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-[15px] font-semibold text-white">Notifications</span>
      </header>

      {!loaded ? (
        <div className="flex items-center justify-center pt-24">
          <Loader2 size={24} className="animate-spin text-zinc-600" />
        </div>
      ) : (
        <div className="mx-auto max-w-lg space-y-2 pt-4 px-4">
          {/* Email notifications */}
          <p className="px-1 pb-1 text-[11px] font-medium uppercase tracking-widest text-zinc-600">Email</p>
          <div className="overflow-hidden rounded-2xl bg-zinc-900 border border-white/5 divide-y divide-white/5">
            <Row
              icon={MessageCircle}
              title="New message"
              description="When someone sends you a direct message"
              checked={prefs.email_new_message}
              iconColor="text-emerald-400"
              onChange={(v) => updatePref("email_new_message", v)}
            />
            <Row
              icon={Mail}
              title="New enquiry"
              description="When a visitor submits an enquiry on your listing"
              checked={prefs.email_new_enquiry}
              iconColor="text-sky-400"
              onChange={(v) => updatePref("email_new_enquiry", v)}
            />
            <Row
              icon={Crown}
              title="New subscriber"
              description="When someone subscribes to your profile"
              checked={prefs.email_new_subscriber}
              iconColor="text-amber-400"
              onChange={(v) => updatePref("email_new_subscriber", v)}
            />
            <Row
              icon={UserPlus}
              title="New follower"
              description="When someone starts following you"
              checked={prefs.email_new_follower}
              iconColor="text-violet-400"
              onChange={(v) => updatePref("email_new_follower", v)}
            />
          </div>

          {/* Push notifications */}
          <p className="px-1 pb-1 pt-4 text-[11px] font-medium uppercase tracking-widest text-zinc-600">Push</p>
          <div className="overflow-hidden rounded-2xl bg-zinc-900 border border-white/5">
            <Row
              icon={Smartphone}
              title="Push notifications"
              description="Real-time alerts on your device (coming soon)"
              checked={prefs.push_enabled}
              iconColor="text-zinc-400"
              onChange={(v) => updatePref("push_enabled", v)}
              disabled
            />
          </div>
          <p className="px-1 pt-1 text-[12px] text-zinc-600">
            Push notifications will be available in a future update.
          </p>

          {/* Likes row — always on, no toggle */}
          <p className="px-1 pb-1 pt-4 text-[11px] font-medium uppercase tracking-widest text-zinc-600">Always on</p>
          <div className="overflow-hidden rounded-2xl bg-zinc-900 border border-white/5">
            <div className="flex items-center gap-4 px-4 py-4 opacity-50">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-rose-400">
                <Heart size={18} />
              </div>
              <div className="flex-1">
                <p className="text-[14px] font-medium text-white">Security alerts</p>
                <p className="text-[12px] text-zinc-500">Sign-in from a new device, password changes</p>
              </div>
              <span className="text-[12px] text-zinc-500">Always on</span>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className={cn(
              "fixed bottom-24 left-1/2 -translate-x-1/2 rounded-full px-5 py-2.5 text-[13px] font-medium shadow-xl",
              toast.ok ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
            )}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
