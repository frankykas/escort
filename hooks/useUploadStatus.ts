"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export type PostVisibility = "public" | "subscribers" | "ppv";
export type ContentRating = "sfw" | "suggestive" | "explicit";

export type PublishOptions = {
  visibility?: PostVisibility;
  /** Unlock price in cents — required when visibility is "ppv". */
  priceCents?: number;
  rating?: ContentRating;
  /** Required for explicit posts: uploader attests consent + 18+ of all appearing. */
  consentAttested?: boolean;
  /** Explicit only: usernames of everyone appearing (2257 records). */
  performerUsernames?: string[];
  /** Explicit only: a consent/release document (stored privately). */
  consentDocFile?: File | null;
};

type UseUploadStatusReturn = {
  publish: (file: File, caption: string, userId: string, options?: PublishOptions) => Promise<boolean>;
  isUploading: boolean;
  error: string | null;
};

export function useUploadStatus(): UseUploadStatusReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function publish(
    file: File,
    caption: string,
    userId: string,
    options: PublishOptions = {}
  ): Promise<boolean> {
    setIsUploading(true);
    setError(null);

    const visibility = options.visibility ?? "public";
    const rating = options.rating ?? "sfw";
    const isPremium = visibility !== "public";
    // Premium media goes in the private bucket and is served via signed URLs;
    // public posts keep the public bucket + URL.
    const bucket = isPremium ? "premium-content" : "status-updates";

    try {
      // 1. Sanitise filename and build storage path (owner folder for RLS)
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${userId}/${Date.now()}-${safeName}`;

      // 2. Upload to Supabase Storage
      const mediaType = file.type.startsWith("video/") ? "video" : "image";
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: false, contentType: file.type });

      if (uploadError) {
        setError(uploadError.message);
        return false;
      }

      // 3. Public posts get a public URL; premium posts store the private path.
      const mediaUrl = isPremium
        ? null
        : supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;

      // 4. Insert the status_update record. Explicit posts start in moderation
      //    and stay hidden from the feed until an admin approves them.
      const expiresAt = new Date("2099-01-01T00:00:00Z").toISOString();
      const isExplicit = rating === "explicit";

      const { data: inserted, error: insertError } = await supabase
        .from("status_updates")
        .insert({
          provider_id: userId,
          media_url: mediaUrl,
          media_path: isPremium ? path : null,
          media_type: mediaType,
          post_type: "post",
          caption: caption.trim() || null,
          expires_at: expiresAt,
          is_premium: isPremium,
          unlock_price: visibility === "ppv" ? options.priceCents ?? null : null,
          content_rating: rating,
          moderation_status: isExplicit ? "pending" : "approved",
        })
        .select("id")
        .single();

      if (insertError || !inserted) {
        setError(insertError?.message ?? "Failed to create post");
        return false;
      }

      // 5. Explicit posts get a 2257-style compliance record: consent
      //    attestation, the ids of everyone appearing, and an optional release doc.
      if (isExplicit) {
        // Resolve performer usernames → profile ids.
        let performerIds: string[] = [];
        const usernames = (options.performerUsernames ?? [])
          .map((u) => u.trim().replace(/^@/, ""))
          .filter(Boolean);
        if (usernames.length) {
          const { data: people } = await supabase
            .from("profiles")
            .select("id")
            .in("username", usernames);
          performerIds = (people ?? []).map((p) => p.id as string);
        }

        // Upload the consent/release document to the private bucket.
        let consentDocPath: string | null = null;
        if (options.consentDocFile) {
          const docName = options.consentDocFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const docPath = `${userId}/consent/${Date.now()}-${docName}`;
          const { error: docError } = await supabase.storage
            .from("premium-content")
            .upload(docPath, options.consentDocFile, { upsert: false, contentType: options.consentDocFile.type });
          if (!docError) consentDocPath = docPath;
        }

        const { error: complianceError } = await supabase
          .from("content_compliance")
          .insert({
            post_id: inserted.id,
            creator_id: userId,
            consent_attested: options.consentAttested ?? false,
            performer_ids: performerIds,
            consent_doc_path: consentDocPath,
            review_status: "pending",
          });
        if (complianceError) {
          setError(complianceError.message);
          return false;
        }
      }

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      return false;
    } finally {
      setIsUploading(false);
    }
  }

  return { publish, isUploading, error };
}
