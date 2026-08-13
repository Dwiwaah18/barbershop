'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QrCode, Upload, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// Batas ukuran gambar QRIS: disimpan sebagai data URL base64 di kolom TEXT, jadi jaga tetap kecil.
const MAX_BYTES = 800 * 1024; // 800 KB file asli

export default function QrisSettings({
  tenantId,
  currentImageUrl,
}: {
  tenantId: string;
  currentImageUrl: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(currentImageUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const readAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('gagal membaca file'));
      reader.readAsDataURL(file);
    });

  const save = async (dataUrl: string | null) => {
    setError(null);
    setNotice(null);
    setSaving(true);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc('set_tenant_qris_image', {
      target_tenant_id: tenantId,
      image_data_url: dataUrl,
    });
    setSaving(false);
    if (rpcError) {
      setError(`Gagal menyimpan QRIS: ${rpcError.message}`);
      return;
    }
    setPreview(dataUrl);
    setNotice(dataUrl ? 'Gambar QRIS tersimpan.' : 'Gambar QRIS dihapus.');
    router.refresh();
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setNotice(null);
    if (!file.type.startsWith('image/')) {
      setError('File harus berupa gambar (PNG/JPG).');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Ukuran gambar maksimal 800 KB. Potong/crop QR-nya lalu coba lagi.');
      return;
    }
    try {
      const dataUrl = await readAsDataUrl(file);
      await save(dataUrl);
    } catch {
      setError('Gagal memproses gambar.');
    }
  };

  return (
    <div className="glass-panel p-6 rounded-2xl mb-8">
      <div className="flex items-center gap-2 mb-1">
        <QrCode className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Gambar QRIS Barbershop</h2>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        QRIS ini dipakai pelanggan untuk top-up saldo (share wallet) dan pembayaran QRIS di kasir.
        Upload gambar QR statis dari penyedia QRIS Anda (maks. 800 KB).
      </p>

      <div className="flex flex-col sm:flex-row items-start gap-5">
        <div className="w-40 h-40 rounded-2xl bg-white/5 border border-[var(--border)] flex items-center justify-center overflow-hidden shrink-0">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="QRIS barbershop" className="w-full h-full object-contain" />
          ) : (
            <QrCode className="h-12 w-12 text-gray-600" />
          )}
        </div>

        <div className="flex-1">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 bg-primary hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Upload className="h-4 w-4" />
              {saving ? 'Menyimpan...' : preview ? 'Ganti Gambar' : 'Upload QRIS'}
            </button>
            {preview && (
              <button
                type="button"
                onClick={() => save(null)}
                disabled={saving}
                className="inline-flex items-center gap-1.5 border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-50 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Hapus
              </button>
            )}
          </div>
          {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
          {notice && <p className="text-xs text-green-400 mt-3">{notice}</p>}
        </div>
      </div>
    </div>
  );
}
