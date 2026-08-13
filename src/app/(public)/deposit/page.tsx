import { redirect } from 'next/navigation';
import { QrCode } from 'lucide-react';
import { getCurrentProfile } from '@/lib/supabase/current-profile';
import { createClient } from '@/lib/supabase/server';
import DepositForm from './deposit-form';

export default async function DepositPage() {
  const current = await getCurrentProfile();
  if (!current) redirect('/auth');

  // Ambil QRIS milik barbershop pelanggan ini (kalau owner-nya sudah upload). Kalau belum ada
  // (pelanggan belum ke-klaim tenant atau QRIS belum di-set), tampilkan placeholder.
  let qrisImageUrl: string | null = null;
  let barbershopName = 'Barbershop';
  if (current.profile.tenant_id) {
    const supabase = await createClient();
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, qris_image_url')
      .eq('id', current.profile.tenant_id)
      .single();
    qrisImageUrl = (tenant as { qris_image_url: string | null } | null)?.qris_image_url ?? null;
    barbershopName = (tenant as { name: string } | null)?.name ?? barbershopName;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
      <h1 className="text-4xl font-bold mb-8 text-center">Top Up Deposit</h1>

      <div className="glass-panel p-8 rounded-3xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-48 h-48 bg-white p-4 rounded-2xl mb-6 shadow-2xl">
            {qrisImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrisImageUrl} alt="QRIS pembayaran" className="w-full h-full object-contain" />
            ) : (
              <QrCode className="w-full h-full text-slate-800" />
            )}
          </div>
          <h2 className="text-2xl font-bold mb-2">Scan to Pay (QRIS)</h2>
          <p className="text-gray-400">{barbershopName}</p>
          {!qrisImageUrl && (
            <p className="text-xs text-amber-400 mt-2">
              QRIS belum diatur barbershop ini. Setelah transfer, ajukan top-up di bawah &amp; tunjukkan bukti ke kasir.
            </p>
          )}
        </div>

        <DepositForm userId={current.userId} />
      </div>
    </div>
  );
}
