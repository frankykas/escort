import { createServerClient } from "@/lib/supabase/server";

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
