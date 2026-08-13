'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Clock, PlusCircle, CheckCircle2, CalendarClock, Scissors, XCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { BarberStatus, Service } from '@/lib/supabase/types';

export type BarberOption = {
  id: string;
  full_name: string | null;
  barber_status: BarberStatus | null;
  is_clocked_in: boolean;
};

const formatRupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function defaultDate() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// Rounds up to the next half hour so the default slot is always bookable.
function defaultTime() {
  const d = new Date();
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

const statusDot: Record<string, string> = {
  free: 'bg-green-500',
  busy: 'bg-red-500',
  break: 'bg-yellow-500',
  offline: 'bg-gray-500',
};

const statusLabel: Record<string, string> = {
  free: 'Free',
  busy: 'Busy',
  break: 'Break',
  offline: 'Offline',
};

// Live badge: kapster yang sedang clock-in tampil status free/busy/break-nya; yang tidak "Offline"
// tapi tetap bisa dipilih untuk booking terjadwal (roster tetap cabang).
function barberDisplayStatus(barber: BarberOption): string {
  if (!barber.is_clocked_in) return 'offline';
  return barber.barber_status ?? 'free';
}

export default function BookingForm({
  branchId,
  mainServices,
  addons,
  barbers,
  basePath = '/booking',
}: {
  branchId: string;
  mainServices: Service[];
  addons: Service[];
  barbers: BarberOption[];
  basePath?: string;
}) {
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [selectedBarberId, setSelectedBarberId] = useState<string | null>(null);
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [bookingOutcome, setBookingOutcome] = useState<'approved' | 'rejected' | 'pending'>('pending');
  const [conflictingBarberIds, setConflictingBarberIds] = useState<Set<string>>(new Set());
  const [barberAutoCleared, setBarberAutoCleared] = useState(false);
  const conflictCheckDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedService = mainServices.find((s) => s.id === selectedServiceId) ?? null;
  const selectedAddons = addons.filter((a) => selectedAddonIds.includes(a.id));
  const serviceTotal = selectedService?.price ?? 0;
  const addonsTotal = selectedAddons.reduce((sum, a) => sum + a.price, 0);
  const total = serviceTotal + addonsTotal;
  const totalDurationMinutes = (selectedService?.duration_minutes ?? 0) + selectedAddons.reduce((sum, a) => sum + a.duration_minutes, 0);

  // Re-check every listed barber for schedule conflicts whenever the requested slot changes —
  // "bentrok" means an existing pending/confirmed booking of theirs overlaps this time window.
  useEffect(() => {
    if (conflictCheckDebounce.current) clearTimeout(conflictCheckDebounce.current);

    if (barbers.length === 0 || totalDurationMinutes <= 0 || !date || !time) {
      setConflictingBarberIds(new Set());
      return;
    }
    const windowStart = new Date(`${date}T${time}:00`);
    if (Number.isNaN(windowStart.getTime())) {
      setConflictingBarberIds(new Set());
      return;
    }
    const windowEnd = new Date(windowStart.getTime() + totalDurationMinutes * 60_000);

    conflictCheckDebounce.current = setTimeout(async () => {
      const supabase = createClient();
      const results = await Promise.all(
        barbers.map(async (barber) => {
          const { data } = await supabase.rpc('barber_has_conflict', {
            target_barber_id: barber.id,
            window_start: windowStart.toISOString(),
            window_end: windowEnd.toISOString(),
          });
          return data ? barber.id : null;
        })
      );
      setConflictingBarberIds(new Set(results.filter((id): id is string => id !== null)));
    }, 300);

    return () => {
      if (conflictCheckDebounce.current) clearTimeout(conflictCheckDebounce.current);
    };
  }, [barbers, date, time, totalDurationMinutes]);

  // If the barber the customer already picked just became conflicted (they changed the time,
  // or someone else grabbed that slot), fall back to "no preference" instead of silently
  // submitting a booking against a busy barber.
  useEffect(() => {
    if (selectedBarberId && conflictingBarberIds.has(selectedBarberId)) {
      setSelectedBarberId(null);
      setBarberAutoCleared(true);
    }
  }, [conflictingBarberIds, selectedBarberId]);

  function toggleAddon(id: string) {
    setSelectedAddonIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleConfirm() {
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = `/auth?redirect=${basePath}${branchId ? '?branch=' + branchId : ''}`;
      return;
    }

    if (!selectedService) {
      setError('Pilih layanan utama terlebih dahulu.');
      return;
    }

    if (!date || !time) {
      setError('Pilih tanggal dan jam booking terlebih dahulu.');
      return;
    }

    const scheduledAt = new Date(`${date}T${time}:00`);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= new Date().getTime()) {
      setError('Jadwal booking harus di waktu yang akan datang.');
      return;
    }

    setSubmitting(true);

    // Re-check right before saving — the debounced check above can be a few seconds stale,
    // and someone else may have just taken this barber's slot.
    if (selectedBarberId) {
      const windowEnd = new Date(scheduledAt.getTime() + totalDurationMinutes * 60_000);
      const { data: hasConflict } = await supabase.rpc('barber_has_conflict', {
        target_barber_id: selectedBarberId,
        window_start: scheduledAt.toISOString(),
        window_end: windowEnd.toISOString(),
      });
      if (hasConflict) {
        setError('Kapster ini baru saja penuh di jam tersebut. Pilih kapster lain atau ubah jadwal.');
        setSubmitting(false);
        return;
      }
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        branch_id: branchId,
        customer_id: user.id,
        barber_id: selectedBarberId,
        status: 'pending',
        source: 'online',
        scheduled_at: scheduledAt.toISOString(),
        total_price: total,
      })
      .select()
      .single();

    if (bookingError || !booking) {
      setError(bookingError?.message ?? 'Gagal membuat booking. Coba lagi.');
      setSubmitting(false);
      return;
    }

    const items = [selectedService, ...selectedAddons].map((s) => ({
      booking_id: booking.id,
      service_id: s.id,
      service_name: s.name,
      price: s.price,
    }));

    const { error: itemsError } = await supabase.from('booking_items').insert(items);

    if (itemsError) {
      setError(itemsError.message);
      setSubmitting(false);
      return;
    }

    // Try to auto-confirm right away so the customer doesn't have to wait on staff — this only
    // succeeds if the preferred barber (if any) is actually free for this window. On a genuine
    // race (someone else grabbed the slot in the same instant) the booking is auto-cancelled
    // server-side instead of left dangling as 'pending' — we surface that clearly below rather
    // than showing a false "menunggu konfirmasi" that would never actually resolve.
    const { data: finalStatus, error: autoConfirmError } = await supabase.rpc('customer_try_auto_confirm_booking', {
      target_booking_id: booking.id,
    });
    if (autoConfirmError) setBookingOutcome('pending');
    else if (finalStatus === 'cancelled') setBookingOutcome('rejected');
    else if (finalStatus === 'approved') setBookingOutcome('approved');
    else setBookingOutcome('pending');

    setSubmitting(false);
    setSuccess(true);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="md:col-span-2 space-y-6">
        {/* Main Services */}
        <div className="glass-panel p-6 rounded-2xl">
          <h2 className="text-2xl font-semibold mb-4">Select Service</h2>
          {mainServices.length === 0 ? (
            <p className="text-gray-400 text-sm">Belum ada layanan di cabang ini.</p>
          ) : (
            <div className="space-y-4">
              {mainServices.map((service) => (
                <label
                  key={service.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-[var(--border)] bg-white/5 cursor-pointer hover:border-primary transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <input
                      type="radio"
                      name="main_service"
                      className="w-5 h-5 accent-primary"
                      checked={selectedServiceId === service.id}
                      onChange={() => setSelectedServiceId(service.id)}
                    />
                    <div>
                      <h4 className="font-medium text-lg">{service.name}</h4>
                      <p className="text-sm text-gray-400">{service.duration_minutes} mins</p>
                    </div>
                  </div>
                  <span className="font-bold">{formatRupiah(service.price)}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Smart Add-ons */}
        <div className="glass-panel p-6 rounded-2xl">
          <div className="flex items-center gap-2 mb-4">
            <PlusCircle className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-semibold">Recommended Add-ons</h2>
          </div>
          {addons.length === 0 ? (
            <p className="text-gray-400 text-sm">Belum ada layanan tambahan di cabang ini.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {addons.map((addon) => (
                <label
                  key={addon.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-white/5 cursor-pointer hover:border-primary transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded text-primary accent-primary"
                      checked={selectedAddonIds.includes(addon.id)}
                      onChange={() => toggleAddon(addon.id)}
                    />
                    <span className="font-medium text-sm">{addon.name}</span>
                  </div>
                  <span className="text-sm text-primary">+{formatRupiah(addon.price)}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Schedule */}
        <div className="glass-panel p-6 rounded-2xl">
          <div className="flex items-center gap-2 mb-4">
            <CalendarClock className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-semibold">Pilih Jadwal</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Tanggal</label>
              <input
                type="date"
                value={date}
                min={defaultDate()}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white/5 border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Jam</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-white/5 border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Barber picker */}
        <div className="glass-panel p-6 rounded-2xl">
          <div className="flex items-center gap-2 mb-4">
            <Scissors className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-semibold">Pilih Kapster</h2>
          </div>
          {barberAutoCleared && (
            <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-3">
              Kapster yang kamu pilih ternyata bentrok jadwal di jam ini — dipindah ke &ldquo;Tanpa preferensi&rdquo;.
            </p>
          )}
          {barbers.length === 0 ? (
            <p className="text-gray-400 text-sm">
              Belum ada kapster terdaftar di cabang ini — booking tetap bisa dibuat, kapster akan ditentukan oleh cabang.
            </p>
          ) : (
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] bg-white/5 cursor-pointer hover:border-primary transition-colors">
                <input
                  type="radio"
                  name="barber"
                  className="w-4 h-4 accent-primary"
                  checked={selectedBarberId === null}
                  onChange={() => {
                    setSelectedBarberId(null);
                    setBarberAutoCleared(false);
                  }}
                />
                <span className="text-sm font-medium">Tanpa preferensi (kapster manapun yang free)</span>
              </label>
              {barbers.map((barber) => {
                const status = barberDisplayStatus(barber);
                const conflicted = conflictingBarberIds.has(barber.id);
                return (
                  <label
                    key={barber.id}
                    className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${
                      conflicted
                        ? 'border-[var(--border)] bg-white/[0.02] opacity-50 cursor-not-allowed'
                        : 'border-[var(--border)] bg-white/5 cursor-pointer hover:border-primary'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="barber"
                        className="w-4 h-4 accent-primary"
                        checked={selectedBarberId === barber.id}
                        disabled={conflicted}
                        onChange={() => {
                          setSelectedBarberId(barber.id);
                          setBarberAutoCleared(false);
                        }}
                      />
                      <span className="text-sm font-medium">{barber.full_name ?? 'Kapster'}</span>
                    </div>
                    {conflicted ? (
                      <span className="flex items-center gap-1.5 text-xs text-red-400">
                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                        Bentrok Jadwal
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-gray-400">
                        <span className={`w-2 h-2 rounded-full ${statusDot[status]}`}></span>
                        {statusLabel[status]}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar / Live Kapster Status */}
      <div className="space-y-6">
        <div className="glass-panel p-6 rounded-2xl">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5" /> Live Kapster Status
          </h3>
          {barbers.length === 0 ? (
            <p className="text-gray-400 text-sm">Belum ada kapster terdaftar di cabang ini.</p>
          ) : (
            <div className="space-y-3">
              {barbers.map((barber) => {
                const status = barberDisplayStatus(barber);
                return (
                  <div key={barber.id} className="flex justify-between items-center text-sm">
                    <span>{barber.full_name ?? 'Kapster'}</span>
                    <span className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${statusDot[status]}`}></span>
                      {statusLabel[status]}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="glass-panel p-6 rounded-2xl">
          {success ? (
            <div className="text-center py-2">
              {bookingOutcome === 'rejected' ? (
                <>
                  <XCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
                  <h3 className="font-bold text-lg mb-2">Kapster Sudah Penuh</h3>
                  <p className="text-sm text-gray-400 mb-6">
                    Maaf, {barbers.find((b) => b.id === selectedBarberId)?.full_name ?? 'kapster pilihanmu'} baru
                    saja penuh di jam yang kamu pilih (ada yang booking bareng). Booking ini otomatis dibatalkan —
                    silakan pilih kapster lain atau jam yang berbeda.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSuccess(false);
                      setSelectedBarberId(null);
                    }}
                    className="inline-flex items-center justify-center w-full bg-primary hover:bg-amber-700 text-white font-bold py-3 rounded-xl transition-colors"
                  >
                    Coba Jadwal Lain
                  </button>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-10 w-10 text-primary mx-auto mb-3" />
                  <h3 className="font-bold text-lg mb-2">
                    {bookingOutcome === 'approved' ? 'Booking Dikonfirmasi!' : 'Booking Dibuat'}
                  </h3>
                  <p className="text-sm text-gray-400 mb-6">
                    {bookingOutcome === 'approved'
                      ? 'Booking kamu langsung dikonfirmasi — sampai jumpa di jadwalmu!'
                      : 'Booking kamu berhasil dibuat dan menunggu konfirmasi cabang.'}
                  </p>
                  <Link
                    href="/my-bookings"
                    className="inline-flex items-center justify-center w-full bg-primary hover:bg-amber-700 text-white font-bold py-3 rounded-xl transition-colors"
                  >
                    Lihat Booking Saya
                  </Link>
                </>
              )}
            </div>
          ) : (
            <>
              <h3 className="font-bold text-lg mb-4">Order Summary</h3>
              <div className="flex justify-between mb-2 text-sm text-gray-400">
                <span>Service</span>
                <span>{formatRupiah(serviceTotal)}</span>
              </div>
              <div className="flex justify-between mb-2 text-sm text-gray-400">
                <span>Add-ons</span>
                <span>{formatRupiah(addonsTotal)}</span>
              </div>
              <div className="flex justify-between mb-4 text-sm text-gray-400">
                <span>Jadwal</span>
                <span className="text-right">
                  {date && time
                    ? `${new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}, ${time}`
                    : '-'}
                </span>
              </div>
              <div className="border-t border-[var(--border)] pt-4 flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-primary">{formatRupiah(total)}</span>
              </div>

              {error && (
                <p className="mt-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
                  {error}
                </p>
              )}

              <button
                onClick={handleConfirm}
                disabled={submitting || !selectedService || !date || !time}
                className="w-full mt-6 bg-primary hover:bg-amber-700 text-white font-bold py-3 rounded-xl transition-transform active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                {submitting ? 'Processing...' : 'Confirm Booking'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
