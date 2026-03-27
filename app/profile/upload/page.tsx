"use client";

import { useState, useRef, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  ImagePlus, X, Lock, Unlock, ChevronLeft, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";

const EXPIRES_OPTIONS = [
  { label: "24 hours", hours: 24 },
  { label: "7 days",   hours: 24 * 7 },
  { label: "30 days",  hours: 24 * 30 },
  { label: "Forever",  hours: null },
];

export default function UploadPostPage() {
  const router = useRouter();
  const { user, checked } = useSession();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview]       = useState<string | null>(null);
  const [file, setFile]             = useState<File | null>(null);
  const [caption, setCaption]       = useState("");
  const [isPremium, setIsPremium]   = useState(false);
  const [unlockPrice, setUnlockPrice] = useState("");
  const [expiresIdx, setExpiresIdx] = useState(0);
  const [uploading, setUploading]   = useState(false);
  const [error, setError]           = useState<string | null>(null);

  if (checked && !user) {
    router.replace("/auth/signin");
    return null;
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setError(null);
  }

  function removeFile() {
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handlePublish() {
    if (!user) return;
    if (!file && !caption.trim()) {
      setError("Add a photo or write a caption to publish.");
      return;
    }
    setUploading(true);
    setError(null);

    let mediaUrl: string | null = null;

    // 1. Upload file if present
    if (file) {
      const ext  = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("status-updates")
        .upload(path, file, { upsert: false });

      if (uploadErr) {
        setError("Photo upload failed. Please try again.");
        setUploading(false);
        return;
      }

      const { data } = supabase.storage.from("status-updates").getPublicUrl(path);
      mediaUrl = data.publicUrl;
    }

    // 2. Compute expires_at
    const opt = EXPIRES_OPTIONS[expiresIdx];
    const expiresAt = opt.hours
      ? new Date(Date.now() + opt.hours * 60 * 60 * 1000).toISOString()
      : new Date("2099-01-01").toISOString();

    // 3. Insert status_update row
    const pricePence = isPremium && unlockPrice
      ? Math.round(parseFloat(unlockPrice) * 100)
      : null;

    const { error: insertErr } = await supabase.from("status_updates").insert({
      provider_id:  user.id,
      caption:      caption.trim() || null,
      media_url:    mediaUrl,
      expires_at:   expiresAt,
      is_premium:   isPremium,
      unlock_price: isPremium ? pricePence : null,
    });

    if (insertErr) {
      setError("Failed to publish post. Please try again.");
      setUploading(false);
      return;
    }

    router.push("/profile");
  }

  const canPublish = !uploading && (!!file || caption.trim().length > 0);

  return (
    <div className="min-h-screen bg-zinc-950 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/5 bg-zinc-950/90 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-[15px] font-semibold text-white">New Post</span>
        <button
          onClick={handlePublish}
          disabled={!canPublish}
          className={cn(
            "rounded-full px-4 py-1.5 text-[13px] font-semibold transition",
            canPublish
              ? "bg-amber-400 text-zinc-950 hover:bg-amber-300"
              : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
          )}
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : "Publish"}
        </button>
      </header>

      <div className="mx-auto max-w-lg space-y-0">
        {/* Photo picker */}
        <div
          onClick={() => !preview && fileInputRef.current?.click()}
          className={cn(
            "relative w-full bg-zinc-900",
            !preview && "flex aspect-square cursor-pointer flex-col items-center justify-center gap-3 border-b border-white/5 transition hover:bg-zinc-800/60"
          )}
        >
          {preview ? (
            <>
              <div className="relative aspect-square w-full overflow-hidden">
                <Image src={preview} alt="Preview" fill className="object-cover" />
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeFile(); }}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-md hover:bg-black/90"
              >
                <X size={16} />
              </button>
            </>
          ) : (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800">
                <ImagePlus size={28} className="text-zinc-400" />
              </div>
              <p className="text-[13px] text-zinc-400">Tap to add a photo</p>
              <p className="text-[11px] text-zinc-600">JPG, PNG, WebP · max 10 MB</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Caption */}
        <div className="border-b border-white/5 px-4 py-4">
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write a caption…"
            maxLength={500}
            rows={3}
            className="w-full resize-none bg-transparent text-[15px] text-white placeholder-zinc-600 outline-none"
          />
          <p className="mt-1 text-right text-[11px] text-zinc-600">{caption.length}/500</p>
        </div>

        {/* Expires */}
        <div className="border-b border-white/5 px-4 py-4">
          <p className="mb-3 text-[12px] font-medium uppercase tracking-widest text-zinc-500">Expires after</p>
          <div className="flex gap-2 flex-wrap">
            {EXPIRES_OPTIONS.map((opt, i) => (
              <button
                key={opt.label}
                onClick={() => setExpiresIdx(i)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-[13px] font-medium transition",
                  expiresIdx === i
                    ? "border-amber-400 bg-amber-400/10 text-amber-400"
                    : "border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Premium toggle */}
        <div className="border-b border-white/5 px-4 py-4">
          <button
            onClick={() => setIsPremium((p) => !p)}
            className="flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl transition",
                isPremium ? "bg-amber-400/15 text-amber-400" : "bg-zinc-800 text-zinc-500"
              )}>
                {isPremium ? <Lock size={18} /> : <Unlock size={18} />}
              </div>
              <div className="text-left">
                <p className="text-[14px] font-medium text-white">Premium content</p>
                <p className="text-[12px] text-zinc-500">Subscribers only, or set a pay-per-view price</p>
              </div>
            </div>
            <div className={cn(
              "relative h-6 w-11 rounded-full transition-colors",
              isPremium ? "bg-amber-400" : "bg-zinc-700"
            )}>
              <div className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-all",
                isPremium ? "left-[22px]" : "left-0.5"
              )} />
            </div>
          </button>

          <AnimatePresence>
            {isPremium && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-900 px-4 py-3">
                  <span className="text-[14px] font-semibold text-amber-400">CA$</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Pay-per-view price (optional)"
                    value={unlockPrice}
                    onChange={(e) => setUnlockPrice(e.target.value)}
                    className="flex-1 bg-transparent text-[14px] text-white placeholder-zinc-600 outline-none"
                  />
                </div>
                <p className="mt-2 px-1 text-[11px] text-zinc-600">
                  Leave blank to make it subscribers-only with no unlock price.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mx-4 mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[13px] text-red-400"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom publish */}
        <div className="px-4 pt-6">
          <button
            onClick={handlePublish}
            disabled={!canPublish}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-semibold transition",
              canPublish
                ? "bg-amber-400 text-zinc-950 hover:bg-amber-300 active:scale-[0.98]"
                : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            )}
          >
            {uploading && <Loader2 size={18} className="animate-spin" />}
            {uploading ? "Publishing…" : "Publish Post"}
          </button>
        </div>
      </div>
    </div>
  );
}
