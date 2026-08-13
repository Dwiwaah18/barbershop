'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, X, Search, UserCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { ServiceOption } from './page';

const formatRupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

type CustomerMatch = { id: string; full_name: string | null; phone: string | null };

export default function WalkinCheckin({
  branchId,
  services,
}: {
  branchId: string;
  services: ServiceOption[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pelanggan terpilih dari database (customer_id ter-link) vs. walk-in murni (customer_id null,
  // hanya nama). Pencarian otomatis ter-scope ke tenant ini lewat RLS "Staff search customer profiles".
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerMatch | null>(null);
  const [matches, setMatches] = useState<CustomerMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openModal = () => {
    // Reset serviceId ke layanan cabang SAAT INI — kalau tidak, setelah ganti cabang serviceId
    // masih menyimpan id layanan cabang lama yang tidak ada di daftar sekarang → validasi gagal.
    setServiceId(services[0]?.id ?? '');
    setName('');
    setSelectedCustomer(null);
    setMatches([]);
    setError(null);
    setShowModal(true);
  };

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    const q = name.trim();
    if (selectedCustomer || q.length < 2) {
      setMatches([]);
      return;
    }
    searchDebounce.current = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .eq('role', 'customer')
        .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(6);
      setMatches((data as CustomerMatch[] | null) ?? []);
      setSearching(false);
    }, 300);
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, [name, selectedCustomer, supabase]);

  const handleSubmit = async () => {
    setError(null);
    const trimmedName = selectedCustomer?.full_name?.trim() || name.trim();
    const service = services.find((s) => s.id === serviceId);
    if (!trimmedName) {
      setError('Nama pelanggan wajib diisi.');
      return;
    }
    if (!service) {
      setError('Pilih layanan terlebih dahulu.');
      return;
    }

    setSubmitting(true);
    const { data: inserted, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        branch_id: branchId,
        customer_id: selectedCustomer?.id ?? null,
        customer_name: trimmedName,
        status: 'pending',
        source: 'walkin',
        scheduled_at: new Date().toISOString(),
        total_price: service.price,
      })
      .select('id')
      .single();

    if (bookingError || !inserted) {
      setSubmitting(false);
      setError('Gagal membuat booking walk-in.');
      return;
    }

    const { error: itemError } = await supabase.from('booking_items').insert({
      booking_id: inserted.id,
      service_id: service.id,
      service_name: service.name,
      price: service.price,
    });

    setSubmitting(false);

    if (itemError) {
      setError('Booking dibuat, tapi gagal menyimpan detail layanan.');
      router.refresh();
      return;
    }

    setShowModal(false);
    router.refresh();
  };

  return (
    <>
      <button
        onClick={openModal}
        className="bg-primary hover:bg-amber-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors"
      >
        <UserPlus className="h-5 w-5" /> Walk-in Check-in
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="glass-panel rounded-2xl p-6 w-full max-w-md relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-xl font-semibold mb-4">Walk-in Check-in</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Nama Pelanggan</label>
                {selectedCustomer ? (
                  <div className="flex items-center justify-between gap-2 bg-white/5 border border-primary/40 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <UserCheck className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{selectedCustomer.full_name ?? 'Tanpa nama'}</p>
                        <p className="text-xs text-gray-400">{selectedCustomer.phone ?? 'Tanpa no. HP'} · Pelanggan terdaftar</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(null);
                        setName('');
                      }}
                      aria-label="Ganti pelanggan"
                      className="text-gray-400 hover:text-white shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-white/10 border border-[var(--border)] rounded-lg pl-9 pr-3 py-2 text-sm"
                      placeholder="Cari nama/HP atau ketik nama baru"
                    />
                    {name.trim().length >= 2 && (searching || matches.length > 0) && (
                      <div className="absolute z-10 mt-1 w-full bg-slate-800 border border-[var(--border)] rounded-lg overflow-hidden max-h-44 overflow-y-auto">
                        {searching && <p className="px-3 py-2 text-xs text-gray-500">Mencari...</p>}
                        {!searching &&
                          matches.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setSelectedCustomer(c);
                                setName(c.full_name ?? '');
                                setMatches([]);
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors"
                            >
                              <p className="font-medium">{c.full_name ?? 'Tanpa nama'}</p>
                              <p className="text-xs text-gray-400">{c.phone ?? 'Tanpa no. HP'}</p>
                            </button>
                          ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Pilih dari daftar kalau pelanggan sudah terdaftar, atau ketik nama baru untuk walk-in.
                    </p>
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Layanan</label>
                {services.length === 0 ? (
                  <p className="text-sm text-gray-500">Belum ada layanan terdaftar di cabang ini.</p>
                ) : (
                  <select
                    value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                    className="w-full bg-white/10 border border-[var(--border)] rounded-lg px-3 py-2 text-sm"
                  >
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} - {formatRupiah(s.price)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                onClick={handleSubmit}
                disabled={submitting || services.length === 0}
                className="w-full bg-primary hover:bg-amber-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-colors"
              >
                {submitting ? 'Menyimpan...' : 'Check-in'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
