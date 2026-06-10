import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export type SearchPost = {
  postId: string;
  providerId: string;
  providerUsername: string;
  providerAvatar: string | null;
  providerVerified: string;
  providerCity: string | null;
  caption: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  likesCount: number;
  commentsCount: number;
  viewsCount: number;
  createdAt: string;
  matchRank: number;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 30), 1), 60);
  const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);

  if (!q) {
    return NextResponse.json({ posts: [], hasMore: false });
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const { data, error } = await supabase.rpc("search_posts_by_profile", {
    p_query: q,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    console.error("[search/posts] RPC error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const posts: SearchPost[] = (data ?? []).map((row: Record<string, unknown>) => ({
    postId: row.post_id as string,
    providerId: row.provider_id as string,
    providerUsername: row.provider_username as string,
    providerAvatar: (row.provider_avatar as string | null) ?? null,
    providerVerified: (row.provider_verified as string) ?? "none",
    providerCity: (row.provider_city as string | null) ?? null,
    caption: (row.caption as string | null) ?? null,
    mediaUrl: (row.media_url as string | null) ?? null,
    mediaType: (row.media_type as string | null) ?? null,
    likesCount: (row.likes_count as number) ?? 0,
    commentsCount: (row.comments_count as number) ?? 0,
    viewsCount: (row.views_count as number) ?? 0,
    createdAt: row.created_at as string,
    matchRank: (row.match_rank as number) ?? 0,
  }));

  return NextResponse.json({ posts, hasMore: posts.length === limit });
}
