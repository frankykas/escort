"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Eye, EyeOff, Shield, UserX, Bell, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 rounded-full transition-colors",
        checked ? "bg-amber-400" : "bg-zinc-700"
      )}
    >
      <div
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-all",
          checked ? "left-[22px]" : "left-0.5"
        )}
      />
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
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  iconColor?: string;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-4">
      <div className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-zinc-800", iconColor)}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium text-white">{title}</p>
        <p className="text-[12px] text-zinc-500 leading-snug mt-0.5">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

export default function PrivacyPage() {
  const router = useRouter();
  const { user, checked } = useSession();

  const [isPrivate, setIsPrivate]         = useState(false);
  const [hideOnline, setHideOnline]       = useState(false);
  const [hideActivity, setHideActivity]   = useState(false);
  const [loaded, setLoaded]               = useState(false);
  const [saving, setSaving]               = useState(false);
  const [toast, setToast]                 = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!checked) return;
    if (!user) { router.replace("/auth/signin"); return; }
    supabase
      .from("profiles")
      .select("is_private, hide_online_status, hide_activity")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setIsPrivate(data.is_private ?? false);
          setHideOnline(data.hide_online_status ?? false);
          setHideActivity(data.hide_activity ?? false);
        }
        setLoaded(true);
      });
  }, [user, checked]);

  async function save(field: string, value: boolean) {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ [field]: value })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      showToast("Failed to save. Please try again.", false);
    } else {
      showToast("Saved", true);
    }
  }

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
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
        <span className="text-[15px] font-semibold text-white">Privacy &amp; Safety</span>
        {saving && <Loader2 size={14} className="ml-auto animate-spin text-zinc-500" />}
      </header>

      {!loaded ? (
        <div className="flex items-center justify-center pt-24">
          <Loader2 size={24} className="animate-spin text-zinc-600" />
        </div>
      ) : (
        <div className="mx-auto max-w-lg space-y-2 pt-4 px-4">
          {/* Profile Visibility */}
          <p className="px-1 pb-1 text-[11px] font-medium uppercase tracking-widest text-zinc-600">Profile</p>
          <div className="overflow-hidden rounded-2xl bg-zinc-900 border border-white/5 divide-y divide-white/5">
            <Row
              icon={isPrivate ? EyeOff : Eye}
              title="Private profile"
              description="Hidden from search, Explore, and the public feed. Only direct link visitors can see you."
              checked={isPrivate}
              iconColor={isPrivate ? "text-amber-400" : "text-zinc-400"}
              onChange={(v) => { setIsPrivate(v); save("is_private", v); }}
            />
            <Row
              icon={Bell}
              title="Hide online status"
              description="Others won't see when you were last active."
              checked={hideOnline}
              onChange={(v) => { setHideOnline(v); save("hide_online_status", v); }}
            />
            <Row
              icon={UserX}
              title="Hide activity"
              description="Likes and follows you make won't be visible to others."
              checked={hideActivity}
              onChange={(v) => { setHideActivity(v); save("hide_activity", v); }}
            />
          </div>

          {/* Safety */}
          <p className="px-1 pb-1 pt-4 text-[11px] font-medium uppercase tracking-widest text-zinc-600">Safety</p>
          <div className="overflow-hidden rounded-2xl bg-zinc-900 border border-white/5">
            <div className="flex items-center gap-4 px-4 py-4">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-red-400">
                <Shield size={18} />
              </div>
              <div className="flex-1">
                <p className="text-[14px] font-medium text-white">Blocked users</p>
                <p className="text-[12px] text-zinc-500">Manage who can't contact or view your profile</p>
              </div>
              <span className="text-[12px] text-zinc-600">Coming soon</span>
            </div>
          </div>

          <p className="px-1 pt-4 text-[12px] leading-relaxed text-zinc-600">
            Private mode does not affect existing followers or subscribers. Your profile remains accessible to anyone with a direct link.
          </p>
        </div>
      )}

      {/* Toast */}
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
