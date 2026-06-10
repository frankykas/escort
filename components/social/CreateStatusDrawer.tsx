"use client";

import { useRef, useState, useEffect, useCallback, type DragEvent, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CloudUpload, X, Loader2, CheckCircle, Share2, Video, Globe, Crown, Lock, ShieldAlert } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useUploadStatus, type PostVisibility, type ContentRating } from "@/hooks/useUploadStatus";
import { USE_CREATOR_CONTENT } from "@/lib/features";
import { supabase } from "@/lib/supabase/client";

const MAX_CHARS = 280;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "video/quicktime"];
const MAX_BYTES = 80 * 1024 * 1024; // 80 MB

type Props = {
  userId: string;
  onClose: () => void;
  onPublished: () => void;
};

type Step = "form" | "success";

export function CreateStatusDrawer({ userId, onClose, onPublished }: Props) {
  const [step, setStep] = useState<Step>("form");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<PostVisibility>("public");
  const [priceDollars, setPriceDollars] = useState("");
  const [rating, setRating] = useState<ContentRating>("sfw");
  const [consentAttested, setConsentAttested] = useState(false);
  const [ageVerified, setAgeVerified] = useState(false);
  const [performers, setPerformers] = useState("");
  const [consentDoc, setConsentDoc] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const consentDocRef = useRef<HTMLInputElement>(null);
  const { publish, isUploading, error: uploadError } = useUploadStatus();

  // The creator must be age-verified to post explicit content.
  useEffect(() => {
    if (!USE_CREATOR_CONTENT) return;
    supabase
      .from("profiles")
      .select("yoti_age_verified")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => setAgeVerified(!!data?.yoti_age_verified));
  }, [userId]);

  function acceptFile(f: File) {
    setFileError(null);
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setFileError("Only JPEG, PNG, WebP, MP4, WebM, or MOV files are accepted.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setFileError("Media must be under 80 MB.");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) acceptFile(dropped);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (picked) acceptFile(picked);
  }

  async function handleSubmit() {
    if (!file) return;
    const priceCents = visibility === "ppv" ? Math.round(parseFloat(priceDollars || "0") * 100) : undefined;
    const success = await publish(file, caption, userId, {
      visibility,
      priceCents,
      rating,
      consentAttested,
      performerUsernames: performers ? performers.split(",") : [],
      consentDocFile: consentDoc,
    });
    if (success) setStep("success");
  }

  const ppvPriceInvalid =
    visibility === "ppv" && (!priceDollars || parseFloat(priceDollars) <= 0);
  const isExplicit = rating === "explicit";
  // Explicit posts require an age-verified creator and a consent attestation.
  const explicitBlocked = isExplicit && (!ageVerified || !consentAttested);

  function handleFinalClose() {
    onPublished();
    onClose();
  }

  const canPost = !!file && !isUploading && !ppvPriceInvalid && !explicitBlocked;
  const charsLeft = MAX_CHARS - caption.length;

  const VISIBILITY_OPTS: { key: PostVisibility; label: string; icon: typeof Globe }[] = [
    { key: "public", label: "Public", icon: Globe },
    { key: "subscribers", label: "Subscribers", icon: Crown },
    { key: "ppv", label: "Pay-per-view", icon: Lock },
  ];
  const RATING_OPTS: { key: ContentRating; label: string }[] = [
    { key: "sfw", label: "SFW" },
    { key: "suggestive", label: "Suggestive" },
    { key: "explicit", label: "Explicit" },
  ];

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={step === "success" ? handleFinalClose : onClose}
      />

      {/* Drawer panel */}
      <motion.div
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col overflow-y-auto rounded-t-3xl border-t border-gray-200 bg-white/80 backdrop-blur-xl"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
      >
        {/* Handle + header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white/80 px-5 py-4 backdrop-blur-xl">
          <div className="mx-auto h-1 w-10 rounded-full bg-gray-300 absolute left-1/2 top-2 -translate-x-1/2" />
          <span className="text-sm font-semibold text-slate-700">
            {step === "success" ? "Published!" : "New Status"}
          </span>
          <button
            onClick={step === "success" ? handleFinalClose : onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-slate-500 transition-colors hover:bg-gray-200 hover:text-slate-700"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-5">
          <AnimatePresence mode="wait">
            {step === "form" ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex flex-col gap-5"
              >
                {/* Media drop zone */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  className={cn(
                    "relative flex min-h-[220px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-colors",
                    isDragging
                      ? "border-pink-400/60 bg-pink-400/5"
                      : "border-gray-200 bg-gray-50 hover:border-gray-300"
                  )}
                >
                  {preview ? (
                    <>
                      <div className="relative aspect-[4/5] w-full">
                        {file?.type.startsWith("video/") ? (
                          <video src={preview} className="h-full w-full object-cover" controls playsInline />
                        ) : (
                          <Image
                            src={preview}
                            alt="Preview"
                            fill
                            className="object-cover"
                            sizes="100vw"
                          />
                        )}
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                        <span className="text-xs font-medium text-white">Tap to replace</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200">
                        <CloudUpload size={22} className="text-slate-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-600">
                          Drop photo or video, or <span className="text-pink-500">browse</span>
                        </p>
                        <p className="mt-1 text-xs text-slate-300">JPEG, PNG, WebP, MP4, WebM or MOV - max 80 MB</p>
                      </div>
                    </div>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES.join(",")}
                  className="sr-only"
                  onChange={onFileChange}
                />

                {fileError && <p className="text-xs text-red-400">{fileError}</p>}

                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value.slice(0, MAX_CHARS))}
                    placeholder="What's happening right now..."
                    rows={3}
                    className="w-full resize-none bg-transparent text-sm leading-relaxed text-slate-700 outline-none placeholder:text-slate-300"
                  />
                  <div className="mt-1 flex justify-end">
                    <span className={cn("text-xs tabular-nums text-slate-300", charsLeft <= 30 && "text-pink-500")}>
                      {caption.length}/{MAX_CHARS}
                    </span>
                  </div>
                </div>

                {/* Premium options — creator layer only */}
                {USE_CREATOR_CONTENT && (
                  <div className="flex flex-col gap-3 rounded-2xl border border-pink-100 bg-pink-50/40 p-3">
                    <div>
                      <p className="mb-1.5 px-0.5 text-[11px] font-medium uppercase tracking-widest text-slate-400">
                        Visibility
                      </p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {VISIBILITY_OPTS.map(({ key, label, icon: Icon }) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setVisibility(key)}
                            className={cn(
                              "flex flex-col items-center gap-1 rounded-xl border py-2 text-[11px] font-semibold transition",
                              visibility === key
                                ? "border-pink-300 bg-white text-pink-600"
                                : "border-gray-200 bg-white text-slate-500 hover:border-gray-300"
                            )}
                          >
                            <Icon size={15} />
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {visibility === "ppv" && (
                      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5">
                        <span className="text-[13px] font-semibold text-pink-500">CA$</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={priceDollars}
                          onChange={(e) => setPriceDollars(e.target.value)}
                          placeholder="Unlock price"
                          className="flex-1 bg-transparent text-[14px] font-semibold text-slate-800 placeholder-slate-400 outline-none"
                        />
                      </div>
                    )}

                    <div>
                      <p className="mb-1.5 px-0.5 text-[11px] font-medium uppercase tracking-widest text-slate-400">
                        Content rating
                      </p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {RATING_OPTS.map(({ key, label }) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setRating(key)}
                            className={cn(
                              "rounded-xl border py-2 text-[11px] font-semibold transition",
                              rating === key
                                ? "border-pink-300 bg-white text-pink-600"
                                : "border-gray-200 bg-white text-slate-500 hover:border-gray-300"
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Explicit content: age-verification gate + consent attestation */}
                    {isExplicit && !ageVerified && (
                      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                        <ShieldAlert size={15} className="mt-0.5 flex-shrink-0 text-amber-500" />
                        <p className="text-[12px] leading-snug text-amber-700">
                          You must verify your age before posting explicit content.{" "}
                          <Link href="/profile/verify" className="font-semibold underline">
                            Verify now
                          </Link>
                        </p>
                      </div>
                    )}
                    {isExplicit && ageVerified && (
                      <div className="space-y-2.5">
                        <input
                          value={performers}
                          onChange={(e) => setPerformers(e.target.value)}
                          placeholder="Everyone appearing — @usernames, comma-separated"
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[13px] text-slate-800 placeholder-slate-400 outline-none focus:border-pink-300"
                        />
                        <input
                          ref={consentDocRef}
                          type="file"
                          accept="image/*,application/pdf"
                          className="sr-only"
                          onChange={(e) => setConsentDoc(e.target.files?.[0] ?? null)}
                        />
                        <button
                          type="button"
                          onClick={() => consentDocRef.current?.click()}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-3 py-2.5 text-[12px] font-medium text-slate-500 hover:border-gray-400"
                        >
                          {consentDoc ? `Consent doc: ${consentDoc.name}` : "Attach consent / release document (optional)"}
                        </button>
                        <label className="flex items-start gap-2.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={consentAttested}
                            onChange={(e) => setConsentAttested(e.target.checked)}
                            className="mt-0.5 h-4 w-4 accent-pink-500"
                          />
                          <span className="text-[12px] leading-snug text-slate-600">
                            I confirm everyone appearing is 18+ and has consented to this content being published. It will be reviewed before going live.
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                )}

                {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}

                <div className="flex gap-3 pb-2">
                  <button
                    onClick={onClose}
                    disabled={isUploading}
                    className="flex-1 rounded-xl bg-gray-100 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-gray-200 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!canPost}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-pink-400 py-3 text-sm font-semibold text-white transition-colors hover:bg-pink-500 disabled:opacity-40"
                  >
                    {isUploading ? (
                      <><Loader2 size={15} className="animate-spin" /> Posting…</>
                    ) : <><Video size={15} /> Post</>}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-4 py-8 text-center"
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                  <CheckCircle size={40} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Status Published!</h2>
                  <p className="mt-1 text-sm text-slate-500">Your update is now live on your profile.</p>
                </div>
                <div className="mt-4 flex w-full flex-col gap-3">
                  <button
                    onClick={async () => {
                      if (navigator.share) {
                        await navigator.share({
                          title: "Check out my new post!",
                          url: `${window.location.origin}/profile`
                        }).catch(() => {});
                      }
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-pink-400 py-3 text-sm font-bold text-white transition hover:bg-pink-500"
                  >
                    <Share2 size={16} /> Share Post
                  </button>
                  <button
                    onClick={handleFinalClose}
                    className="w-full rounded-xl bg-gray-100 py-3 text-sm font-medium text-slate-600 transition hover:bg-gray-200"
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
}
