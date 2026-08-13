'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, CheckCircle, CalendarClock, AlarmClock, TimerReset } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { BookingWithItems, InProgressBooking, UpcomingBooking, BarberOption } from './page';

const WARNING_THRESHOLD_MS = 5 * 60 * 1000; // alert kapster saat sisa waktu ≤ 5 menit

// Sisa waktu cukur = (started_at + total durasi) - sekarang. Negatif berarti sudah lewat batas.
function remainingMs(startedAt: string | null, durationMinutes: number, now: number): number | null {
  if (!startedAt) return null;
  const end = new Date(startedAt).getTime() + durationMinutes * 60000;
  return end - now;
}

function formatCountdown(ms: number): string {
  const over = ms < 0;
  const total = Math.floor(Math.abs(ms) / 1000);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  const body = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  return over ? `+${body} lewat` : body;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMin < 1) return 'Baru saja';
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  return `${Math.floor(diffHour / 24)} hari lalu`;
}

function formatClock(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  });
}

function formatUpcomingDateTime(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function serviceNames(booking: BookingWithItems): string {
  const names = booking.booking_items.map((bi) => bi.service_name);
  return names.length > 0 ? names.join(', ') : 'Layanan tidak diketahui';
}

export default function QueueBoard({
  waiting,
  upcoming,
  inProgress,
  completed,
  completedCount,
  barbers,
}: {
  waiting: BookingWithItems[];
  upcoming: UpcomingBooking[];
  inProgress: InProgressBooking[];
  completed: BookingWithItems[];
  completedCount: number;
  barbers: BarberOption[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [selectedBarber, setSelectedBarber] = useState<Record<string, string>>({});
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);

  // Detak per-detik untuk hitung mundur In Progress (tanpa ini countdown tidak jalan real-time).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Minta izin notifikasi browser sekali (best-effort — kalau ditolak, alert visual tetap jalan).
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Booking yang sudah pernah dinotifikasi "5 menit lagi" — supaya notifikasi hanya sekali per booking.
  const notifiedIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const booking of inProgress) {
      const rem = remainingMs(booking.started_at, booking.total_duration_minutes, now);
      if (rem === null) continue;
      if (rem > 0 && rem <= WARNING_THRESHOLD_MS && !notifiedIds.current.has(booking.id)) {
        notifiedIds.current.add(booking.id);
        const who = booking.customer_name ?? 'Pelanggan';
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('Waktu cukur hampir habis', {
            body: `${who} — sisa waktu ${formatCountdown(rem)}. Segera selesaikan.`,
          });
        }
      }
      // Reset penanda kalau booking di-reset ke waktu baru (sisa > 5 menit lagi).
      if (rem > WARNING_THRESHOLD_MS && notifiedIds.current.has(booking.id)) {
        notifiedIds.current.delete(booking.id);
      }
    }
  }, [inProgress, now]);

  const setPending = (id: string, on: boolean) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleAssign = async (bookingId: string) => {
    const barberId = selectedBarber[bookingId] ?? barbers[0]?.id;
    if (!barberId) return;
    setPending(bookingId, true);
    setRowError((prev) => ({ ...prev, [bookingId]: '' }));
    const { error } = await supabase
      .from('bookings')
      .update({ barber_id: barberId, status: 'confirmed', started_at: new Date().toISOString() })
      .eq('id', bookingId);
    setPending(bookingId, false);
    if (error) {
      setRowError((prev) => ({ ...prev, [bookingId]: 'Gagal menetapkan barber.' }));
      return;
    }
    router.refresh();
  };

  const handleComplete = async (bookingId: string, customerName: string | null) => {
    setPending(bookingId, true);
    setRowError((prev) => ({ ...prev, [bookingId]: '' }));
    // Mark Complete now also settles payment in the same action — the RPC auto-redeems Share
    // Wallet if the customer has enough balance, otherwise it records the sale as cash (covers
    // walk-ins with no account too) and creates the matching POS transaction either way.
    const { data: paymentMethod, error } = await supabase.rpc('complete_booking_with_payment', {
      target_booking_id: bookingId,
    });
    setPending(bookingId, false);
    if (error) {
      setRowError((prev) => ({ ...prev, [bookingId]: `Gagal menyelesaikan booking: ${error.message}` }));
      return;
    }
    const name = customerName ?? 'Pelanggan';
    setPaymentNotice(
      paymentMethod === 'deposit'
        ? `${name} selesai dilayani — pembayaran otomatis dipotong dari Share Wallet.`
        : `${name} selesai dilayani — dicatat sebagai pembayaran Cash di Point of Sales (Share Wallet tidak tersedia atau saldo tidak cukup).`
    );
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {paymentNotice && (
        <div className="flex items-start justify-between gap-3 bg-green-500/10 border border-green-500/30 text-green-400 text-sm rounded-2xl px-4 py-3">
          <span>{paymentNotice}</span>
          <button type="button" onClick={() => setPaymentNotice(null)} className="shrink-0 hover:text-green-300">
            ✕
          </button>
        </div>
      )}

      {/* Upcoming — pending bookings scheduled for later, not "waiting" yet but staff should
          still be aware of them. Read-only: assigning/starting a barber only makes sense once
          the booking's time actually arrives and it moves into Waiting. */}
      <div className="glass-panel p-6 rounded-2xl">
        <div className="flex items-center gap-2 mb-4 border-b border-[var(--border)] pb-4">
          <CalendarClock className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Booking Mendatang ({upcoming.length})</h2>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-400">Belum ada booking untuk jadwal mendatang.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 bg-white/5">
                  <th className="px-4 py-2.5 font-medium">Jadwal</th>
                  <th className="px-4 py-2.5 font-medium">Pelanggan</th>
                  <th className="px-4 py-2.5 font-medium">Layanan</th>
                  <th className="px-4 py-2.5 font-medium">Kapster Pilihan</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((booking) => (
                  <tr key={booking.id} className="border-t border-[var(--border)]">
                    <td className="px-4 py-2.5 whitespace-nowrap text-gray-300">{formatUpcomingDateTime(booking.scheduled_at)}</td>
                    <td className="px-4 py-2.5 font-medium">{booking.customer_name ?? 'Pelanggan'}</td>
                    <td className="px-4 py-2.5 text-gray-400">{serviceNames(booking)}</td>
                    <td className="px-4 py-2.5 text-gray-400">{booking.barber?.full_name ?? 'Tanpa preferensi'}</td>
                    <td className="px-4 py-2.5">
                      {booking.status === 'approved' ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-400">Dikonfirmasi</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">Menunggu Konfirmasi</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Waiting */}
      <div className="glass-panel p-6 rounded-2xl">
        <div className="flex items-center gap-2 mb-4 border-b border-[var(--border)] pb-4">
          <div className="w-3 h-3 rounded-full bg-amber-500"></div>
          <h2 className="text-xl font-semibold">Waiting ({waiting.length})</h2>
        </div>
        <div className="space-y-3">
          {waiting.length === 0 && (
            <p className="text-sm text-gray-400">Belum ada antrian menunggu.</p>
          )}
          {waiting.map((booking) => (
            <div key={booking.id} className="p-4 bg-white/5 border border-[var(--border)] rounded-xl">
              <div className="flex justify-between mb-2">
                <span className="font-bold">{booking.customer_name ?? 'Pelanggan'}</span>
                <span className="text-xs text-gray-400">{timeAgo(booking.created_at)}</span>
              </div>
              <p className="text-sm text-gray-400 mb-3">{serviceNames(booking)}</p>
              {barbers.length === 0 ? (
                <button
                  disabled
                  className="w-full bg-white/5 text-gray-500 py-1.5 rounded-lg text-sm cursor-not-allowed"
                >
                  Belum ada barber di cabang ini
                </button>
              ) : (
                <div className="flex gap-2">
                  <select
                    className="flex-1 bg-white/10 border border-[var(--border)] rounded-lg text-sm px-2 py-1.5"
                    value={selectedBarber[booking.id] ?? barbers[0].id}
                    onChange={(e) =>
                      setSelectedBarber((prev) => ({ ...prev, [booking.id]: e.target.value }))
                    }
                  >
                    {barbers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.full_name ?? 'Tanpa nama'}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleAssign(booking.id)}
                    disabled={pendingIds.has(booking.id)}
                    className="bg-white/10 hover:bg-white/20 disabled:opacity-50 px-3 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap"
                  >
                    Assign
                  </button>
                </div>
              )}
              {rowError[booking.id] && (
                <p className="text-xs text-red-400 mt-2">{rowError[booking.id]}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* In Progress */}
      <div className="glass-panel p-6 rounded-2xl">
        <div className="flex items-center gap-2 mb-4 border-b border-[var(--border)] pb-4">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <h2 className="text-xl font-semibold">In Progress ({inProgress.length})</h2>
        </div>
        <div className="space-y-3">
          {inProgress.length === 0 && (
            <p className="text-sm text-gray-400">Tidak ada yang sedang dikerjakan.</p>
          )}
          {inProgress.map((booking) => {
            const barberName = barbers.find((b) => b.id === booking.barber_id)?.full_name ?? 'Barber';
            const rem = remainingMs(booking.started_at, booking.total_duration_minutes, now);
            const overtime = rem !== null && rem <= 0;
            const warning = rem !== null && rem > 0 && rem <= WARNING_THRESHOLD_MS;
            // Warna kartu ikut status waktu: merah (lewat) → amber (≤5 mnt) → biru (aman).
            const accent = overtime ? 'red' : warning ? 'amber' : 'blue';
            const cardBorder =
              accent === 'red' ? 'border-red-500/50' : accent === 'amber' ? 'border-amber-500/50' : 'border-blue-500/30';
            const barColor =
              accent === 'red' ? 'bg-red-500' : accent === 'amber' ? 'bg-amber-500' : 'bg-blue-500';
            const timeColor =
              accent === 'red' ? 'text-red-400' : accent === 'amber' ? 'text-amber-400' : 'text-blue-400';
            return (
              <div
                key={booking.id}
                className={`p-4 bg-white/5 border ${cardBorder} rounded-xl relative overflow-hidden ${warning ? 'motion-safe:animate-pulse' : ''}`}
              >
                <div className={`absolute top-0 left-0 w-1 h-full ${barColor}`}></div>
                <div className="flex justify-between mb-2">
                  <span className="font-bold">{booking.customer_name ?? 'Pelanggan'}</span>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Mulai {formatClock(booking.started_at)}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mb-3">
                  {serviceNames(booking)} ({barberName})
                </p>

                {rem !== null && (
                  <div
                    className={`flex items-center justify-between mb-3 px-3 py-2 rounded-lg text-sm font-semibold tabular-nums ${
                      accent === 'red'
                        ? 'bg-red-500/15 text-red-300'
                        : accent === 'amber'
                          ? 'bg-amber-500/15 text-amber-300'
                          : 'bg-blue-500/10 text-blue-300'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {overtime ? <AlarmClock className="h-4 w-4" /> : <TimerReset className="h-4 w-4" />}
                      {overtime ? 'Lewat batas' : 'Sisa waktu'}
                    </span>
                    <span className={timeColor}>{formatCountdown(rem)}</span>
                  </div>
                )}
                {warning && (
                  <p className="text-xs text-amber-400 mb-2 flex items-center gap-1">
                    <AlarmClock className="h-3.5 w-3.5" /> 5 menit terakhir — segera selesaikan.
                  </p>
                )}

                <button
                  onClick={() => handleComplete(booking.id, booking.customer_name)}
                  disabled={pendingIds.has(booking.id)}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 py-1.5 rounded-lg text-sm transition-colors text-white"
                >
                  Mark Complete
                </button>
                {rowError[booking.id] && (
                  <p className="text-xs text-red-400 mt-2">{rowError[booking.id]}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Completed */}
      <div className="glass-panel p-6 rounded-2xl">
        <div className="flex items-center gap-2 mb-4 border-b border-[var(--border)] pb-4">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <h2 className="text-xl font-semibold">Completed Today ({completedCount})</h2>
        </div>
        <div className="space-y-3 opacity-70">
          {completed.length === 0 && (
            <p className="text-sm text-gray-400">Belum ada transaksi selesai hari ini.</p>
          )}
          {completed.map((booking) => (
            <div key={booking.id} className="p-4 bg-white/5 border border-green-500/20 rounded-xl">
              <div className="flex justify-between mb-1">
                <span className="font-bold flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" /> {booking.customer_name ?? 'Pelanggan'}
                </span>
                <span className="text-xs text-green-400">{formatClock(booking.completed_at)}</span>
              </div>
              <p className="text-sm text-gray-400">{serviceNames(booking)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
    </div>
  );
}
