import dotenv from "dotenv";
import { resolve } from "path";

// Load .env.local before anything else
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "❌  Missing env vars. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------
// Seed data definitions (no hardcoded UUIDs — real IDs come from auth.users)
// ---------------------------------------------------------------------------

const SEED_DOMAIN = "cleopatra.seed";

const providerData = [
  {
    username: "luxe.spaces",
    avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&q=80",
    bio: "Transforming spaces into sanctuaries. Interior design & staging.",
    statusUpdates: [
      {
        caption: "This one took 6 weeks and I cried a little when we finished. Notting Hill townhouse, full staging. The client said 'quiet luxury' and I said say less 🖤 DM me if you want a walkthrough.",
        media_url: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&q=80",
        views_count: 8_341,
        comments_count: 47,
      },
      {
        caption: "Obsessed with how this turned out. Marble, warm light, nothing extra. Sometimes the most powerful thing you can do in a room is leave space. Saving this one for the portfolio forever.",
        media_url: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&q=80",
        views_count: 5_203,
        comments_count: 31,
      },
    ],
  },
  {
    username: "skyline.nina",
    avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&q=80",
    bio: "Luxury real estate. City penthouses & countryside estates.",
    statusUpdates: [
      {
        caption: "32nd floor. Floor-to-ceiling glass. I got here at 5:47am to catch this light and honestly I'd do it again every single morning. New listing dropping Thursday — drop a 🔑 if you want first look.",
        media_url: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&q=80",
        views_count: 11_872,
        comments_count: 64,
      },
    ],
  },
  {
    username: "auric.studio",
    avatar_url: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=80&q=80",
    bio: "Fine art photography. Light, shadow, and truth.",
    statusUpdates: [
      {
        caption: "Hampstead Heath, last Tuesday, that 20-minute window where the whole world goes golden. I've been sitting on this shot for days because I wasn't ready to share it. Limited prints available — DM before they're gone.",
        media_url: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=800&q=80",
        views_count: 9_610,
        comments_count: 53,
      },
      {
        caption: "Studio day. No brief, no client, just me and the light. These are the sessions that remind me why I started. If you know, you know.",
        media_url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80",
        views_count: 4_887,
        comments_count: 22,
      },
    ],
  },
  {
    username: "velvet.grove",
    avatar_url: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&q=80",
    bio: "Holistic wellness rituals. Botanicals, silence, and slow living.",
    statusUpdates: [
      {
        caption: "My Saturday morning before anyone else is awake. Rose water, raw honey, no phone for the first hour. This is the whole practice honestly. My 1:1 wellness packages just reopened — 3 spots left this month, link in bio 🌿",
        media_url: "https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=800&q=80",
        views_count: 7_129,
        comments_count: 39,
      },
    ],
  },
  {
    username: "atlas.james",
    avatar_url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=80&q=80",
    bio: "Adventure travel. Off-grid experiences, curated escapes.",
    statusUpdates: [
      {
        caption: "3 days in the Dolomites with zero signal and I came back a different person. No agenda, no itinerary, just altitude and whatever you brought with you. Next guided escape is filling up — 6 spots left and I won't be adding more.",
        media_url: "https://images.unsplash.com/photo-1502764613149-7f1d229e230f?w=800&q=80",
        views_count: 13_445,
        comments_count: 78,
      },
      {
        caption: "Every place I've been looked nothing like how I imagined it. Better, mostly. Scarier, sometimes. Realer, always. Stop planning. Go.",
        media_url: "https://images.unsplash.com/photo-1523264939339-c89f9dadde2e?w=800&q=80",
        views_count: 6_034,
        comments_count: 19,
      },
    ],
  },
  {
    username: "opuslens",
    avatar_url: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=80&q=80",
    bio: "Cinematic content creation. Film-grade visuals for modern brands.",
    statusUpdates: [
      {
        caption: "BTS from yesterday's brand shoot in Shoreditch. Anamorphic lenses, all practical lighting, a crew of 4 who eat pressure for breakfast. Brands — if you're still shooting on an iPhone and wondering why it doesn't land, my DMs are open.",
        media_url: "https://images.unsplash.com/photo-1488161628813-04466f872be2?w=800&q=80",
        views_count: 10_256,
        comments_count: 61,
      },
    ],
  },
  {
    username: "themarketco",
    avatar_url: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=80&q=80",
    bio: "Curated fashion marketplace. Rare pieces, timeless style.",
    statusUpdates: [
      {
        caption: "Archive drop this Friday. Margiela, Prada SS02, and two pieces I've been holding back for months waiting for the right moment. Not naming them yet. Set a reminder. You've been warned.",
        media_url: "https://images.unsplash.com/photo-1496440737103-cd596325d314?w=800&q=80",
        views_count: 15_903,
        comments_count: 92,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getOrCreateAuthUser(username: string): Promise<string> {
  const email = `${username}@${SEED_DOMAIN}`;

  // Check if user already exists by listing and filtering
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users.find((u) => u.email === email);
  if (existing) return existing.id;

  // Create a new auth user — the handle_new_user trigger will auto-create
  // a basic profiles row with username = split_part(email, '@', 1)
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: "seed_password_never_used_123!",
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`Failed to create auth user for ${username}: ${error?.message}`);
  }

  return data.user.id;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

async function seed() {
  console.log("🌱  Seeding Cleopatra...\n");

  const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const allProviderIds: string[] = [];

  for (const provider of providerData) {
    // 1. Ensure a real auth.users row exists and get its ID
    const userId = await getOrCreateAuthUser(provider.username);
    allProviderIds.push(userId);

    // 2. Update the profile row (created by trigger) with full seed data
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        username: provider.username,
        avatar_url: provider.avatar_url,
        bio: provider.bio,
        is_provider: true,
        verification_status: "verified",
      })
      .eq("id", userId);

    if (profileError) {
      console.error(`❌  Failed to update profile for ${provider.username}:`, profileError.message);
      process.exit(1);
    }

    console.log(`✅  Profile ready: @${provider.username} (${userId.slice(0, 8)}…)`);

    // 3. Clear old seed status_updates for this provider and insert fresh ones
    await supabase.from("status_updates").delete().eq("provider_id", userId);

    const updates = provider.statusUpdates.map((u) => ({
      provider_id: userId,
      caption: u.caption,
      media_url: u.media_url,
      expires_at: in24h,
      views_count: u.views_count,
      comments_count: u.comments_count,
    }));

    const { error: updatesError } = await supabase.from("status_updates").insert(updates);

    if (updatesError) {
      console.error(`❌  Failed to insert status updates for ${provider.username}:`, updatesError.message);
      process.exit(1);
    }

    console.log(`   ↳ ${updates.length} status update(s) inserted`);
  }

  const totalUpdates = providerData.reduce((n, p) => n + p.statusUpdates.length, 0);
  console.log(
    `\n🎉  Done! ${providerData.length} profiles · ${totalUpdates} status updates\n` +
    `   Set NEXT_PUBLIC_USE_SOCIAL_FEED=true in .env.local and run: npm run dev`
  );
}

seed();
