"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

type UseUploadStatusReturn = {
  publish: (file: File, caption: string, userId: string) => Promise<boolean>;
  isUploading: boolean;
  error: string | null;
};

export function useUploadStatus(): UseUploadStatusReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function publish(
    file: File,
    caption: string,
    userId: string
  ): Promise<boolean> {
    setIsUploading(true);
    setError(null);

    try {
      // 1. Sanitise filename and build storage path
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${userId}/${Date.now()}-${safeName}`;

      // 2. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("status-updates")
        .upload(path, file, { upsert: false });

      if (uploadError) {
        setError(uploadError.message);
        return false;
      }

      // 3. Get the public URL
      const { data: urlData } = supabase.storage
        .from("status-updates")
        .getPublicUrl(path);

      const mediaUrl = urlData.publicUrl;

      // 4. Insert the status_update record
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const { error: insertError } = await supabase
        .from("status_updates")
        .insert({
          provider_id: userId,
          media_url: mediaUrl,
          caption: caption.trim() || null,
          expires_at: expiresAt,
        });

      if (insertError) {
        setError(insertError.message);
        return false;
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
