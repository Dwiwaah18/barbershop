import { getCurrentProfile } from '@/lib/supabase/current-profile';
import FamiliesClient from './families-client';

export default async function FamiliesPage() {
  const current = await getCurrentProfile();
  const role = current?.profile.role ?? '';

  if (!current || !['cashier', 'owner', 'superadmin'].includes(role)) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Kelola Keluarga</h1>
        <div className="glass-panel p-6 rounded-2xl text-gray-400">Halaman ini khusus kasir & owner.</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Kelola Keluarga (Shared Wallet)</h1>
      <p className="text-gray-400 mb-8">
        Gabungkan akun pelanggan jadi satu keluarga — saldo mereka menyatu jadi satu dompet yang bisa dipakai
        di semua cabang barbershop ini.
      </p>
      <FamiliesClient />
    </div>
  );
}
