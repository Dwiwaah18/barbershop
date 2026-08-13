import { redirect } from 'next/navigation';
import { QrCode } from 'lucide-react';
import { getCurrentProfile } from '@/lib/supabase/current-profile';
import { createClient } from '@/lib/supabase/server';
import DepositForm from './deposit-form';

export default async function DepositPage() {
  const current = await getCurrentProfile();
  if (!current) redirect('/auth');

  let qrisImageUrl: string | null = null;
  let barbershopName = 'Barbershop';

  const supabase = await createClient();

  // 1. Prioritaskan tenant_id dari profil (untuk Pelanggan).
  let targetTenantId = current.profile.tenant_id;

  // 2. FALLBACK: Jika akun ini adalah Owner/Admin yang sedang ngetest (tenant_id = null),
  // kita ambil tenant pertama dari database agar halaman tetap memiliki QRIS untuk ditampilkan.
  if (!targetTenantId) {
    const { data: firstTenant } = await supabase.from('tenants').select('id').limit(1).single();
    if (firstTenant) {
      targetTenantId = firstTenant.id;
    }
  }

  // 3. Tarik data QRIS dan Nama Barbershop sesuai tenant yang didapat
  if (targetTenantId) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, qris_image_url')
      .eq('id', targetTenantId)
      .single();

    if (tenant) {
      qrisImageUrl = tenant.qris_image_url ?? null;
      barbershopName = tenant.name ?? barbershopName;
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
      <h1 className="text-4xl font-bold mb-8 text-center">Top Up Deposit</h1>

      <div className="glass-panel p-8 rounded-3xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-48 h-48 bg-white p-4 rounded-2xl mb-6 shadow-2xl overflow-hidden">
            {qrisImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrisImageUrl} alt="QRIS pembayaran" className="w-full h-full object-contain" />
            ) : (
              <QrCode className="w-24 h-24 text-slate-800" />
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