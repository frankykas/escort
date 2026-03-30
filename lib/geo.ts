import { createServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NearbyProvider {
  provider_id: string;
  username: string;
  avatar_url: string | null;
  city: string | null;
  distance_km: number;
  latest_post_at: string | null;
  verification_status: string;
}

interface CityProvider {
  provider_id: string;
  username: string;
  avatar_url: string | null;
  city: string | null;
  latest_post_at: string | null;
  verification_status: string;
}

interface UpdateLocationParams {
  profileId: string;
  lat: number;
  lng: number;
}

// ---------------------------------------------------------------------------
// Find providers within a radius (sorted by latest post)
// ---------------------------------------------------------------------------

export async function findProvidersNearby(
  lat: number,
  lng: number,
  radiusKm: number = 50,
  limit: number = 50,
  offset: number = 0
): Promise<NearbyProvider[]> {
  const supabase = createServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("find_providers_nearby", {
    p_lat: lat,
    p_lng: lng,
    p_radius_km: radiusKm,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    console.error("Error finding nearby providers:", error.message);
    return [];
  }

  return (data ?? []) as NearbyProvider[];
}

// ---------------------------------------------------------------------------
// Find providers by city (sorted by latest post)
// ---------------------------------------------------------------------------

export async function findProvidersByCity(
  city: string,
  limit: number = 50,
  offset: number = 0
): Promise<CityProvider[]> {
  const supabase = createServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("find_providers_by_city", {
    p_city: city,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    console.error("Error finding providers by city:", error.message);
    return [];
  }

  return (data ?? []) as CityProvider[];
}

// ---------------------------------------------------------------------------
// Update provider's location (PostGIS geography point)
// ---------------------------------------------------------------------------

export async function updateProviderLocation(params: UpdateLocationParams): Promise<boolean> {
  const supabase = createServerClient();
  if (!supabase) return false;

  const { profileId, lat, lng } = params;

  // Upsert into locations table (PostGIS geography)
  const { error } = await supabase.rpc("update_provider_location", {
    p_profile_id: profileId,
    p_lat: lat,
    p_lng: lng,
  });

  // If RPC doesn't exist yet, fall back to direct upsert
  if (error) {
    const pointWkt = `POINT(${lng} ${lat})`;
    const { error: upsertError } = await supabase
      .from("locations")
      .upsert(
        {
          profile_id: profileId,
          last_known_coords: pointWkt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "profile_id" }
      );

    if (upsertError) {
      console.error("Error updating location:", upsertError.message);
      return false;
    }
  }

  // Also update lat/lng on profile for simple queries
  await supabase
    .from("profiles")
    .update({ lat, lng })
    .eq("id", profileId);

  return true;
}

// ---------------------------------------------------------------------------
// Toggle location sharing for a provider
// ---------------------------------------------------------------------------

export async function setLocationSharing(
  profileId: string,
  enabled: boolean
): Promise<boolean> {
  const supabase = createServerClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("profiles")
    .update({ location_sharing_enabled: enabled })
    .eq("id", profileId);

  if (error) {
    console.error("Error toggling location sharing:", error.message);
    return false;
  }

  return true;
}
