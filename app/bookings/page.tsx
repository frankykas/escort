"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronLeft, CheckCircle, Clock, XCircle, Calendar,
  MapPin, Loader2, Star, PenLine,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";

type Booking = {
  id: string;
  status: "pending" | "accepted" | "declined" | "completed" | "cancelled";
  requested_date: string;
  requested_time: string | null;
  duration_minutes: number | null;
  service_type: string | null;
  area: string | null;
  notes: string | null;
  created_at: string;
  listings: { title: string } | null;
  provider: {
    id: string;
    username: string;
    avatar_url: string | null;
    verification_status: string;
  } | null;
  review?: { id: string } | null;
};

const STATUS = {
  pending:   { label: "Awaiting response", color: "text-amber-400",   bg: "bg-amber-400/10",   icon: Clock },
  accepted:  { label: "Confirmed",         color: "text-sky-400",     bg: "bg-sky-400/10",     icon: CheckCircle },
  declined:  { label: "Declined",          color: "text-zinc-500",    bg: "bg-zinc-700/30",    icon: XCircle },
  completed: { label: "Completed",         color: "text-emerald-400", bg: "bg-emerald-500/10", icon: Star },
  cancelled: { label: "Cancelled",         color: "text-zinc-500",    bg: "bg-zinc-700/30",    icon: XCircle },
};

export default function ClientBookingsPage() {
  const router = useRouter();
  const { user, checked } = useSession();

  const [bookings, setBookings]         = useState<Booking[]>([]);
  const [loading, setLoading]           = useState(true);
  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);
  const [toast, setToast]               = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!checked) return;
    if (!user) { router.replace("/auth/signin"); return; }
    load();
  }, [user, checked]);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("bookings")
      .select(`
        id, status, requested_date, requested_time, duration_minutes,
        service_type, area, notes, created_at,
        listings ( title ),
        provider:profiles!bookings_provider_id_fkey ( id, username, avatar_url, verification_status ),
        review:reviews ( id )
      `)
      .eq("client_id", user.id)
      .order("created_at", { ascending: false });
    setBookings((data as unknown as Booking[]) ?? []);
    setLoading(false);
  }

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  const active = bookings.filter((b) => b.status === "pending" || b.status === "accepted");
  const past   = bookings.filter((b) => b.status === "completed" || b.status === "declined" || b.status === "cancelled");

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/5 bg-zinc-950/90 px-4 py-3 backdrop-blur-xl">
        <button onClick={() => router.back()} className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-white">
          <ChevronLeft size={20} />
        </button>
        <span className="text-[15px] font-semibold text-white">My Bookings</span>
      </header>

      {loading ? (
        <div className="flex items-center justify-center pt-20">
          <Loader2 size={24} className="animate-spin text-zinc-600" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 pt-24 px-8 text-center">
          <Calendar size={32} className="text-zinc-700" />
          <p className="text-[15px] font-semibold text-white">No bookings yet</p>
          <p className="text-[13px] text-zinc-500">Submit an enquiry from any provider's profile or listing to create a booking.</p>
          <Link href="/explore" className="mt-2 rounded-full bg-amber-400 px-6 py-2.5 text-[14px] font-semibold text-zinc-950 transition hover:bg-amber-300">
            Browse providers
          </Link>
        </div>
      ) : (
        <div className="mx-auto max-w-lg px-4 pt-4 space-y-6">
          {active.length > 0 && (
            <div>
              <p className="mb-3 px-1 text-[11px] font-medium uppercase tracking-widest text-zinc-600">Active</p>
              <div className="space-y-3">
                {active.map((b) => (
                  <ClientBookingCard key={b.id} booking={b} onReview={() => setReviewBooking(b)} />
                ))}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <p className="mb-3 px-1 text-[11px] font-medium uppercase tracking-widest text-zinc-600">Past</p>
              <div className="space-y-3">
                {past.map((b) => (
                  <ClientBookingCard key={b.id} booking={b} onReview={() => setReviewBooking(b)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Review sheet */}
      <AnimatePresence>
        {reviewBooking && (
          <ReviewSheet
            booking={reviewBooking}
            userId={user?.id ?? null}
            onClose={() => setReviewBooking(null)}
            onSubmitted={() => {
              setReviewBooking(null);
              setBookings((prev) =>
                prev.map((b) => b.id === reviewBooking.id ? { ...b, review: { id: "done" } } : b)
              );
              showToast("Review submitted — thank you!", true);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
            className={cn("fixed bottom-8 left-1/2 -translate-x-1/2 rounded-full px-5 py-2.5 text-[13px] font-medium shadow-xl z-50",
              toast.ok ? "bg-emerald-500 text-white" : "bg-red-500 text-white")}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ClientBookingCard({ booking, onReview }: { booking: Booking; onReview: () => void }) {
  const cfg = STATUS[booking.status];
  const StatusIcon = cfg.icon;
  const provider = booking.provider;
  const isVerified = provider?.verification_status === "verified";
  const canReview = booking.status === "completed" && !booking.review?.id;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/5 bg-zinc-900">
      <Link href={provider ? `/u/${provider.username}` : "#"} className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
        <div className="relative flex-shrink-0">
          <div className="h-10 w-10 overflow-hidden rounded-full bg-zinc-800">
            {provider?.avatar_url ? (
              <Image src={provider.avatar_url} alt={provider.username} width={40} height={40} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-bold text-zinc-400">
                {provider?.username?.[0]?.toUpperCase()}
              </div>
            )}
          </div>
          {isVerified && <CheckCircle size={13} className="absolute -bottom-0.5 -right-0.5 fill-zinc-900 text-amber-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-white truncate">@{provider?.username}</p>
          {booking.listings?.title && (
            <p className="text-[12px] text-amber-400 truncate">{booking.listings.title}</p>
          )}
        </div>
        <span className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold flex-shrink-0", cfg.bg, cfg.color)}>
          <StatusIcon size={10} />
          {cfg.label}
        </span>
      </Link>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-4 py-3">
        <span className="flex items-center gap-1.5 text-[13px] text-zinc-300">
          <Calendar size={13} className="text-zinc-500" />
          {new Date(booking.requested_date).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })}
          {booking.requested_time && <span className="text-zinc-500">· {booking.requested_time}</span>}
        </span>
        {booking.duration_minutes && (
          <span className="flex items-center gap-1.5 text-[13px] text-zinc-300">
            <Clock size={13} className="text-zinc-500" />
            {booking.duration_minutes >= 60
              ? `${Math.floor(booking.duration_minutes / 60)}h${booking.duration_minutes % 60 ? ` ${booking.duration_minutes % 60}m` : ""}`
              : `${booking.duration_minutes}m`}
          </span>
        )}
        {booking.service_type && <span className="text-[13px] text-zinc-400 capitalize">{booking.service_type}</span>}
        {booking.area && (
          <span className="flex items-center gap-1 text-[13px] text-zinc-400">
            <MapPin size={11} className="text-zinc-600" />{booking.area}
          </span>
        )}
      </div>

      {canReview && (
        <div className="border-t border-white/5 px-4 py-3">
          <button
            onClick={onReview}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-2.5 text-[13px] font-semibold text-zinc-950 transition hover:bg-amber-300"
          >
            <PenLine size={14} /> Leave a Review
          </button>
        </div>
      )}
      {booking.status === "completed" && booking.review?.id && (
        <div className="flex items-center gap-2 border-t border-white/5 px-4 py-3">
          <Star size={13} className="fill-amber-400 text-amber-400" />
          <p className="text-[12px] text-zinc-500">You reviewed this booking.</p>
        </div>
      )}
    </div>
  );
}

function ReviewSheet({
  booking, userId, onClose, onSubmitted,
}: {
  booking: Booking;
  userId: string | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [rating, setRating]   = useState(0);
  const [hovered, setHovered] = useState(0);
  const [body, setBody]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function submit() {
    if (!userId || rating === 0) { setError("Please select a rating."); return; }
    setSubmitting(true);
    const { error: err } = await supabase.from("reviews").insert({
      booking_id:  booking.id,
      reviewer_id: userId,
      reviewee_id: booking.provider?.id,
      rating,
      body: body.trim() || null,
    });
    setSubmitting(false);
    if (err) { setError("Failed to submit. Please try again."); return; }
    onSubmitted();
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-white/10 bg-zinc-900 px-6 pb-10 pt-5"
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-zinc-700" />
        <h2 className="text-[17px] font-bold text-white">Leave a Review</h2>
        <p className="mt-1 text-[13px] text-zinc-500">
          How was your experience with <span className="text-zinc-300">@{booking.provider?.username}</span>?
        </p>

        {/* Star rating */}
        <div className="mt-5 flex gap-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              onClick={() => setRating(s)}
              onMouseEnter={() => setHovered(s)}
              onMouseLeave={() => setHovered(0)}
              className="transition-transform hover:scale-110 active:scale-95"
            >
              <Star
                size={36}
                className={cn(
                  "transition-colors",
                  (hovered || rating) >= s ? "fill-amber-400 text-amber-400" : "text-zinc-700"
                )}
              />
            </button>
          ))}
        </div>
        <p className="mt-1.5 h-4 text-[12px] text-amber-400">
          {["", "Poor", "Fair", "Good", "Great", "Excellent"][hovered || rating]}
        </p>

        {/* Written review */}
        <div className="mt-4">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share your experience (optional)…"
            maxLength={800}
            rows={4}
            className="w-full resize-none rounded-2xl border border-white/10 bg-zinc-800 px-4 py-3 text-[14px] text-white placeholder-zinc-600 outline-none focus:border-amber-400/30"
          />
          <p className="mt-1 text-right text-[11px] text-zinc-600">{body.length}/800</p>
        </div>

        {error && <p className="mt-2 text-[12px] text-red-400">{error}</p>}

        <div className="mt-4 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-2xl border border-white/10 py-3.5 text-[14px] font-medium text-zinc-400 transition hover:bg-zinc-800">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={rating === 0 || submitting}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-[14px] font-semibold transition",
              rating > 0 && !submitting ? "bg-amber-400 text-zinc-950 hover:bg-amber-300" : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            )}
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Submit Review
          </button>
        </div>
      </motion.div>
    </>
  );
}
