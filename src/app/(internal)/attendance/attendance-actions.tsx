'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { uploadUserFile } from '@/lib/supabase/storage-client';

type Props = {
  userId: string;
  branches: { id: string; name: string }[];
  isClockedIn: boolean;
};

function getCurrentPosition(): Promise<{ lat: number | null; lng: number | null; note: string | null }> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve({ lat: null, lng: null, note: 'Lokasi tidak tersedia di perangkat ini.' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({ lat: position.coords.latitude, lng: position.coords.longitude, note: null });
      },
      () => {
        resolve({ lat: null, lng: null, note: 'Izin lokasi ditolak, absen tetap dicatat tanpa lokasi.' });
      },
      { timeout: 8000 }
    );
  });
}

export function AttendanceActions({ userId, branches, isClockedIn }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationNote, setLocationNote] = useState<string | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(branches[0]?.id ?? '');

  function handleSelfieChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSelfieFile(e.target.files?.[0] ?? null);
  }

  async function handleClockIn() {
    const branchId = branches.length === 1 ? branches[0].id : selectedBranchId;

    if (branches.length === 0 || !branchId) {
      setError('Tidak ada cabang yang ditetapkan untuk akun ini.');
      return;
    }

    if (!selfieFile) {
      setError('Foto selfie wajib diambil sebelum clock in.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setLocationNote(null);

    let photoPath: string;
    try {
      photoPath = await uploadUserFile(userId, 'selfies', selfieFile);
    } catch (err) {
      setIsSubmitting(false);
      const detail = err instanceof Error ? err.message : String(err);
      setError(`Gagal mengunggah foto selfie: ${detail}`);
      return;
    }

    const { lat, lng, note } = await getCurrentPosition();
    if (note) setLocationNote(note);

    const supabase = createClient();
    const { error: insertError } = await supabase.from('attendances').insert({
      profile_id: userId,
      branch_id: branchId,
      status: 'clocked_in',
      clock_in_at: new Date().toISOString(),
      clock_in_lat: lat,
      clock_in_lng: lng,
      clock_in_photo_url: photoPath,
    });

    setIsSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setSelfieFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    router.refresh();
  }

  async function handleClockOut() {
    setIsSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('attendances')
      .update({ status: 'clocked_out', clock_out_at: new Date().toISOString() })
      .eq('profile_id', userId)
      .eq('status', 'clocked_in');

    setIsSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.refresh();
  }

  return (
    <>
      <div className="w-full space-y-4">
        {isClockedIn ? (
          <button
            onClick={handleClockOut}
            disabled={isSubmitting}
            className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-4 border border-[var(--border)] rounded-xl transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Memproses...' : 'Clock Out'}
          </button>
        ) : (
          <>
            {branches.length > 1 && (
              <label className="block w-full text-left">
                <span className="block text-xs text-gray-400 mb-1.5">Cabang</span>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="block w-full text-sm text-white bg-white/5 border border-[var(--border)] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id} className="bg-slate-900">
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block w-full">
              <span className="sr-only">Foto selfie</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="user"
                onChange={handleSelfieChange}
                className="block w-full text-sm text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-white/10 file:text-white file:font-medium file:cursor-pointer hover:file:bg-white/20 border border-[var(--border)] rounded-xl bg-white/5"
              />
            </label>
            <p className="text-xs text-gray-500">
              {selfieFile ? `Foto siap: ${selfieFile.name}` : 'Ambil foto selfie untuk clock in (wajib).'}
            </p>
            <button
              onClick={handleClockIn}
              disabled={isSubmitting || !selfieFile}
              className="w-full bg-primary hover:bg-amber-700 text-white font-bold py-4 rounded-xl transition-transform active:scale-95 shadow-lg shadow-amber-900/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Camera className="h-5 w-5" /> {isSubmitting ? 'Memproses...' : 'Clock In'}
            </button>
          </>
        )}
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-400 bg-red-500/10 px-4 py-2 rounded-full">{error}</p>
      )}

      {locationNote && (
        <p className="mt-4 text-sm text-amber-400 bg-amber-500/10 px-4 py-2 rounded-full">{locationNote}</p>
      )}

      {isClockedIn && !error && (
        <div className="mt-6 flex items-center gap-2 text-sm text-green-400 bg-green-500/10 px-4 py-2 rounded-full">
          <MapPin className="h-4 w-4" /> Sedang clock in
        </div>
      )}
    </>
  );
}
