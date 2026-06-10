import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { requireUser } from "@/lib/api-auth";

// GET /api/admin/payram-health
// Admin-only diagnostic: reports whether Payram env is configured and whether
// the configured server is reachable. Use after deploying your Payram instance
// to confirm the integration before going live.

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  if (!isAdmin(auth.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const base = process.env.PAYRAM_API_URL;
  const hasApiKey = !!process.env.PAYRAM_API_KEY;
  const hasWebhookKey = !!(process.env.PAYRAM_WEBHOOK_KEY || process.env.PAYRAM_API_KEY);

  const config = {
    apiUrlSet: !!base,
    apiKeySet: hasApiKey,
    webhookKeySet: hasWebhookKey,
  };

  if (!base) {
    return NextResponse.json({
      configured: false,
      reachable: false,
      config,
      hint: "Set PAYRAM_API_URL, PAYRAM_API_KEY (and optionally PAYRAM_WEBHOOK_KEY) in the environment.",
    });
  }

  // Best-effort reachability probe (short timeout). Payram has no documented
  // public health endpoint, so any HTTP response counts as "reachable".
  let reachable = false;
  let detail: string | null = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(base.replace(/\/$/, ""), { signal: controller.signal });
    clearTimeout(timer);
    reachable = true;
    detail = `HTTP ${res.status}`;
  } catch (err) {
    detail = err instanceof Error ? err.message : "unreachable";
  }

  return NextResponse.json({
    configured: hasApiKey && config.apiUrlSet,
    reachable,
    detail,
    config,
  });
}
