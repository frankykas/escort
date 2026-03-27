import dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const EMAIL    = "escort@cleopatre.test";
const PASSWORD = "Escort1234!";
const USERNAME = "sophia.belle";

async function run() {
  // 1. Create auth user
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });

  if (authErr) {
    // If already exists, try to look them up
    if (authErr.message.includes("already")) {
      console.log("⚠️  User already exists, fetching…");
      const { data: list } = await supabase.auth.admin.listUsers();
      const existing = list?.users.find((u) => u.email === EMAIL);
      if (!existing) { console.error("Could not find existing user"); process.exit(1); }
      await upsertProfile(existing.id);
      return;
    }
    console.error("Auth error:", authErr.message);
    process.exit(1);
  }

  const userId = authData.user.id;
  console.log("✅  Auth user created:", userId);
  await upsertProfile(userId);
}

async function upsertProfile(userId: string) {
  const availableUntil = new Date(Date.now() + 6 * 3600 * 1000).toISOString(); // 6h from now

  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    username: USERNAME,
    bio: "Montreal's finest. Sophisticated, discreet, unforgettable.",
    bio_long: "Welcome. I'm Sophia — a refined companion for the discerning gentleman. Whether you're seeking stimulating conversation over dinner, a cultural evening, or simply the pleasure of good company, I curate every encounter with grace and attention to detail.\n\nBased in Old Montreal. Available for incall at my private suite or selective outcall.",
    avatar_url: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&q=80",
    is_provider: true,
    verification_status: "verified",
    age: 26,
    city: "Montreal",
    country_code: "CA",
    incall: true,
    outcall: true,
    available_until: availableUntil,
  }, { onConflict: "id" });

  if (error) { console.error("Profile upsert error:", error.message); process.exit(1); }
  console.log("✅  Profile created");

  // Add a listing
  // Check if listing already exists to avoid duplicates
  const { data: existingListing } = await supabase
    .from("listings").select("id").eq("provider_id", userId).limit(1).single();
  if (existingListing) { console.log("✅  Listing already exists, skipping"); }

  const { error: listErr } = existingListing ? { error: null } : await supabase.from("listings").insert({
    provider_id: userId,
    title: "Dinner Date — Downtown",
    description: "A sophisticated evening of fine dining and genuine connection. I'll meet you at your preferred restaurant in Old Montreal or Plateau. We'll share good food, good wine, and conversation that lingers.",
    rate: 45000, // CA$450
    duration_minutes: 120,
    service_type: "outcall",
    is_active: true,
    perks: ["Dinner included", "French & English", "Discreet", "GFE"],
    deposit_required: false,
    advance_notice_hours: 4,
    outcall_areas: ["Old Montreal", "Plateau", "Downtown", "Westmount"],
  });

  if (listErr) { console.error("Listing error:", listErr.message); }
  else console.log("✅  Listing created");

  console.log("\n─────────────────────────────────────────");
  console.log("  Test Escort Account");
  console.log("─────────────────────────────────────────");
  console.log(`  Email    : ${EMAIL}`);
  console.log(`  Password : ${PASSWORD}`);
  console.log(`  Username : @${USERNAME}`);
  console.log(`  Profile  : /u/${USERNAME}`);
  console.log("─────────────────────────────────────────\n");
}

run();
