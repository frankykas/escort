"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronLeft, CheckCircle, Clock, XCircle, Calendar,
  MapPin, Loader2,
} from "lucide-react";
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
};

const STATUS = {
  pending:   { label: "Awaiting response", color: "text-pink-500",   bg: "bg-pink-50",   icon: Clock },
  accepted:  { label: "Confirmed",         color: "text-sky-400",     bg: "bg-sky-50",     icon: CheckCircle },
  declined:  { label: "Declined",          color: "text-slate-500",    bg: "bg-gray-100",    icon: XCircle },
  completed: { label: "Completed",         color: "text-emerald-500", bg: "bg-emerald-50", icon: CheckCircle },
  cancelled: { label: "Cancelled",         color: "text-slate-500",    bg: "bg-gray-100",    icon: XCircle },
};

export default function ClientBookingsPage() {
  const router = useRouter();
  const { user, checked } = useSession();

  const [bookings, setBookings]         = useState<Booking[]>([]);
  const [loading, setLoading]           = useState(true);

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
        provider:profiles!bookings_provider_id_fkey ( id, username, avatar_url, verification_status )
      `)
      .eq("client_id", user.id)
      .order("created_at", { ascending: false });
    setBookings((data as unknown as Booking[]) ?? []);
    setLoading(false);
  }

  const active = bookings.filter((b) => b.status === "pending" || b.status === "accepted");
  const past   = bookings.filter((b) => b.status === "completed" || b.status === "declined" || b.status === "cancelled");

  return (
    <div className="min-h-screen bg-[#fafbfc] pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-[#fafbfc]/90 px-4 py-3 backdrop-blur-xl">
        <button onClick={() => router.back()} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-gray-100 hover:text-slate-800">
          <ChevronLeft size={20} />
        </button>
        <span className="text-[15px] font-semibold text-slate-800">My Bookings</span>
      </header>

      {loading ? (
        <div className="flex items-center justify-center pt-20">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 pt-24 px-8 text-center">
          <Calendar size={32} className="text-slate-300" />
          <p className="text-[15px] font-semibold text-slate-800">No bookings yet</p>
          <p className="text-[13px] text-slate-500">Submit an enquiry from any provider's profile or listing to create a booking.</p>
          <Link href="/explore" className="mt-2 rounded-full bg-[rgb(246,51,154)] px-6 py-2.5 text-[14px] font-semibold text-white transition hover:brightness-105">
            Browse providers
          </Link>
        </div>
      ) : (
        <div className="mx-auto max-w-lg px-4 pt-4 space-y-6">
          {active.length > 0 && (
            <div>
              <p className="mb-3 px-1 text-[11px] font-medium uppercase tracking-widest text-slate-400">Active</p>
              <div className="space-y-3">
                {active.map((b) => (
                  <ClientBookingCard key={b.id} booking={b} />
                ))}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <p className="mb-3 px-1 text-[11px] font-medium uppercase tracking-widest text-slate-400">Past</p>
              <div className="space-y-3">
                {past.map((b) => (
                  <ClientBookingCard key={b.id} booking={b} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

function ClientBookingCard({ booking }: { booking: Booking }) {
  const cfg = STATUS[booking.status];
  const StatusIcon = cfg.icon;
  const provider = booking.provider;
  const isVerified = provider?.verification_status === "verified";

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <Link href={provider ? `/u/${provider.username}` : "#"} className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
        <div className="relative flex-shrink-0">
          <div className="h-10 w-10 overflow-hidden rounded-full bg-gray-100">
            {provider?.avatar_url ? (
              <Image src={provider.avatar_url} alt={provider.username} width={40} height={40} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-bold text-slate-500">
                {provider?.username?.[0]?.toUpperCase()}
              </div>
            )}
          </div>
          {isVerified && <CheckCircle size={13} className="absolute -bottom-0.5 -right-0.5 fill-white text-pink-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-slate-800 truncate">@{provider?.username}</p>
          {booking.listings?.title && (
            <p className="text-[12px] text-pink-500 truncate">{booking.listings.title}</p>
          )}
        </div>
        <span className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold flex-shrink-0", cfg.bg, cfg.color)}>
          <StatusIcon size={10} />
          {cfg.label}
        </span>
      </Link>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-4 py-3">
        <span className="flex items-center gap-1.5 text-[13px] text-slate-600">
          <Calendar size={13} className="text-slate-500" />
          {new Date(booking.requested_date).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })}
          {booking.requested_time && <span className="text-slate-500">· {booking.requested_time}</span>}
        </span>
        {booking.duration_minutes && (
          <span className="flex items-center gap-1.5 text-[13px] text-slate-600">
            <Clock size={13} className="text-slate-500" />
            {booking.duration_minutes >= 60
              ? `${Math.floor(booking.duration_minutes / 60)}h${booking.duration_minutes % 60 ? ` ${booking.duration_minutes % 60}m` : ""}`
              : `${booking.duration_minutes}m`}
          </span>
        )}
        {booking.service_type && <span className="text-[13px] text-slate-500 capitalize">{booking.service_type}</span>}
        {booking.area && (
          <span className="flex items-center gap-1 text-[13px] text-slate-500">
            <MapPin size={11} className="text-slate-400" />{booking.area}
          </span>
        )}
      </div>

    </div>
  );
}
