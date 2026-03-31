"use client";

import { useState, useRef, useEffect, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  ImagePlus, X, Lock, Unlock, ChevronLeft, Loader2,
  Film, Camera, Coins, ShoppingBag, CheckCircle, Share2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";
import { useProfile } from "@/contexts/ProfileContext";
import { supabase } from "@/lib/supabase/client";
import { USE_POSTING_PACKAGES } from "@/lib/features";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type PostType = "post" | "story";
type Step = "editor" | "success";

export default function UploadPostPage() {
  const router = useRouter();
  const { user, checked } = useSession();
  const { profile: myProfile } = useProfile();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep]               = useState<Step>("editor");
  const [postType, setPostType]       = useState<PostType>("post");
  const [preview, setPreview]         = useState<string | null>(null);
  const [file, setFile]               = useState<File | null>(null);
  const [caption, setCaption]         = useState("");
  const [isPremium, setIsPremium]     = useState(false);
  const [unlockPrice, setUnlockPrice] = useState("");
  const [uploading, setUploading]     = useState(false);
  const [error, setError]             = useState<string | null>(null);

  // Credit balance (only fetched when posting packages are enabled)
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(false);

  useEffect(() => {
    if (!user || !USE_POSTING_PACKAGES) return;
    setLoadingCredits(true);
    supabase
      .from("profiles")
      .select("post_credits_balance")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        setCreditBalance(data?.post_credits_balance ?? 0);
        setLoadingCredits(false);
      });
  }, [user]);

  if (checked && !user) {
    router.replace("/auth/signin");
    return null;
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

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

    // Stories require media
    if (postType === "story" && !file) {
      setError("Stories require a photo or video.");
      return;
    }
    // Posts require at least a caption or photo
    if (postType === "post" && !file && !caption.trim()) {
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

    // 2. Call the appropriate API
    if (postType === "story") {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: user.id,
          mediaUrl,
          mediaType: "image",
          caption: caption.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to publish story.");
        setUploading(false);
        return;
      }
    } else {
      // Feed post — goes through /api/posts which handles credit deduction + cooldown
      const pricePence = isPremium && unlockPrice
        ? Math.round(parseFloat(unlockPrice) * 100)
        : null;

      if (mediaUrl) {
        const res = await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerId: user.id,
            caption: caption.trim() || "",
            mediaUrl,
            mediaType: "image",
            postType: "post",
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "Failed to publish post.");
          setUploading(false);
          return;
        }

        if (isPremium && json.postId) {
          await supabase.from("status_updates").update({
            is_premium: true,
            unlock_price: pricePence,
          }).eq("id", json.postId);
        }
      } else {
        const res = await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerId: user.id,
            caption: caption.trim(),
            mediaUrl: "", // text-only
            mediaType: "text",
            postType: "post",
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "Failed to publish post.");
          setUploading(false);
          return;
        }
        if (isPremium && json.postId) {
          await supabase.from("status_updates").update({
            is_premium: true,
            unlock_price: pricePence,
          }).eq("id", json.postId);
        }
      }
    }

    if (needsCredits && creditBalance !== null) {
      setCreditBalance(creditBalance - 1);
    }

    setUploading(false);
    setStep("success");
  }

  const isStory = postType === "story";
  const canPublish = !uploading && (
    isStory ? !!file : (!!file || caption.trim().length > 0)
  );
  const needsCredits = USE_POSTING_PACKAGES && postType === "post";
  const hasCredits = creditBalance !== null && creditBalance > 0;

  if (step === "success") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 text-center pb-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6"
        >
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
            <CheckCircle size={48} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {isStory ? "Story Shared!" : "Post Published!"}
            </h1>
            <p className="mt-2 text-zinc-400">
              {isStory
                ? "Your story is now visible to your followers for the next 24 hours."
                : "Your post is now live on your profile and explore feed."
              }
            </p>
          </div>

          <div className="mt-4 flex w-full max-w-sm flex-col gap-3">
            <button
              onClick={async () => {
                if (navigator.share) {
                  await navigator.share({
                    title: `Check out my new ${isStory ? "story" : "post"}!`,
                    url: `${window.location.origin}/u/${myProfile?.username ?? ""}`
                  }).catch(() => {});
                }
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 py-4 text-[15px] font-bold text-zinc-950 transition hover:bg-amber-300"
            >
              <Share2 size={18} /> Share Update
            </button>
            <button
              onClick={() => router.push(myProfile?.username ? `/u/${myProfile.username}` : "/profile")}
              className="w-full rounded-2xl bg-zinc-900 py-4 text-[15px] font-semibold text-zinc-300 transition hover:bg-zinc-800"
            >
              View on Profile
            </button>
            <button
              onClick={() => router.push("/")}
              className="text-[14px] font-medium text-zinc-500 hover:text-zinc-300 transition"
            >
              Go to Dashboard
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

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
        <span className="text-[15px] font-semibold text-white">
          {isStory ? "New Story" : "New Post"}
        </span>
        <button
          onClick={handlePublish}
          disabled={!canPublish || (needsCredits && !hasCredits)}
          className={cn(
            "rounded-full px-4 py-1.5 text-[13px] font-semibold transition",
            canPublish && (!needsCredits || hasCredits)
              ? "bg-amber-400 text-zinc-950 hover:bg-amber-300"
              : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
          )}
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : "Publish"}
        </button>
      </header>

      <div className="mx-auto max-w-lg space-y-0">
        <div className="flex border-b border-white/5">
          <button
            onClick={() => setPostType("post")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 py-3.5 text-[13px] font-semibold uppercase tracking-wider transition",
              postType === "post"
                ? "text-amber-400 border-b-2 border-amber-400"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <Camera size={16} />
            Post
          </button>
          <button
            onClick={() => setPostType("story")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 py-3.5 text-[13px] font-semibold uppercase tracking-wider transition",
              postType === "story"
                ? "text-amber-400 border-b-2 border-amber-400"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <Film size={16} />
            Story
          </button>
        </div>

        {needsCredits && (
          <div className={cn(
            "flex items-center justify-between px-4 py-3 border-b border-white/5",
            hasCredits ? "bg-amber-400/5" : "bg-red-500/5"
          )}>
            <div className="flex items-center gap-2.5">
              <Coins size={16} className={hasCredits ? "text-amber-400" : "text-red-400"} />
              <span className="text-[13px] text-zinc-300">
                {loadingCredits
                  ? "Loading credits…"
                  : hasCredits
                    ? `${creditBalance} post credit${creditBalance === 1 ? "" : "s"} remaining`
                    : "No post credits remaining"
                }
              </span>
            </div>
            {!hasCredits && !loadingCredits && (
              <button
                onClick={() => router.push("/profile/packages")}
                className="flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-[11px] font-semibold text-zinc-950 hover:bg-amber-300 transition"
              >
                <ShoppingBag size={12} />
                Buy Credits
              </button>
            )}
          </div>
        )}

        {isStory && (
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/5 bg-blue-500/5">
            <Film size={16} className="text-blue-400" />
            <span className="text-[13px] text-zinc-400">
              Stories are free and disappear after 24 hours
            </span>
          </div>
        )}

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
              <p className="text-[13px] text-zinc-400">
                Tap to add a photo{isStory ? "" : " (optional)"}
              </p>
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

        <div className="border-b border-white/5 px-4 py-4">
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={isStory ? "Add a caption (optional)…" : "Write a caption…"}
            maxLength={500}
            rows={isStory ? 2 : 3}
            className="w-full resize-none bg-transparent text-[15px] text-white placeholder-zinc-600 outline-none"
          />
          <p className="mt-1 text-right text-[11px] text-zinc-600">{caption.length}/500</p>
        </div>

        {!isStory && (
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
        )}

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

        <div className="px-4 pt-6">
          <button
            onClick={handlePublish}
            disabled={!canPublish || (needsCredits && !hasCredits)}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-semibold transition",
              canPublish && (!needsCredits || hasCredits)
                ? "bg-amber-400 text-zinc-950 hover:bg-amber-300 active:scale-[0.98]"
                : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            )}
          >
            {uploading && <Loader2 size={18} className="animate-spin" />}
            {uploading
              ? "Publishing…"
              : isStory
                ? "Share Story"
                : needsCredits
                  ? `Publish Post (1 credit)`
                  : "Publish Post"
            }
          </button>
        </div>
      </div>
    </div>
  );
}
