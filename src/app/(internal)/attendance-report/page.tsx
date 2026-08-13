import { getManagedContext } from '@/lib/supabase/managed-branches';
import { ManagedBranchEmpty } from '../managed-branch-empty';
import AttendanceReportClient from './attendance-report-client';

export default async function AttendanceReportPage() {
  const { current, branches, needsTenantSelection } = await getManagedContext();

  if (!current) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Laporan Absensi</h1>
        <div className="glass-panel p-6 rounded-2xl text-gray-400">
          Anda harus login untuk mengakses halaman ini.
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Laporan Absensi</h1>
      <p className="text-gray-400 mb-8">
        Pantau riwayat clock in dan clock out staff di seluruh cabang Anda per periode.
      </p>
      {branches.length === 0 ? (
        <ManagedBranchEmpty needsTenantSelection={needsTenantSelection} />
      ) : (
        <AttendanceReportClient branches={branches} />
      )}
    </div>
  );
}
