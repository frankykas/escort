"use client";

import { useState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";

type Props = {
  userId: string | null;
  onSubmit: (body: string) => Promise<void>;
  submitting: boolean;
};

export function CommentInput({ userId, onSubmit, submitting }: Props) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim() || submitting) return;
    await onSubmit(value);
    setValue("");
  }

  if (!userId) {
    return (
      <div className="flex items-center gap-2 px-3 py-4 border-t border-zinc-900">
        <div className="h-8 w-8 rounded-full bg-zinc-800 flex-shrink-0" />
        <Link
          href="/auth/signin"
          className="text-[13px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {t("post_sign_in_comment")}
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-3 px-3 py-3 border-t border-zinc-900"
    >
      <div className="h-7 w-7 rounded-full bg-zinc-800 flex-shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
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
  );
}
