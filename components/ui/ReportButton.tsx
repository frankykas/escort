"use client";

import { useState } from "react";
import { Flag, X, Loader2, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { useProfile } from "@/contexts/ProfileContext";

const REASONS = [
  { value: "spam", label: "Spam" },
  { value: "fake_profile", label: "Fake profile" },
  { value: "harassment", label: "Harassment" },
  { value: "underage", label: "Underage" },
  { value: "non_consensual", label: "Non-consensual content" },
  { value: "scam", label: "Scam / fraud" },
  { value: "inappropriate_content", label: "Inappropriate content" },
  { value: "other", label: "Other" },
] as const;

type ReportTarget = "profile" | "listing" | "post" | "message";

type Props = {
  targetType: ReportTarget;
  targetId: string;
  className?: string;
};

type Step = "closed" | "form" | "sending" | "done" | "already";

export function ReportButton({ targetType, targetId, className }: Props) {
  const { profile } = useProfile();
  const [step, setStep] = useState<Step>("closed");
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");

  async function submit() {
    if (!profile || !reason) return;
    setStep("sending");

    const { error } = await supabase.from("reports").insert({
      reporter_id: profile.id,
      target_type: targetType,
      target_id: targetId,
      reason,
      details: details.trim() || null,
    });

    if (error?.code === "23505") {
      setStep("already");
    } else {
      setStep("done");
    }
  }

  function close() {
    setStep("closed");
    setReason(null);
    setDetails("");
  }

  if (!profile) return null;

  return (
    <>
      <button
        onClick={() => setStep("form")}
        className={cn(
          "flex items-center gap-1.5 text-[12px] text-slate-400 transition hover:text-red-400",
          className
        )}
      >
        <Flag size={13} />
        Report
      </button>

      <AnimatePresence>
        {step !== "closed" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm sm:items-center"
            onClick={close}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-t-3xl bg-white border border-gray-200 p-6 sm:rounded-3xl"
            >
              {/* Header */}
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-[16px] font-semibold text-slate-800">
                  {step === "done" || step === "already" ? "Report" : `Report ${targetType}`}
                </h3>
                <button
                  onClick={close}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-slate-400 transition hover:text-slate-700"
                >
                  <X size={16} />
                </button>
              </div>

              {step === "done" && (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-pink-50">
                    <CheckCircle size={28} className="text-pink-500" />
                  </div>
                  <p className="text-[14px] font-medium text-slate-800">Report submitted</p>
                  <p className="text-[13px] text-slate-500">
                    Our team will review this and take action if needed.
                  </p>
                  <button
                    onClick={close}
                    className="mt-2 w-full rounded-xl bg-gray-100 py-3 text-[14px] font-medium text-slate-700 transition hover:bg-gray-200"
                  >
                    Close
                  </button>
                </div>
              )}

              {step === "already" && (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <p className="text-[14px] text-slate-400">
                    You have already reported this {targetType}. Our team is reviewing it.
                  </p>
                  <button
                    onClick={close}
                    className="mt-2 w-full rounded-xl bg-gray-100 py-3 text-[14px] font-medium text-slate-700 transition hover:bg-gray-200"
                  >
                    Close
                  </button>
                </div>
              )}

              {(step === "form" || step === "sending") && (
                <>
                  <p className="mb-3 text-[13px] text-slate-500">
                    Select a reason for your report:
                  </p>

                  <div className="space-y-2">
                    {REASONS.map((r) => (
                      <button
                        key={r.value}
                        onClick={() => setReason(r.value)}
                        className={cn(
                          "w-full rounded-xl border px-4 py-3 text-left text-[13px] transition",
                          reason === r.value
                            ? "border-pink-300 bg-pink-50 text-pink-500"
                            : "border-gray-200 bg-gray-50 text-slate-700 hover:border-gray-300"
                        )}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>

                  {reason === "other" && (
                    <textarea
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      placeholder="Please describe the issue..."
                      maxLength={500}
                      rows={3}
                      className="mt-3 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[13px] text-slate-700 placeholder-slate-400 outline-none focus:border-pink-300"
                    />
                  )}

                  <button
                    onClick={submit}
                    disabled={!reason || step === "sending"}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/90 py-3 text-[14px] font-semibold text-white transition hover:bg-red-500 disabled:opacity-40"
                  >
                    {step === "sending" ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit Report"
                    )}
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
