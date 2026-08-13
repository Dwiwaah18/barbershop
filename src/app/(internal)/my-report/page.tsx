import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/supabase/current-profile';
import { getMyStaffBranches } from '@/lib/supabase/staff-branches';
import type { Branch } from '@/lib/supabase/types';
import MyReportClient from './my-report-client';

export default async function MyReportPage() {
  const current = await getCurrentProfile();

  if (!current) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Laporan Saya</h1>
        <div className="glass-panel p-6 rounded-2xl text-gray-400">
          Anda harus login untuk mengakses halaman ini.
        </div>
      </div>
    );
  }

  const staffBranches = await getMyStaffBranches();
  let branches: Branch[] = [];
  if (staffBranches.length > 0) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('branches')
      .select('*')
      .in('id', staffBranches.map((b) => b.id))
      .order('name', { ascending: true });
    branches = (data as Branch[] | null) ?? [];
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Laporan Saya</h1>
      <p className="text-gray-400 mb-8">
        Rincian transaksi/layanan yang sudah kamu selesaikan — cari berdasarkan rentang tanggal.
      </p>
      {branches.length === 0 ? (
        <div className="glass-panel p-6 rounded-2xl text-gray-400">
          Akun ini belum terhubung ke cabang manapun. Hubungi owner untuk mengatur cabang Anda.
        </div>
      ) : (
        <MyReportClient branches={branches} userId={current.userId} />
      )}
    </div>
  );
}
