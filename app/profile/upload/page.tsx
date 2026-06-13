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
import { apiFetch } from "@/lib/api-fetch";
import { useSession } from "@/hooks/useSession";
import { useProfile } from "@/contexts/ProfileContext";
import { supabase } from "@/lib/supabase/client";
import { USE_POSTING_PACKAGES } from "@/lib/features";
import { compressImage } from "@/lib/image";
import { useTranslation } from "@/lib/i18n/useTranslation";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type PostType = "post" | "story";
type Step = "editor" | "success";

const ACCEPTED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
];
const ACCEPTED_MEDIA = ACCEPTED_MEDIA_TYPES.join(",");
const MAX_MEDIA_BYTES = 80 * 1024 * 1024;

export default function UploadPostPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, checked } = useSession();
  const { profile: myProfile } = useProfile();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep]               = useState<Step>("editor");
  const [postType, setPostType]       = useState<PostType>(() => {
    if (typeof window === "undefined") return "post";
    return (localStorage.getItem("upload_draft_type") as PostType) ?? "post";
  });
  const [preview, setPreview]         = useState<string | null>(null);
  const [file, setFile]               = useState<File | null>(null);
  const [caption, setCaption]         = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("upload_draft_caption") ?? "";
  });
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

  // Persist draft to localStorage
  useEffect(() => {
    localStorage.setItem("upload_draft_caption", caption);
  }, [caption]);
  useEffect(() => {
    localStorage.setItem("upload_draft_type", postType);
  }, [postType]);

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
    if (!ACCEPTED_MEDIA_TYPES.includes(f.type)) {
      setError("Use a JPEG, PNG, WebP, MP4, WebM, or MOV file.");
      e.target.value = "";
      return;
    }
    if (f.size > MAX_MEDIA_BYTES) {
      setError("Media must be under 80 MB.");
      e.target.value = "";
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setError(null);
  }

  function removeFile() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handlePublish() {
    if (!user) return;

    // Stories require media
    if (postType === "story" && !file) {
      setError(t("up_err_story_media"));
      return;
    }
    // Posts require at least a caption or photo
    if (postType === "post" && !file && !caption.trim()) {
      setError(t("up_err_post_empty"));
      return;
    }

    setUploading(true);
    setError(null);

    let mediaUrl: string | null = null;
    let uploadedMediaType: "image" | "video" | "text" = "text";

    // 1. Upload file if present (images are compressed client-side first)
    if (file) {
      const mediaType = file.type.startsWith("video/") ? "video" : "image";
      uploadedMediaType = mediaType;
      const compressed = mediaType === "image"
        ? await compressImage(file, { maxDimension: 1600, quality: 0.82 })
        : file;
      const ext  = compressed.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("status-updates")
        .upload(path, compressed, { upsert: false, contentType: compressed.type });

      if (uploadErr) {
        setError(t("up_err_photo"));
        setUploading(false);
        return;
      }

      const { data } = supabase.storage.from("status-updates").getPublicUrl(path);
      mediaUrl = data.publicUrl;
    }

    // 2. Call the appropriate API
    if (postType === "story") {
      const res = await apiFetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaUrl,
          mediaType: uploadedMediaType,
          caption: caption.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? t("up_err_story_failed"));
        setUploading(false);
        return;
      }
    } else {
      // Feed post — goes through /api/posts which handles credit deduction + cooldown
      const pricePence = isPremium && unlockPrice
        ? Math.round(parseFloat(unlockPrice) * 100)
        : null;

      if (mediaUrl) {
        const res = await apiFetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            caption: caption.trim() || "",
            mediaUrl,
            mediaType: uploadedMediaType,
            postType: "post",
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? t("up_err_post_failed"));
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
        const res = await apiFetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            caption: caption.trim(),
            mediaUrl: "", // text-only
            mediaType: "text",
            postType: "post",
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? t("up_err_post_failed"));
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

    // Clear draft
    localStorage.removeItem("upload_draft_caption");
    localStorage.removeItem("upload_draft_type");

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
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#fafbfc] px-6 text-center pb-20">
        {/* Close button */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-slate-500 transition hover:bg-gray-200 hover:text-slate-700"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6"
        >
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
            <CheckCircle size={48} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {isStory ? t("up_success_story") : t("up_success_post")}
            </h1>
            <p className="mt-2 text-slate-500">
              {isStory ? t("up_success_story_desc") : t("up_success_post_desc")}
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
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-pink-400 py-4 text-[15px] font-bold text-white transition hover:bg-pink-300"
            >
              <Share2 size={18} /> {t("up_share_update")}
            </button>
            <button
              onClick={() => router.push(myProfile?.username ? `/u/${myProfile.username}` : "/profile")}
              className="w-full rounded-2xl bg-white border border-gray-200 py-4 text-[15px] font-semibold text-slate-600 transition hover:bg-gray-50"
            >
              {t("up_view_on_profile")}
            </button>
            <button
              onClick={() => router.push("/")}
              className="text-[14px] font-medium text-slate-400 hover:text-slate-600 transition"
            >
              {t("up_go_dashboard")}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafbfc] pb-20">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-gray-100 hover:text-slate-700"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-[15px] font-semibold text-slate-800">
          {isStory ? t("up_new_story") : t("up_new_post")}
        </span>
        <button
          onClick={handlePublish}
          disabled={!canPublish || (needsCredits && !hasCredits)}
          className={cn(
            "rounded-full px-4 py-1.5 text-[13px] font-semibold transition",
            canPublish && (!needsCredits || hasCredits)
              ? "bg-pink-400 text-white hover:bg-pink-300"
              : "bg-gray-100 text-slate-400 cursor-not-allowed"
          )}
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : t("up_publish")}
        </button>
      </header>

      <div className="mx-auto max-w-lg space-y-0">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setPostType("post")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 py-3.5 text-[13px] font-semibold uppercase tracking-wider transition",
              postType === "post"
                ? "text-pink-500 border-b-2 border-pink-400"
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            <Camera size={16} />
            {t("up_tab_post")}
          </button>
          <button
            onClick={() => setPostType("story")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 py-3.5 text-[13px] font-semibold uppercase tracking-wider transition",
              postType === "story"
                ? "text-pink-500 border-b-2 border-pink-400"
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            <Film size={16} />
            {t("up_tab_story")}
          </button>
        </div>

        {needsCredits && (
          <div className={cn(
            "flex items-center justify-between px-4 py-3 border-b border-gray-200",
            hasCredits ? "bg-pink-50" : "bg-red-500/5"
          )}>
            <div className="flex items-center gap-2.5">
              <Coins size={16} className={hasCredits ? "text-pink-500" : "text-red-400"} />
              <span className="text-[13px] text-slate-600">
                {loadingCredits
                  ? t("up_credits_loading")
                  : hasCredits
                    ? `${creditBalance} ${creditBalance === 1 ? t("up_credits_remaining") : t("up_credits_remaining_pl")}`
                    : t("up_credits_none")
                }
              </span>
            </div>
            {!hasCredits && !loadingCredits && (
              <button
                onClick={() => router.push("/profile/packages")}
                className="flex items-center gap-1.5 rounded-full bg-pink-400 px-3 py-1 text-[11px] font-semibold text-white hover:bg-pink-300 transition"
              >
                <ShoppingBag size={12} />
                {t("up_buy_credits")}
              </button>
            )}
          </div>
        )}

        {isStory && (
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-200 bg-blue-500/5">
            <Film size={16} className="text-blue-400" />
            <span className="text-[13px] text-slate-500">
              {t("up_story_info")}
            </span>
          </div>
        )}

        <div
          onClick={() => !preview && fileInputRef.current?.click()}
          className={cn(
            "relative w-full bg-white",
            !preview && "flex aspect-square cursor-pointer flex-col items-center justify-center gap-3 border-b border-gray-200 transition hover:bg-gray-50"
          )}
        >
          {preview ? (
            <>
              <div className="relative aspect-square w-full overflow-hidden">
                {file?.type.startsWith("video/") ? (
                  <video
                    src={preview}
                    className="h-full w-full object-cover"
                    controls
                    playsInline
                    preload="metadata"
                    onClick={(e) => {
                      const video = e.currentTarget;
                      if (video.paused) void video.play();
                      else video.pause();
                    }}
                  />
                ) : (
                  <Image src={preview} alt="Preview" fill className="object-cover" />
                )}
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
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
                <ImagePlus size={28} className="text-slate-500" />
              </div>
            <p className="text-[13px] text-slate-500">
                Tap to add a photo or video{isStory ? "" : t("up_optional_suffix")}
              </p>
              <p className="text-[11px] text-slate-300">JPEG, PNG, WebP, MP4, WebM or MOV - max 80 MB</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_MEDIA}
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <div className="border-b border-gray-200 px-4 py-4">
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={isStory ? t("up_caption_optional") : t("up_caption_required")}
            maxLength={500}
            rows={isStory ? 2 : 3}
            className="w-full resize-none bg-transparent text-[15px] text-slate-800 placeholder-slate-300 outline-none"
          />
          <p className="mt-1 text-right text-[11px] text-slate-300">{caption.length}/500</p>
        </div>

        {!isStory && (
          <div className="border-b border-gray-200 px-4 py-4">
            <button
              onClick={() => setIsPremium((p) => !p)}
              className="flex w-full items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl transition",
                  isPremium ? "bg-pink-50 text-pink-500" : "bg-gray-100 text-slate-400"
                )}>
                  {isPremium ? <Lock size={18} /> : <Unlock size={18} />}
                </div>
                <div className="text-left">
                  <p className="text-[14px] font-medium text-slate-800">{t("up_premium_content")}</p>
                  <p className="text-[12px] text-slate-400">{t("up_premium_desc")}</p>
                </div>
              </div>
              <div className={cn(
                "relative h-6 w-11 rounded-full transition-colors",
                isPremium ? "bg-pink-400" : "bg-gray-300"
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
                  <div className="mt-4 flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <span className="text-[14px] font-semibold text-pink-500">CA$</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      placeholder={t("up_pay_per_view_ph")}
                      value={unlockPrice}
                      onChange={(e) => setUnlockPrice(e.target.value)}
                      className="flex-1 bg-transparent text-[14px] text-slate-800 placeholder-slate-300 outline-none"
                    />
                  </div>
                  <p className="mt-2 px-1 text-[11px] text-slate-300">
                    {t("up_pay_per_view_hint")}
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
                ? "bg-pink-400 text-white hover:bg-pink-300 active:scale-[0.98]"
                : "bg-gray-100 text-slate-400 cursor-not-allowed"
            )}
          >
            {uploading && <Loader2 size={18} className="animate-spin" />}
            {uploading
              ? t("up_publishing")
              : isStory
                ? t("up_share_story")
                : needsCredits
                  ? t("up_publish_post_credit")
                  : t("up_publish_post")
            }
          </button>
        </div>
      </div>
    </div>
  );
}
