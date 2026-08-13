import { getManagedContext } from '@/lib/supabase/managed-branches';
import { ManagedBranchEmpty } from '../managed-branch-empty';
import ShiftReportClient from './shift-report-client';

export default async function ShiftReportPage() {
  const { current, branches, needsTenantSelection } = await getManagedContext();

  if (!current) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Laporan Tutup Shift</h1>
        <div className="glass-panel p-6 rounded-2xl text-gray-400">
          Anda harus login untuk mengakses halaman ini.
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Laporan Tutup Shift</h1>
      <p className="text-gray-400 mb-8">
        Rekonsiliasi kas fisik vs sistem untuk setiap shift kasir, dibagi per cabang, untuk periode yang dipilih.
      </p>
      {branches.length === 0 ? (
        <ManagedBranchEmpty needsTenantSelection={needsTenantSelection} />
      ) : (
        <ShiftReportClient branches={branches} />
      )}
    </div>
  );
}
