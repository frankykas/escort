import { createServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Admin auth
// ---------------------------------------------------------------------------

const ADMIN_IDS = (process.env.ADMIN_USER_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

export function isAdmin(userId: string | null): boolean {
  if (!userId) return false;
  return ADMIN_IDS.includes(userId);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdminActionResult {
  success: boolean;
  error?: string;
}

interface AdminAction {
  id: string;
  admin_id: string;
  action_type: string;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Suspend a provider's posting ability
// ---------------------------------------------------------------------------

export async function suspendPosting(
  adminId: string,
  providerId: string,
  reason: string
): Promise<AdminActionResult> {
  const supabase = createServerClient();
  if (!supabase) return { success: false, error: "Database unavailable" };

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      is_posting_suspended: true,
      posting_suspended_reason: reason,
      posting_suspended_at: new Date().toISOString(),
    })
    .eq("id", providerId);

  if (profileError) {
    return { success: false, error: profileError.message };
  }

  // Log admin action
  await supabase.from("admin_actions").insert({
    admin_id: adminId,
    action_type: "suspend_posting",
    target_id: providerId,
    details: { reason },
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// Unsuspend a provider's posting ability
// ---------------------------------------------------------------------------

export async function unsuspendPosting(
  adminId: string,
  providerId: string
): Promise<AdminActionResult> {
  const supabase = createServerClient();
  if (!supabase) return { success: false, error: "Database unavailable" };

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      is_posting_suspended: false,
      posting_suspended_reason: null,
      posting_suspended_at: null,
    })
    .eq("id", providerId);

  if (profileError) {
    return { success: false, error: profileError.message };
  }

  await supabase.from("admin_actions").insert({
    admin_id: adminId,
    action_type: "unsuspend_posting",
    target_id: providerId,
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// Grant free credits to a provider
// ---------------------------------------------------------------------------

export async function grantCredits(
  adminId: string,
  providerId: string,
  credits: number,
  reason: string
): Promise<AdminActionResult> {
  const supabase = createServerClient();
  if (!supabase) return { success: false, error: "Database unavailable" };

  // Create a "virtual" purchase with no package or payment
  const { error } = await supabase
    .from("posting_package_purchases")
    .insert({
      provider_id: providerId,
      package_id: null,
      credits_purchased: credits,
      credits_remaining: credits,
      stripe_payment_intent_id: null,
      expires_at: null, // Granted credits don't expire
    });

  if (error) {
    return { success: false, error: error.message };
  }

  await supabase.from("admin_actions").insert({
    admin_id: adminId,
    action_type: "grant_credits",
    target_id: providerId,
    details: { credits, reason },
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// Delete / hide a post
// ---------------------------------------------------------------------------

export async function hidePost(
  adminId: string,
  postId: string,
  reason: string
): Promise<AdminActionResult> {
  const supabase = createServerClient();
  if (!supabase) return { success: false, error: "Database unavailable" };

  const { error } = await supabase
    .from("status_updates")
    .delete()
    .eq("id", postId);

  if (error) {
    return { success: false, error: error.message };
  }

  await supabase.from("admin_actions").insert({
    admin_id: adminId,
    action_type: "delete_post",
    target_id: postId,
    details: { reason },
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// Create / update a posting package
// ---------------------------------------------------------------------------

export async function createPackage(
  adminId: string,
  params: {
    name: string;
    description?: string;
    postCredits: number;
    price: number;
    validityDays?: number;
    sortOrder?: number;
  }
): Promise<AdminActionResult> {
  const supabase = createServerClient();
  if (!supabase) return { success: false, error: "Database unavailable" };

  const { data, error } = await supabase
    .from("posting_packages")
    .insert({
      name: params.name,
      description: params.description,
      post_credits: params.postCredits,
      price: params.price,
      validity_days: params.validityDays,
      sort_order: params.sortOrder ?? 0,
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  await supabase.from("admin_actions").insert({
    admin_id: adminId,
    action_type: "create_package",
    target_id: data.id,
    details: params,
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// Deactivate a posting package
// ---------------------------------------------------------------------------

export async function deactivatePackage(
  adminId: string,
  packageId: string
): Promise<AdminActionResult> {
  const supabase = createServerClient();
  if (!supabase) return { success: false, error: "Database unavailable" };

  const { error } = await supabase
    .from("posting_packages")
    .update({ is_active: false })
    .eq("id", packageId);

  if (error) {
    return { success: false, error: error.message };
  }

  await supabase.from("admin_actions").insert({
    admin_id: adminId,
    action_type: "deactivate_package",
    target_id: packageId,
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// Update a platform setting
// ---------------------------------------------------------------------------

export async function updatePlatformSetting(
  adminId: string,
  key: string,
  value: unknown
): Promise<AdminActionResult> {
  const supabase = createServerClient();
  if (!supabase) return { success: false, error: "Database unavailable" };

  const { error } = await supabase
    .from("platform_settings")
    .upsert({
      key,
      value: JSON.stringify(value),
      updated_at: new Date().toISOString(),
    });

  if (error) {
    return { success: false, error: error.message };
  }

  await supabase.from("admin_actions").insert({
    admin_id: adminId,
    action_type: "update_setting",
    details: { key, value },
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// Get admin audit log
// ---------------------------------------------------------------------------

export async function getAdminAuditLog(
  limit: number = 50,
  offset: number = 0
): Promise<AdminAction[]> {
  const supabase = createServerClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("admin_actions")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  return (data ?? []) as AdminAction[];
}

// ---------------------------------------------------------------------------
// Approve a pending verification
// ---------------------------------------------------------------------------

export async function approveVerification(
  adminId: string,
  userId: string
): Promise<AdminActionResult> {
  const supabase = createServerClient();
  if (!supabase) return { success: false, error: "Database unavailable" };

  const { error } = await supabase
    .from("profiles")
    .update({
      verification_status: "verified",
      verified_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .eq("verification_status", "pending");

  if (error) return { success: false, error: error.message };

  await supabase.from("admin_actions").insert({
    admin_id: adminId,
    action_type: "approve_verification",
    target_id: userId,
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// Reject a pending verification
// ---------------------------------------------------------------------------

export async function rejectVerification(
  adminId: string,
  userId: string,
  reason?: string
): Promise<AdminActionResult> {
  const supabase = createServerClient();
  if (!supabase) return { success: false, error: "Database unavailable" };

  const { error } = await supabase
    .from("profiles")
    .update({
      verification_status: "none",
      persona_status: "rejected",
    })
    .eq("id", userId)
    .eq("verification_status", "pending");

  if (error) return { success: false, error: error.message };

  await supabase.from("admin_actions").insert({
    admin_id: adminId,
    action_type: "reject_verification",
    target_id: userId,
    details: reason ? { reason } : null,
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// Get pending verifications
// ---------------------------------------------------------------------------

export type PendingVerification = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  persona_inquiry_id: string | null;
  persona_status: string | null;
  created_at: string;
};

export async function getPendingVerifications(limit = 20): Promise<PendingVerification[]> {
  const supabase = createServerClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, persona_inquiry_id, persona_status, created_at")
    .eq("verification_status", "pending")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as PendingVerification[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Dashboard data fetchers
// ═══════════════════════════════════════════════════════════════════════════

export type DashboardStats = {
  totalUsers: number;
  totalProviders: number;
  totalClients: number;
  verifiedProviders: number;
  totalPosts: number;
  totalStories: number;
  totalListings: number;
  activeChats: number;
  pendingRequests: number;
  pendingReports: number;
  totalLikes: number;
  totalComments: number;
  totalFollows: number;
  pendingVerifications: number;
  signupsToday: number;
  signupsThisWeek: number;
};

export async function getDashboardStats(): Promise<DashboardStats | null> {
  const supabase = createServerClient();
  if (!supabase) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoISO = weekAgo.toISOString();

  const [
    usersRes, providersRes, verifiedRes,
    postsRes, storiesRes, listingsRes,
    chatsRes, requestsRes, reportsRes,
    likesRes, commentsRes, followsRes,
    pendingVerificationsRes,
    signupsTodayRes, signupsWeekRes,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_provider", true),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("verification_status", "verified"),
    supabase.from("status_updates").select("id", { count: "exact", head: true }).eq("post_type", "post"),
    supabase.from("status_updates").select("id", { count: "exact", head: true }).eq("post_type", "story"),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("chat_channels").select("id", { count: "exact", head: true }),
    supabase.from("message_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("likes").select("user_id", { count: "exact", head: true }),
    supabase.from("comments").select("id", { count: "exact", head: true }),
    supabase.from("follows").select("follower_id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("verification_status", "pending"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", todayISO),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", weekAgoISO),
  ]);

  return {
    totalUsers: usersRes.count ?? 0,
    totalProviders: providersRes.count ?? 0,
    totalClients: (usersRes.count ?? 0) - (providersRes.count ?? 0),
    verifiedProviders: verifiedRes.count ?? 0,
    totalPosts: postsRes.count ?? 0,
    totalStories: storiesRes.count ?? 0,
    totalListings: listingsRes.count ?? 0,
    activeChats: chatsRes.count ?? 0,
    pendingRequests: requestsRes.count ?? 0,
    pendingReports: reportsRes.count ?? 0,
    totalLikes: likesRes.count ?? 0,
    totalComments: commentsRes.count ?? 0,
    totalFollows: followsRes.count ?? 0,
    pendingVerifications: pendingVerificationsRes.count ?? 0,
    signupsToday: signupsTodayRes.count ?? 0,
    signupsThisWeek: signupsWeekRes.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Recent signups
// ---------------------------------------------------------------------------

export type RecentUser = {
  id: string;
  username: string;
  avatar_url: string | null;
  is_provider: boolean;
  verification_status: string;
  created_at: string;
};

export async function getRecentSignups(limit = 15): Promise<RecentUser[]> {
  const supabase = createServerClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, is_provider, verification_status, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as RecentUser[];
}

// ---------------------------------------------------------------------------
// Pending reports
// ---------------------------------------------------------------------------

export type ReportRow = {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  reporter: { username: string } | null;
};

export async function getPendingReports(limit = 20): Promise<ReportRow[]> {
  const supabase = createServerClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("reports")
    .select(`
      id, target_type, target_id, reason, details, status, created_at,
      reporter:reporter_id (username)
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => ({
    ...r,
    reporter: r.reporter as unknown as { username: string } | null,
  })) as ReportRow[];
}

// ---------------------------------------------------------------------------
// Resolve a report
// ---------------------------------------------------------------------------

export async function resolveReport(
  adminId: string,
  reportId: string,
  resolution: "actioned" | "dismissed"
): Promise<AdminActionResult> {
  const supabase = createServerClient();
  if (!supabase) return { success: false, error: "Database unavailable" };

  const { error } = await supabase
    .from("reports")
    .update({
      status: resolution,
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", reportId);

  if (error) return { success: false, error: error.message };

  await supabase.from("admin_actions").insert({
    admin_id: adminId,
    action_type: `report_${resolution}`,
    target_id: reportId,
  });

  return { success: true };
}
