"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useSession } from "@/hooks/useSession";
import { getPushState, subscribeToPush, type PushState } from "@/lib/push-client";

/**
 * PushPermissionPrompt
 *
 * Floating bottom-sheet style prompt that asks the user to enable push
 * notifications. Shown once per user per browser — dismissals are persisted
 * in localStorage so it doesn't nag.
 *
 * Only appears when:
 *   - user is signed in
 *   - browser supports Web Push
 *   - permission is still "default" (not granted, not denied)
 *   - user hasn't dismissed the prompt before on this device
 */

const DISMISS_KEY_PREFIX = "push-prompt-dismissed-v1:";
// Wait a bit after page load so we don't punch the user in the face instantly
const SHOW_DELAY_MS = 4000;

export function PushPermissionPrompt() {
  const { user } = useSession();
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;

    const dismissKey = `${DISMISS_KEY_PREFIX}${user.id}`;
    if (typeof window === "undefined") return;
    if (localStorage.getItem(dismissKey)) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const state: PushState = await getPushState();
      if (cancelled) return;
      // Only show when permission hasn't been decided yet
      if (state === "default") setVisible(true);
    }, SHOW_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [user]);

  const dismiss = () => {
    if (user) {
      localStorage.setItem(`${DISMISS_KEY_PREFIX}${user.id}`, "1");
    }
    setVisible(false);
  };

  const enable = async () => {
    if (!user || submitting) return;
    setSubmitting(true);
    try {
      const ok = await subscribeToPush(user.id);
      if (ok) {
        // Permanent: they granted it
        localStorage.setItem(`${DISMISS_KEY_PREFIX}${user.id}`, "1");
        setVisible(false);
      } else {
        // Denied or failed — don't nag again
        dismiss();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed inset-x-4 bottom-20 z-[60] mx-auto max-w-md rounded-2xl border border-zinc-800 bg-zinc-950/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-md sm:bottom-6"
        >
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="absolute right-3 top-3 rounded-full p-1 text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-300"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-start gap-3 pr-6">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-400/10 text-amber-400">
              <Bell className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-zinc-100">
                Get notified instantly
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                Enable push notifications to hear about new messages, bookings and
                activity the moment they happen.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={enable}
                  disabled={submitting}
                  className="rounded-full bg-amber-400 px-4 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-amber-300 disabled:opacity-60"
                >
                  {submitting ? "Enabling…" : "Enable"}
                </button>
                <button
                  onClick={dismiss}
                  className="rounded-full px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-200"
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
