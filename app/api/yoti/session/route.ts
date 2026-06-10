import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createServerClient } from "@/lib/supabase/server";
import { createYotiSession, getAppUrl } from "@/lib/yoti";

function yotiConfigHint() {
  return [
    `sandbox=${process.env.YOTI_USE_SANDBOX_IDV?.trim() || "unset"}`,
    `hasSandboxSdk=${Boolean(process.env.YOTI_SANDBOX_CLIENT_SDK_ID)}`,
    `hasSandboxPem=${Boolean(process.env.YOTI_SANDBOX_PEM)}`,
    `hasSandboxPemPath=${Boolean(process.env.YOTI_SANDBOX_PEM_PATH)}`,
    `hasAgeSdk=${Boolean(process.env.YOTI_SDK_ID)}`,
    `hasAgeToken=${Boolean(process.env.YOTI_API_TOKEN)}`,
  ].join(", ");
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const appUrl = getAppUrl(req);
  const callbackUrl = `${appUrl}/profile/verify`;
  const cancelUrl = `${appUrl}/profile/verify?yoti_status=cancelled`;

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  try {
    const session = await createYotiSession({
      userId: auth.user.id,
      callbackUrl,
      cancelUrl,
    });

    const { error } = await supabase
      .from("profiles")
      .update({
        yoti_session_id: session.sessionId,
        yoti_status: session.status,
        yoti_age_verified: false,
        yoti_age_threshold: session.threshold,
        yoti_age_estimate: null,
        yoti_last_checked_at: new Date().toISOString(),
        age_verification_status: "pending",
      })
      .eq("id", auth.user.id);

    if (error) {
      console.error("Yoti session profile update error:", error.message);

      if (session.devMode) {
        return NextResponse.json({
          ok: true,
          session_id: session.sessionId,
          launch_url: session.launchUrl,
          dev_mode: true,
          persisted: false,
          warning: "Yoti dev session was created, but the profile could not be updated. Run supabase/migrations/070_yoti_age_verification.sql to persist Yoti status.",
        });
      }

      return NextResponse.json(
        { error: "Failed to store Yoti session. Check that the Yoti age verification migration has been applied." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      session_id: session.sessionId,
      launch_url: session.launchUrl,
      dev_mode: session.devMode,
    });
  } catch (error) {
    console.error("Yoti session create error:", error);
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof Error && error.message.startsWith("Yoti is not configured")) {
      return NextResponse.json(
        { error: `${message} (${yotiConfigHint()})` },
        { status: 500 }
      );
    }

    if (process.env.YOTI_USE_SANDBOX_IDV?.trim().toLowerCase() === "true") {
      return NextResponse.json(
        { error: `${message} (${yotiConfigHint()})` },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: `Failed to create Yoti session (${yotiConfigHint()})` },
      { status: 502 }
    );
  }
}
