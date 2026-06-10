import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createServerClient } from "@/lib/supabase/server";
import { fetchYotiSessionResult, getYotiConfig } from "@/lib/yoti";

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  let sessionId = typeof body.sessionId === "string" ? body.sessionId : "";

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const config = getYotiConfig();
  const isDevSession = config.devMode || sessionId.startsWith("dev-");

  if (!isDevSession) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, yoti_session_id")
      .eq("id", auth.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    if (!sessionId) sessionId = profile.yoti_session_id ?? "";

    if (!sessionId) {
      return NextResponse.json(
        { error: "No Yoti session found for this account" },
        { status: 400 }
      );
    }

    if (profile.yoti_session_id !== sessionId) {
      return NextResponse.json(
        { error: "Yoti session does not belong to this account" },
        { status: 403 }
      );
    }
  }

  try {
    const result = await fetchYotiSessionResult(sessionId);
    const status = result.status ?? "PENDING";
    const complete = status === "COMPLETE";
    const age = typeof result.age === "number" ? result.age : null;
    const passedAge = complete && (age === null || age >= config.ageThreshold);
    const failed = ["FAIL", "ERROR", "CANCELLED"].includes(status);
    const isSandboxIdv = result.source === "sandbox-idv" || config.useSandboxIdv;

    const nextStatus = passedAge ? "verified" : failed ? "failed" : "pending";
    const updatePayload: Record<string, unknown> = {
      yoti_status: status,
      yoti_age_verified: passedAge,
      yoti_age_threshold: config.ageThreshold,
      yoti_age_estimate: age,
      yoti_last_checked_at: new Date().toISOString(),
      age_verification_status: nextStatus,
    };

    if (isSandboxIdv && passedAge) {
      updatePayload.verification_status = "verified";
      updatePayload.verified_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", auth.user.id);

    if (error) {
      console.error("Yoti complete profile update error:", error.message);

      if (isDevSession) {
        return NextResponse.json({
          ok: true,
          persisted: false,
          age_verification_status: nextStatus,
          yoti_status: status,
          yoti_age_verified: passedAge,
          warning: "Yoti dev result was completed, but the profile could not be updated. Run supabase/migrations/070_yoti_age_verification.sql to persist Yoti status.",
        });
      }

      return NextResponse.json(
        { error: "Failed to update Yoti status. Check that the Yoti age verification migration has been applied." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      age_verification_status: nextStatus,
      verification_status: isSandboxIdv && passedAge ? "verified" : undefined,
      yoti_status: status,
      yoti_age_verified: passedAge,
    });
  } catch (error) {
    console.error("Yoti complete error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve Yoti result" },
      { status: 502 }
    );
  }
}
