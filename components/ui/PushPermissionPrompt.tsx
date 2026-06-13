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
      const ok = await subscribeToPush();
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
          className="fixed inset-x-4 bottom-20 z-[60] mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-4 shadow-lg backdrop-blur-md sm:bottom-6"
        >
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="absolute right-3 top-3 rounded-full p-1 text-slate-400 transition-colors hover:bg-gray-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-start gap-3 pr-6">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-pink-50 text-pink-500">
              <Bell className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-slate-700">
                Get notified instantly
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Enable push notifications to hear about new messages, bookings and
                activity the moment they happen.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={enable}
                  disabled={submitting}
                  className="rounded-full bg-pink-400 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-pink-300 disabled:opacity-60"
                >
                  {submitting ? "Enabling..." : "Enable"}
                </button>
                <button
                  onClick={dismiss}
                  className="rounded-full px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-700"
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
