import { NextRequest, NextResponse } from "next/server";
import { findProvidersNearby, findProvidersByCity, updateProviderLocation, setLocationSharing } from "@/lib/geo";

// Search providers by location
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode"); // "nearby" or "city"
  const limit = Number(searchParams.get("limit") ?? 50);
  const offset = Number(searchParams.get("offset") ?? 0);

  if (mode === "nearby") {
    const lat = Number(searchParams.get("lat"));
    const lng = Number(searchParams.get("lng"));
    const radiusKm = Number(searchParams.get("radiusKm") ?? 50);

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
    }

    const providers = await findProvidersNearby(lat, lng, radiusKm, limit, offset);
    return NextResponse.json(providers);
  }

  if (mode === "city") {
    const city = searchParams.get("city");
    if (!city) {
      return NextResponse.json({ error: "city is required" }, { status: 400 });
    }

    const providers = await findProvidersByCity(city, limit, offset);
    return NextResponse.json(providers);
  }

  return NextResponse.json({ error: "mode must be 'nearby' or 'city'" }, { status: 400 });
}

// Update provider location or toggle sharing
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  if (action === "update_location") {
    const { profileId, lat, lng } = body;
    if (!profileId || lat == null || lng == null) {
      return NextResponse.json({ error: "profileId, lat, lng required" }, { status: 400 });
    }
    const ok = await updateProviderLocation({ profileId, lat, lng });
    return NextResponse.json({ ok });
  }

  if (action === "toggle_sharing") {
    const { profileId, enabled } = body;
    if (!profileId || enabled == null) {
      return NextResponse.json({ error: "profileId, enabled required" }, { status: 400 });
    }
    const ok = await setLocationSharing(profileId, enabled);
    return NextResponse.json({ ok });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
