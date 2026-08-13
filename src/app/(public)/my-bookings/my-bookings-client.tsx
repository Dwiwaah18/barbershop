'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, History, MapPin, Scissors } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { BookingWithDetails } from './page';

const formatRupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
const RESCHEDULE_CUTOFF_MS = 2 * 60 * 60 * 1000;

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function toDateInput(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toTimeInput(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function serviceNames(booking: BookingWithDetails): string {
  const names = booking.booking_items.map((bi) => bi.service_name);
  return names.length > 0 ? names.join(', ') : 'Layanan tidak diketahui';
}

const statusLabel: Record<BookingWithDetails['status'], string> = {
  pending: 'Menunggu Konfirmasi',
  approved: 'Dikonfirmasi',
  confirmed: 'Sedang Dikerjakan',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

const statusClass: Record<BookingWithDetails['status'], string> = {
  pending: 'bg-amber-500/20 text-amber-400',
  approved: 'bg-teal-500/20 text-teal-400',
  confirmed: 'bg-blue-500/20 text-blue-400',
  completed: 'bg-green-500/20 text-green-400',
  cancelled: 'bg-red-500/20 text-red-400',
};

const MANAGEABLE_STATUSES: BookingWithDetails['status'][] = ['pending', 'approved'];

function BookingCard({
  booking,
  canManage,
  actionSlot,
}: {
  booking: BookingWithDetails;
  canManage: boolean;
  actionSlot?: React.ReactNode;
}) {
  return (
    <div className="p-5 rounded-xl border border-[var(--border)] bg-white/5">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <p className="font-semibold flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-primary" />
            {booking.branches?.name ?? 'Cabang'}
          </p>
          <p className="text-sm text-gray-400 mt-1 flex items-center gap-1.5">
            <Scissors className="h-3.5 w-3.5" />
            {serviceNames(booking)}
          </p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${statusClass[booking.status]}`}>
          {statusLabel[booking.status]}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-gray-400 flex items-center gap-1.5">
          <CalendarClock className="h-4 w-4" />
          {formatDateTime(booking.scheduled_at)}
        </span>
        <span className="font-bold text-primary">{formatRupiah(booking.total_price)}</span>
      </div>
      {canManage && (
        <p className="text-xs text-gray-500 mt-2">
          {booking.status === 'approved'
            ? 'Kamu siap dilayani sesuai jadwal di atas — mohon jangan terlambat ya!'
            : 'Sedang diproses cabang — mohon tetap datang tepat waktu sesuai jadwal di atas.'}
        </p>
      )}
      {canManage && actionSlot}
    </div>
  );
}

export default function MyBookingsClient({
  upcoming,
  history,
}: {
  upcoming: BookingWithDetails[];
  history: BookingWithDetails[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<Record<string, string>>({});
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const startReschedule = (booking: BookingWithDetails) => {
    const current = new Date(booking.scheduled_at);
    setNewDate(toDateInput(current));
    setNewTime(toTimeInput(current));
    setReschedulingId(booking.id);
    setErrorId((prev) => ({ ...prev, [booking.id]: '' }));
  };

  const handleCancel = async (bookingId: string) => {
    setBusyId(bookingId);
    setErrorId((prev) => ({ ...prev, [bookingId]: '' }));
    const supabase = createClient();
    const { error } = await supabase.rpc('customer_cancel_booking', { target_booking_id: bookingId });
    setBusyId(null);
    if (error) {
      setErrorId((prev) => ({ ...prev, [bookingId]: `Gagal membatalkan booking: ${error.message}` }));
      return;
    }
    router.refresh();
  };

  const handleSaveReschedule = async (bookingId: string) => {
    if (!newDate || !newTime) {
      setErrorId((prev) => ({ ...prev, [bookingId]: 'Pilih tanggal dan jam baru.' }));
      return;
    }
    const newScheduledAt = new Date(`${newDate}T${newTime}:00`);
    if (Number.isNaN(newScheduledAt.getTime()) || newScheduledAt.getTime() <= new Date().getTime()) {
      setErrorId((prev) => ({ ...prev, [bookingId]: 'Jadwal baru harus di waktu yang akan datang.' }));
      return;
    }

    setBusyId(bookingId);
    setErrorId((prev) => ({ ...prev, [bookingId]: '' }));
    const supabase = createClient();
    const { error } = await supabase.rpc('customer_reschedule_booking', {
      target_booking_id: bookingId,
      new_scheduled_at: newScheduledAt.toISOString(),
    });
    if (error) {
      setBusyId(null);
      setErrorId((prev) => ({
        ...prev,
        [bookingId]: `Gagal mengubah jadwal: ${error.message}`,
      }));
      return;
    }
    // Reschedule resets the booking to 'pending' (the old approval was only valid for the old
    // time) — try to auto-confirm the new slot right away instead of leaving it pending. On a
    // conflict it gets auto-cancelled, so surface that clearly (the card is about to disappear
    // from this list once we refresh, so a per-card error won't be visible — use a page notice).
    const { data: finalStatus } = await supabase.rpc('customer_try_auto_confirm_booking', { target_booking_id: bookingId });
    if (finalStatus === 'cancelled') {
      setNotice('Jadwal baru bentrok dengan kapster pilihanmu — booking otomatis dibatalkan. Silakan booking ulang dengan kapster atau jam yang berbeda.');
    }
    setBusyId(null);
    setReschedulingId(null);
    router.refresh();
  };

  return (
    <div className="space-y-8">
      {notice && (
        <div className="flex items-start justify-between gap-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-2xl px-4 py-3">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 hover:text-red-300">
            ✕
          </button>
        </div>
      )}

      <div className="glass-panel p-6 sm:p-8 rounded-3xl">
        <div className="flex items-center gap-3 mb-6">
          <CalendarClock className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">Booking Mendatang</h2>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-400">Belum ada booking mendatang.</p>
        ) : (
          <div className="space-y-4">
            {upcoming.map((booking) => {
              const canReschedule =
                MANAGEABLE_STATUSES.includes(booking.status) &&
                new Date(booking.scheduled_at).getTime() - new Date().getTime() > RESCHEDULE_CUTOFF_MS;
              const isBusy = busyId === booking.id;
              const isRescheduling = reschedulingId === booking.id;

              return (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  canManage={MANAGEABLE_STATUSES.includes(booking.status)}
                  actionSlot={
                    <div className="mt-4 pt-4 border-t border-[var(--border)]">
                      {isRescheduling ? (
                        <div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">Tanggal Baru</label>
                              <input
                                type="date"
                                value={newDate}
                                min={toDateInput(new Date())}
                                onChange={(e) => setNewDate(e.target.value)}
                                className="w-full bg-white/5 border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">Jam Baru</label>
                              <input
                                type="time"
                                value={newTime}
                                onChange={(e) => setNewTime(e.target.value)}
                                className="w-full bg-white/5 border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveReschedule(booking.id)}
                              disabled={isBusy}
                              className="flex-1 bg-primary hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                            >
                              {isBusy ? 'Menyimpan...' : 'Simpan Jadwal Baru'}
                            </button>
                            <button
                              onClick={() => setReschedulingId(null)}
                              disabled={isBusy}
                              className="px-4 bg-white/10 hover:bg-white/20 text-sm font-medium py-2 rounded-lg transition-colors"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {canReschedule ? (
                            <button
                              onClick={() => startReschedule(booking)}
                              disabled={isBusy}
                              className="flex-1 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-sm font-medium py-2 rounded-lg transition-colors"
                            >
                              Ubah Jadwal
                            </button>
                          ) : (
                            <p className="flex-1 text-xs text-gray-500 self-center">
                              Sudah lewat batas waktu ubah jadwal (min. 2 jam sebelum jadwal).
                            </p>
                          )}
                          <button
                            onClick={() => handleCancel(booking.id)}
                            disabled={isBusy}
                            className="px-4 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 text-red-400 text-sm font-medium py-2 rounded-lg transition-colors"
                          >
                            {isBusy ? 'Membatalkan...' : 'Batalkan'}
                          </button>
                        </div>
                      )}
                      {errorId[booking.id] && <p className="text-xs text-red-400 mt-2">{errorId[booking.id]}</p>}
                    </div>
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="glass-panel p-6 sm:p-8 rounded-3xl">
        <div className="flex items-center gap-3 mb-6">
          <History className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">Riwayat Booking</h2>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-gray-400">Belum ada riwayat booking.</p>
        ) : (
          <div className="space-y-4">
            {history.map((booking) => (
              <BookingCard key={booking.id} booking={booking} canManage={false} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
