import { getManagedContext } from '@/lib/supabase/managed-branches';
import { ManagedBranchEmpty } from '../managed-branch-empty';
import FinanceReportClient from './finance-report-client';

export default async function FinanceReportPage() {
  const { current, branches, needsTenantSelection } = await getManagedContext();

  if (!current) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Laporan Keuangan</h1>
        <div className="glass-panel p-6 rounded-2xl text-gray-400">
          Anda harus login untuk mengakses halaman ini.
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Laporan Keuangan</h1>
      <p className="text-gray-400 mb-8">
        Pendapatan, operasional (shift & petty cash), dan laba bersih per cabang untuk periode yang dipilih.
      </p>
      {branches.length === 0 ? (
        <ManagedBranchEmpty needsTenantSelection={needsTenantSelection} />
      ) : (
        <FinanceReportClient branches={branches} />
      )}
    </div>
  );
}
