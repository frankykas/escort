"use client";

import { useState, useEffect } from "react";
import { Heart, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSignupPrompt } from "@/hooks/useSignupPrompt";

type Props = { listingId: string; title: string };

export function ListingActions({ listingId, title }: Props) {
  const [saved, setSaved] = useState(false);
  const [shareFlash, setShareFlash] = useState(false);
  const { promptIfGuest, modal: signupModal } = useSignupPrompt();

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("saved_listings") ?? "[]") as string[];
    setSaved(saved.includes(listingId));
  }, [listingId]);

  function toggleSave() {
    if (promptIfGuest("favorite")) return;
    const current = JSON.parse(localStorage.getItem("saved_listings") ?? "[]") as string[];
    const next = saved
      ? current.filter((id) => id !== listingId)
      : [...current, listingId];
    localStorage.setItem("saved_listings", JSON.stringify(next));
    setSaved(!saved);
  }

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
      setShareFlash(true);
      setTimeout(() => setShareFlash(false), 2000);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {signupModal}
      <button
        onClick={handleShare}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition hover:bg-black/70"
        aria-label="Share"
      >
        <Share2 size={16} className={cn(shareFlash && "text-pink-400")} />
      </button>
      <button
        onClick={toggleSave}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 backdrop-blur-md transition hover:bg-black/70"
        aria-label={saved ? "Unsave" : "Save"}
      >
        <Heart
          size={16}
          className={cn(
            "transition-colors",
            saved ? "fill-rose-500 text-rose-500" : "text-white"
          )}
        />
      </button>
    </div>
  );
}
