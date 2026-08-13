'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, ShieldCheck, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { uploadUserFile } from '@/lib/supabase/storage-client';

const PRESET_AMOUNTS = [50000, 100000, 250000, 500000];
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MIN_CUSTOM_AMOUNT = 10000;

const formatRupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

export default function DepositForm({ userId }: { userId: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [isCustomAmount, setIsCustomAmount] = useState(false);
  const [customAmountInput, setCustomAmountInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedAmount, setSubmittedAmount] = useState<number | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setError(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('File harus berupa gambar (JPG, PNG, dll).');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('Ukuran file maksimal 5MB.');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setSelectedFile(file);
  };

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, ''); // hanya izinkan angka
    setCustomAmountInput(raw);
    setError(null);
    const num = Number(raw);
    setSelectedAmount(num > 0 ? num : null);
  };

  const handleSubmit = async () => {
    if (!selectedAmount) {
      setError('Pilih nominal top-up terlebih dahulu.');
      return;
    }
    if (isCustomAmount && selectedAmount < MIN_CUSTOM_AMOUNT) {
      setError(`Nominal minimal ${formatRupiah(MIN_CUSTOM_AMOUNT)}.`);
      return;
    }
    setError(null);
    setSubmitting(true);

    let proofUrl: string | null = null;
    if (selectedFile) {
      try {
        proofUrl = await uploadUserFile(userId, 'deposit-proofs', selectedFile);
      } catch (err) {
        setSubmitting(false);
        const detail = err instanceof Error ? err.message : String(err);
        setError(`Gagal mengunggah bukti pembayaran: ${detail}`);
        return;
      }
    }

    const supabase = createClient();
    const { error: insertError } = await supabase.from('wallet_transactions').insert({
      profile_id: userId,
      type: 'topup',
      amount: selectedAmount,
      status: 'pending',
      proof_url: proofUrl,
    });

    setSubmitting(false);

    if (insertError) {
      setError('Gagal mengirim bukti pembayaran. Coba lagi.');
      return;
    }

    setSubmittedAmount(selectedAmount);
    router.refresh();
  };

  if (submittedAmount !== null) {
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-6">
          <CheckCircle2 className="h-8 w-8 text-green-400" />
        </div>
        <h3 className="text-2xl font-bold mb-2">
          Top-up {formatRupiah(submittedAmount)} sedang diverifikasi kasir
        </h3>
        <p className="text-gray-400 mb-8">Biasanya kurang dari 5 menit pada jam operasional.</p>
        <Link
          href="/profile"
          className="inline-flex justify-center items-center px-6 py-3 bg-primary hover:bg-amber-600 rounded-xl font-bold transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-amber-900/30"
        >
          Kembali ke Profil
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white/5 border border-[var(--border)] rounded-2xl p-6 mb-8 text-center">
        <h3 className="font-medium mb-4">Choose Amount</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PRESET_AMOUNTS.map(amount => (
            <button
              key={amount}
              type="button"
              onClick={() => {
                setIsCustomAmount(false);
                setCustomAmountInput('');
                setSelectedAmount(amount);
                setError(null);
              }}
              className={`py-2 rounded-xl border transition-colors ${!isCustomAmount && selectedAmount === amount
                  ? 'border-primary bg-primary/10'
                  : 'border-[var(--border)] hover:border-primary hover:bg-primary/10'
                }`}
            >
              {formatRupiah(amount)}
            </button>
          ))}

          <button
            type="button"
            onClick={() => {
              setIsCustomAmount(true);
              setSelectedAmount(null);
              setError(null);
            }}
            className={`py-2 rounded-xl border transition-colors ${isCustomAmount
                ? 'border-primary bg-primary/10'
                : 'border-[var(--border)] hover:border-primary hover:bg-primary/10'
              }`}
          >
            Lainnya
          </button>
        </div>

        {isCustomAmount && (
          <div className="mt-4">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">Rp</span>
              <input
                type="text"
                inputMode="numeric"
                value={customAmountInput ? Number(customAmountInput).toLocaleString('id-ID') : ''}
                onChange={handleCustomAmountChange}
                placeholder="Masukkan nominal"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-transparent border border-[var(--border)] focus:border-primary outline-none text-center"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">Minimal {formatRupiah(MIN_CUSTOM_AMOUNT)}</p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="font-medium">Upload Payment Proof</h3>
        <label className="border-2 border-dashed border-[var(--border)] hover:border-primary transition-colors rounded-2xl p-10 text-center cursor-pointer flex flex-col items-center justify-center group">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="bg-primary/20 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
            <UploadCloud className="h-8 w-8 text-primary" />
          </div>
          <p className="font-medium mb-1">
            {selectedFile ? selectedFile.name : 'Click to upload screenshot'}
          </p>
          <p className="text-sm text-gray-400">JPG, PNG up to 5MB</p>
        </label>
        <p className="text-xs text-gray-500 text-center">Bukti pembayaran bersifat opsional, tapi mempercepat verifikasi.</p>

        <div className="flex items-start gap-3 text-sm text-amber-200/70 bg-amber-900/20 p-4 rounded-xl mt-6">
          <ShieldCheck className="h-5 w-5 shrink-0" />
          <p>Your top-up will be manually verified by our cashier before it appears in your Shared Wallet. Usually takes &lt; 5 minutes during operational hours.</p>
        </div>

        {error && <p className="text-sm text-red-400 text-center">{error}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !selectedAmount}
          className="w-full mt-4 bg-primary hover:bg-amber-700 text-white font-bold py-4 rounded-xl transition-transform active:scale-95 shadow-lg shadow-amber-900/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          {submitting ? 'Submitting...' : 'Submit Payment Proof'}
        </button>
      </div>
    </>
  );
}