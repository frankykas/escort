import { createSign, randomUUID } from "crypto";
import { readFileSync } from "fs";

const YOTI_BASE_URL = "https://age.yoti.com";
const YOTI_IDV_SANDBOX_BASE_URL = "https://api.yoti.com/sandbox/idverify/v1";

function envFlag(name: string) {
  return process.env[name]?.trim().toLowerCase() === "true";
}

export type YotiSessionResult = {
  id?: string;
  status?: string;
  age?: number;
  reference_id?: string;
  expires_at?: string;
  source?: "age" | "dev" | "sandbox-idv";
};

async function formatYotiErrorResponse(res: Response, context: string) {
  const text = await res.text();
  let code = "";
  let message = text;

  try {
    const data = JSON.parse(text) as { code?: unknown; message?: unknown };
    code = typeof data.code === "string" ? data.code : "";
    message = typeof data.message === "string" ? data.message : text;
  } catch {
    // Yoti usually returns JSON, but keep the original body if it does not.
  }

  if (code === "INCOMPLETE_APP_CONFIGURATION") {
    return `${context}: ${res.status} ${code}. Complete the linked organisation in Yoti Hub by adding an organisation name, then regenerate/use sandbox keys for that app. Yoti said: ${message}`;
  }

  return `${context}: ${res.status} ${text}`;
}

export function getYotiConfig() {
  const sdkId = process.env.YOTI_SDK_ID;
  const apiToken = process.env.YOTI_API_TOKEN;
  const devMode = envFlag("YOTI_DEV_MODE");
  const useSandboxIdv = envFlag("YOTI_USE_SANDBOX_IDV");
  const sandboxClientSdkId = process.env.YOTI_SANDBOX_CLIENT_SDK_ID;
  const sandboxPem = process.env.YOTI_SANDBOX_PEM?.replace(/\\n/g, "\n");
  const sandboxPemPath = process.env.YOTI_SANDBOX_PEM_PATH;
  const ageThreshold = Number(process.env.YOTI_AGE_THRESHOLD ?? "18");
  const ageEstimationThreshold = Number(process.env.YOTI_AGE_ESTIMATION_THRESHOLD ?? "25");

  return {
    sdkId,
    apiToken,
    devMode,
    useSandboxIdv,
    sandboxClientSdkId,
    sandboxPem,
    sandboxPemPath,
    ageThreshold,
    ageEstimationThreshold,
  };
}

export function getAppUrl(req: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return configured;

  const origin = req.headers.get("origin");
  if (origin) return origin;

  const host = req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "http://localhost:3001";
}

export function buildYotiLaunchUrl(sessionId: string, sdkId: string) {
  const params = new URLSearchParams({ sessionId, sdkId });
  return `${YOTI_BASE_URL}?${params.toString()}`;
}

function readSandboxPem(config: ReturnType<typeof getYotiConfig>) {
  if (config.sandboxPem) return config.sandboxPem;
  if (config.sandboxPemPath) return readFileSync(config.sandboxPemPath, "utf8");
  throw new Error("Yoti sandbox is not configured. Set YOTI_SANDBOX_PEM_PATH or YOTI_SANDBOX_PEM.");
}

async function yotiSandboxFetch(
  method: "GET" | "POST",
  path: string,
  body: unknown | null,
  config: ReturnType<typeof getYotiConfig>
) {
  if (!config.sandboxClientSdkId) {
    throw new Error("Yoti sandbox is not configured. Set YOTI_SANDBOX_CLIENT_SDK_ID.");
  }

  const bodyText = body ? JSON.stringify(body) : "";
  const query = new URLSearchParams({
    sdkId: config.sandboxClientSdkId,
    nonce: randomUUID(),
    timestamp: String(Math.floor(Date.now() / 1000)),
  }).toString();
  const signedParts = [method, `${path}?${query}`];
  if (bodyText) signedParts.push(Buffer.from(bodyText).toString("base64"));

  const signer = createSign("RSA-SHA256");
  signer.update(signedParts.join("&"));
  signer.end();

  return fetch(`${YOTI_IDV_SANDBOX_BASE_URL}${path}?${query}`, {
    method,
    headers: {
      "X-Yoti-Auth-Digest": signer.sign(readSandboxPem(config), "base64"),
      ...(bodyText ? { "Content-Type": "application/json" } : {}),
    },
    body: bodyText || undefined,
  });
}

function buildYotiSandboxUserViewUrl(sessionId: string, clientSessionToken: string) {
  const params = new URLSearchParams({
    sessionID: sessionId,
    sessionToken: clientSessionToken,
  });
  return `${YOTI_IDV_SANDBOX_BASE_URL}/web/index.html?${params.toString()}`;
}

async function createYotiSandboxIdvSession({
  userId,
  callbackUrl,
  cancelUrl,
}: {
  userId: string;
  callbackUrl: string;
  cancelUrl: string;
}) {
  const config = getYotiConfig();
  const successUrl = `${callbackUrl}?yoti_sandbox=1`;
  const privacyUrl = callbackUrl.replace(/\/profile\/verify$/, "/legal/privacy");

  const res = await yotiSandboxFetch("POST", "/sessions", {
    client_session_token_ttl: 900,
    resources_ttl: 90000,
    user_tracking_id: userId,
    requested_checks: [
      {
        type: "ID_DOCUMENT_AUTHENTICITY",
        config: { manual_check: "NEVER" },
      },
      {
        type: "LIVENESS",
        config: { liveness_type: "STATIC", max_retries: 3 },
      },
      {
        type: "ID_DOCUMENT_FACE_MATCH",
        config: { manual_check: "NEVER" },
      },
    ],
    requested_tasks: [
      {
        type: "ID_DOCUMENT_TEXT_DATA_EXTRACTION",
        config: { manual_check: "NEVER" },
      },
    ],
    sdk_config: {
      allowed_capture_methods: "CAMERA_AND_UPLOAD",
      primary_colour: "#ec4899",
      secondary_colour: "#ffffff",
      font_colour: "#ffffff",
      locale: "en-US",
      success_url: successUrl,
      error_url: cancelUrl,
      privacy_policy_url: privacyUrl,
      allow_handoff: false,
    },
  }, config);

  if (!res.ok) {
    throw new Error(await formatYotiErrorResponse(res, "Yoti sandbox session create failed"));
  }

  const data = await res.json() as {
    sessionId?: string;
    client_session_token?: string;
    client_session_token_ttl?: number;
  };

  if (!data.sessionId || !data.client_session_token) {
    throw new Error("Yoti sandbox session create response did not include a session token");
  }

  return {
    sessionId: data.sessionId,
    status: "PENDING",
    expiresAt: new Date(Date.now() + (data.client_session_token_ttl ?? 900) * 1000).toISOString(),
    launchUrl: buildYotiSandboxUserViewUrl(data.sessionId, data.client_session_token),
    devMode: false,
    mode: "sandbox-idv" as const,
    threshold: config.ageThreshold,
    estimationThreshold: config.ageEstimationThreshold,
  };
}

export async function createYotiSession({
  userId,
  callbackUrl,
  cancelUrl,
}: {
  userId: string;
  callbackUrl: string;
  cancelUrl: string;
}) {
  const config = getYotiConfig();

  if (config.useSandboxIdv) {
    return createYotiSandboxIdvSession({ userId, callbackUrl, cancelUrl });
  }

  if (config.devMode) {
    const sessionId = `dev-${randomUUID()}`;
    return {
      sessionId,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      launchUrl: `${callbackUrl}?sessionId=${encodeURIComponent(sessionId)}&yoti_dev=1`,
      devMode: true,
      mode: "dev" as const,
      threshold: config.ageThreshold,
      estimationThreshold: config.ageEstimationThreshold,
    };
  }

  if (!config.sdkId || !config.apiToken) {
    throw new Error("Yoti is not configured. Set YOTI_SDK_ID and YOTI_API_TOKEN to launch the hosted Yoti verification flow.");
  }

  const res = await fetch(`${YOTI_BASE_URL}/api/v1/sessions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
      "Yoti-Sdk-Id": config.sdkId!,
    },
    body: JSON.stringify({
      type: "OVER",
      age_estimation: {
        allowed: true,
        threshold: config.ageEstimationThreshold,
        level: "PASSIVE",
        retry_limit: 3,
      },
      doc_scan: {
        allowed: true,
        threshold: config.ageThreshold,
        level: "PASSIVE",
        authenticity: "AUTO",
        retry_limit: 3,
      },
      digital_id: {
        allowed: true,
        threshold: config.ageThreshold,
        age_estimation_allowed: true,
        age_estimation_threshold: config.ageEstimationThreshold,
        retry_limit: 3,
      },
      ttl: 900,
      reference_id: userId,
      callback: {
        url: callbackUrl,
        auto: true,
      },
      cancel_url: cancelUrl,
      retry_enabled: true,
      resume_enabled: true,
      synchronous_checks: true,
    }),
  });

  if (!res.ok) {
    throw new Error(await formatYotiErrorResponse(res, "Yoti session create failed"));
  }

  const data = await res.json() as YotiSessionResult;
  if (!data.id) {
    throw new Error("Yoti session create response did not include an id");
  }

  return {
    sessionId: data.id,
    status: data.status ?? "PENDING",
    expiresAt: data.expires_at ?? null,
    launchUrl: buildYotiLaunchUrl(data.id, config.sdkId!),
    devMode: false,
    mode: "age" as const,
    threshold: config.ageThreshold,
    estimationThreshold: config.ageEstimationThreshold,
  };
}

async function fetchYotiSandboxIdvSession(sessionId: string): Promise<YotiSessionResult> {
  const config = getYotiConfig();
  const res = await yotiSandboxFetch("GET", `/sessions/${encodeURIComponent(sessionId)}`, null, config);

  if (!res.ok) {
    throw new Error(await formatYotiErrorResponse(res, "Yoti sandbox result fetch failed"));
  }

  const data = await res.json() as {
    sessionId?: string;
    state?: "ONGOING" | "COMPLETED" | "EXPIRED";
  };

  return {
    id: data.sessionId ?? sessionId,
    status: data.state === "COMPLETED" ? "COMPLETE" : data.state === "EXPIRED" ? "FAIL" : "PENDING",
    reference_id: "sandbox-idv",
    source: "sandbox-idv",
  } satisfies YotiSessionResult;
}

export async function fetchYotiSessionResult(sessionId: string) {
  const config = getYotiConfig();

  if (config.useSandboxIdv) {
    return fetchYotiSandboxIdvSession(sessionId);
  }

  if (config.devMode || sessionId.startsWith("dev-")) {
    return {
      id: sessionId,
      status: "COMPLETE",
      age: config.ageThreshold,
      reference_id: "dev",
      source: "dev",
    } satisfies YotiSessionResult;
  }

  const res = await fetch(`${YOTI_BASE_URL}/api/v1/sessions/${encodeURIComponent(sessionId)}/result`, {
    headers: {
      "Authorization": `Bearer ${config.apiToken}`,
      "Yoti-Sdk-Id": config.sdkId!,
    },
  });

  if (!res.ok) {
    throw new Error(await formatYotiErrorResponse(res, "Yoti result fetch failed"));
  }

  return await res.json() as YotiSessionResult;
}
