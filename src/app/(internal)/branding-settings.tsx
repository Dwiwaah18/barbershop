'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Upload, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// Logo dipakai kecil di sidebar, jadi batas lebih ketat dari QRIS.
const MAX_BYTES = 200 * 1024; // 200 KB file asli

export default function BrandingSettings({
    tenantId,
    currentAppName,
    currentLogoUrl,
    fallbackName,
}: {
    tenantId: string;
    currentAppName: string | null;
    currentLogoUrl: string | null;
    fallbackName: string;
}) {
    const router = useRouter();
    const fileRef = useRef<HTMLInputElement>(null);

    const [appName, setAppName] = useState(currentAppName ?? '');
    const [preview, setPreview] = useState<string | null>(currentLogoUrl);
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

    const save = async (nextAppName: string, logoDataUrl: string | null) => {
        setError(null);
        setNotice(null);
        setSaving(true);
        const supabase = createClient();
        const { error: rpcError } = await supabase.rpc('set_tenant_branding', {
            target_tenant_id: tenantId,
            new_app_name: nextAppName,
            logo_data_url: logoDataUrl,
        });
        setSaving(false);
        if (rpcError) {
            setError(`Gagal menyimpan branding: ${rpcError.message}`);
            return;
        }
        setPreview(logoDataUrl);
        setNotice('Branding tersimpan.');
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
            setError('Ukuran logo maksimal 200 KB. Kompres/crop dulu lalu coba lagi.');
            return;
        }
        try {
            const dataUrl = await readAsDataUrl(file);
            await save(appName, dataUrl);
        } catch {
            setError('Gagal memproses gambar.');
        }
    };

    const removeLogo = () => save(appName, null);

    const handleSaveName = () => save(appName, preview);

    return (
        <div className="glass-panel p-6 rounded-2xl mb-8">
            <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Branding Aplikasi</h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">
                Logo dan nama ini tampil di sidebar dashboard untuk semua staff barbershop ini (kasir, kapster, dsb).
            </p>

            <div className="flex flex-col sm:flex-row items-start gap-5">
                <div className="w-24 h-24 rounded-2xl bg-white/5 border border-[var(--border)] flex items-center justify-center overflow-hidden shrink-0">
                    {preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={preview} alt="Logo barbershop" className="w-full h-full object-contain" />
                    ) : (
                        <Sparkles className="h-8 w-8 text-gray-600" />
                    )}
                </div>

                <div className="flex-1 w-full">
                    <label className="block text-xs text-gray-400 mb-1">Nama Aplikasi</label>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                        <input
                            type="text"
                            value={appName}
                            onChange={(e) => setAppName(e.target.value)}
                            placeholder={`Kosongkan untuk pakai nama: ${fallbackName}`}
                            className="flex-1 min-w-[200px] bg-white/5 border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                        />
                        <button
                            type="button"
                            onClick={handleSaveName}
                            disabled={saving}
                            className="bg-primary hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
                        >
                            Simpan Nama
                        </button>
                    </div>

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
                            {saving ? 'Menyimpan...' : preview ? 'Ganti Logo' : 'Upload Logo'}
                        </button>
                        {preview && (
                            <button
                                type="button"
                                onClick={removeLogo}
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