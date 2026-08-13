import { createClient } from '@/lib/supabase/server';
import { getManagedContext } from '@/lib/supabase/managed-branches';
import { ManagedBranchEmpty } from '../managed-branch-empty';
import WalletReportClient from './wallet-report-client';

export type CustomerWalletRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  wallet_balance: number;
};

export default async function WalletReportPage() {
  const { current, managedTenantId, isSuperadmin, needsTenantSelection } = await getManagedContext();

  if (!current) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Laporan Share Wallet</h1>
        <div className="glass-panel p-6 rounded-2xl text-gray-400">
          Anda harus login untuk mengakses halaman ini.
        </div>
      </div>
    );
  }

  if (isSuperadmin && needsTenantSelection) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Laporan Share Wallet</h1>
        <ManagedBranchEmpty needsTenantSelection />
      </div>
    );
  }

  const supabase = await createClient();
  let query = supabase
    .from('profiles')
    .select('id, full_name, phone, wallet_balance')
    .eq('role', 'customer')
    .order('full_name', { ascending: true });
  // Superadmin bisa membaca semua pelanggan lintas tenant lewat RLS — batasi eksplisit ke tenant
  // yang sedang dikelola supaya laporannya tidak mencampur pelanggan barbershop lain.
  if (isSuperadmin && managedTenantId) {
    query = query.eq('tenant_id', managedTenantId);
  }
  const { data } = await query;

  const customers = (data as CustomerWalletRow[] | null) ?? [];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Laporan Share Wallet</h1>
      <p className="text-gray-400 mb-8">
        Pantau total saldo wallet seluruh pelanggan dan cari saldo per pelanggan.
      </p>
      <WalletReportClient customers={customers} />
    </div>
  );
}
