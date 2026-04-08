"use client";

/**
 * OnboardingTour — role-aware first-time spotlight tour.
 *
 * Renders different tours for clients vs. providers. Each tour runs once per
 * user (tracked in localStorage). Drop this anywhere in the layout — it
 * mounts itself only after onboarding has completed.
 */

import { SpotlightTour, type TourStep } from "./SpotlightTour";
import { useProfile } from "@/contexts/ProfileContext";

const PROVIDER_STEPS: TourStep[] = [
  {
    target: "nav-home",
    title: "Welcome to Cleopatra",
    body: "This is your home feed — where the social side of the platform lives. Browse posts, stories, and discover what's trending.",
  },
  {
    target: "nav-explore",
    title: "Explore providers",
    body: "Tap here to browse other creators, search by city, and see what's working in your market.",
  },
  {
    target: "nav-create",
    title: "Create content",
    body: "This is where you'll spend most of your time. Tap the gold button to share a story, post a photo, or publish a new listing.",
  },
  {
    target: "nav-messages",
    title: "Your messages",
    body: "All client conversations live here. New unread messages show a badge.",
  },
  {
    target: "nav-profile",
    title: "Your profile",
    body: "Customize your bio, manage listings, view your performance, and get verified — all from here.",
  },
];

const CLIENT_STEPS: TourStep[] = [
  {
    target: "nav-home",
    title: "Welcome to Cleopatra",
    body: "This is your home feed. Discover posts, stories, and trending providers.",
  },
  {
    target: "nav-explore",
    title: "Find what you're looking for",
    body: "Search by city, browse categories, and filter by your preferences.",
  },
  {
    target: "nav-messages",
    title: "Your messages",
    body: "Chat with providers you've connected with. All conversations are private.",
  },
  {
    target: "nav-profile",
    title: "Your profile",
    body: "Manage your favorites, account settings, and privacy preferences.",
  },
];

export function OnboardingTour() {
  const { profile, isProvider, loading } = useProfile();

  // Don't run until profile is loaded and onboarding is complete
  if (loading || !profile) return null;
  if (!profile.onboarding_completed) return null;

  // Scope the storage key by user id so a brand-new account always gets the
  // tour, even if another account on the same browser already completed it.
  const role = isProvider ? "provider" : "client";
  const storageKey = `${role}-tour-v1:${profile.id}`;

  return (
    <SpotlightTour
      steps={isProvider ? PROVIDER_STEPS : CLIENT_STEPS}
      storageKey={storageKey}
    />
  );
}
