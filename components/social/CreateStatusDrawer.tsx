"use client";

import { useRef, useState, useCallback, type DragEvent, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CloudUpload, X, Loader2, CheckCircle, Share2 } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useUploadStatus } from "@/hooks/useUploadStatus";

const MAX_CHARS = 280;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { publish, isUploading, error: uploadError } = useUploadStatus();

  function acceptFile(f: File) {
    setFileError(null);
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setFileError("Only JPEG, PNG, or WebP images are accepted.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setFileError("Image must be under 10 MB.");
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
    const success = await publish(file, caption, userId);
    if (success) setStep("success");
  }

  function handleFinalClose() {
    onPublished();
    onClose();
  }

  const canPost = !!file && !isUploading;
  const charsLeft = MAX_CHARS - caption.length;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={step === "success" ? handleFinalClose : onClose}
      />

      {/* Drawer panel */}
      <motion.div
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col overflow-y-auto rounded-t-3xl border-t border-white/10 bg-zinc-900/80 backdrop-blur-xl"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
      >
        {/* Handle + header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-zinc-900/80 px-5 py-4 backdrop-blur-xl">
          <div className="mx-auto h-1 w-10 rounded-full bg-zinc-700 absolute left-1/2 top-2 -translate-x-1/2" />
          <span className="text-sm font-semibold text-zinc-100">
            {step === "success" ? "Published!" : "New Status"}
          </span>
          <button
            onClick={step === "success" ? handleFinalClose : onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
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
                {/* Image drop zone */}
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
                      ? "border-amber-400/60 bg-amber-400/5"
                      : "border-white/10 bg-zinc-800/50 hover:border-white/20"
                  )}
                >
                  {preview ? (
                    <>
                      <div className="relative aspect-[4/5] w-full">
                        <Image
                          src={preview}
                          alt="Preview"
                          fill
                          className="object-cover"
                          sizes="100vw"
                        />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                        <span className="text-xs font-medium text-white">Tap to replace</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-700">
                        <CloudUpload size={22} className="text-zinc-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-300">
                          Drop image or <span className="text-amber-400">browse</span>
                        </p>
                        <p className="mt-1 text-xs text-zinc-600">JPEG, PNG, WebP · max 10 MB</p>
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

                <div className="rounded-2xl border border-white/10 bg-zinc-800/50 px-4 py-3">
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value.slice(0, MAX_CHARS))}
                    placeholder="What's happening right now..."
                    rows={3}
                    className="w-full resize-none bg-transparent text-sm leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-600"
                  />
                  <div className="mt-1 flex justify-end">
                    <span className={cn("text-xs tabular-nums text-zinc-600", charsLeft <= 30 && "text-amber-400")}>
                      {caption.length}/{MAX_CHARS}
                    </span>
                  </div>
                </div>

                {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}

                <div className="flex gap-3 pb-2">
                  <button
                    onClick={onClose}
                    disabled={isUploading}
                    className="flex-1 rounded-xl bg-zinc-800 py-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!canPost}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200 disabled:opacity-40"
                  >
                    {isUploading ? (
                      <><Loader2 size={15} className="animate-spin" /> Posting…</>
                    ) : "Post"}
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
                  <h2 className="text-xl font-bold text-white">Status Published!</h2>
                  <p className="mt-1 text-sm text-zinc-400">Your update is now live on your profile.</p>
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
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-3 text-sm font-bold text-zinc-950 transition hover:bg-amber-300"
                  >
                    <Share2 size={16} /> Share Post
                  </button>
                  <button
                    onClick={handleFinalClose}
                    className="w-full rounded-xl bg-zinc-800 py-3 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700"
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
