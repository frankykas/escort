"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useSignupPrompt } from "@/hooks/useSignupPrompt";

type Props = {
  userId: string | null;
  onSubmit: (body: string) => Promise<void>;
  submitting: boolean;
};

export function CommentInput({ userId, onSubmit, submitting }: Props) {
  const { t } = useTranslation();
  const { promptIfGuest, modal: signupModal } = useSignupPrompt();
  const [value, setValue] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (promptIfGuest("comment")) return;
    if (!value.trim() || submitting) return;
    await onSubmit(value);
    setValue("");
  }

  function handleFocus() {
    if (!userId) promptIfGuest("comment");
  }

  return (
    <>
      {signupModal}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-3 px-3 py-3 border-t border-zinc-900"
      >
        <div className="h-7 w-7 rounded-full bg-zinc-800 flex-shrink-0" />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={handleFocus}
          maxLength={500}
          placeholder={t("post_add_comment")}
          className="flex-1 bg-transparent text-[13px] text-zinc-100 placeholder-zinc-600 outline-none"
        />
        <button
          type="submit"
          disabled={!value.trim() || submitting}
          aria-label="Post comment"
          className={cn(
            "transition-opacity",
            value.trim() && !submitting ? "opacity-100 text-amber-400" : "opacity-30 text-zinc-600"
          )}
        >
          <Send size={18} />
        </button>
      </form>
    </>
  );
}
