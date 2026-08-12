import { ClipboardCheck, DollarSign, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/supabase/current-profile';
import { getMyStaffBranches, type StaffBranchOption } from '@/lib/supabase/staff-branches';
import type { Shift, PettyCashEntry } from '@/lib/supabase/types';
import { OpenRegisterForm } from './open-register-form';
import { CloseRegisterForm } from './close-register-form';
import { PettyCashForm } from './petty-cash-form';

const formatRupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

export default async function ShiftPage() {
  const current = await getCurrentProfile();

  if (!current) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Shift & Petty Cash</h1>
        <div className="glass-panel p-6 rounded-2xl text-gray-400">
          Anda harus login untuk mengakses halaman ini.
        </div>
      </div>
    );
  }

  const { userId } = current;
  const supabase = await createClient();

  const { data: shiftRows } = await supabase
    .from('shifts')
    .select('*')
    .eq('cashier_id', userId)
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1);

  const openShift = ((shiftRows as Shift[] | null) ?? [])[0] ?? null;

  let pettyCashEntries: PettyCashEntry[] = [];
  let openShiftBranchName: string | null = null;
  let staffBranches: StaffBranchOption[] = [];
  let cashSales = 0;
  let qrisSales = 0;
  let depositSales = 0;

  if (openShift) {
    const [{ data: entryRows }, { data: branchRow }, { data: txRows }] = await Promise.all([
      supabase.from('petty_cash_entries').select('*').eq('shift_id', openShift.id).order('created_at', { ascending: false }),
      supabase.from('branches').select('name').eq('id', openShift.branch_id).single(),
      // Any paid sale at this branch since the shift opened — POS or booking Mark Complete alike —
      // counts toward this register's cash, regardless of which staff member processed it.
      supabase
        .from('transactions')
        .select('total, payment_method')
        .eq('branch_id', openShift.branch_id)
        .eq('status', 'paid')
        .gte('created_at', openShift.opened_at),
    ]);
    pettyCashEntries = (entryRows as PettyCashEntry[] | null) ?? [];
    openShiftBranchName = (branchRow as { name: string } | null)?.name ?? null;

    for (const tx of (txRows as { total: number; payment_method: string }[] | null) ?? []) {
      if (tx.payment_method === 'cash') cashSales += Number(tx.total);
      else if (tx.payment_method === 'qris') qrisSales += Number(tx.total);
      else if (tx.payment_method === 'deposit') depositSales += Number(tx.total);
    }
  } else {
    staffBranches = await getMyStaffBranches();
  }

  const cashIn = pettyCashEntries
    .filter((entry) => entry.type === 'cash_in')
    .reduce((sum, entry) => sum + Number(entry.amount), 0);
  const expenseTotal = pettyCashEntries
    .filter((entry) => entry.type === 'expense')
    .reduce((sum, entry) => sum + Number(entry.amount), 0);
  // Only 'cash' payments move physical money in the drawer — QRIS/deposit are shown separately
  // below for reference but deliberately excluded from this total.
  const currentCash = (openShift ? Number(openShift.opening_cash) : 0) + cashSales + cashIn - expenseTotal;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 print:hidden">Shift & Petty Cash</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Register Management */}
        <div className="glass-panel p-8 rounded-3xl">
          <div className="flex items-center gap-3 mb-6 border-b border-[var(--border)] pb-4 print:hidden">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-semibold">Cash Register</h2>
          </div>

          {openShift ? (
            <>
              <div className="space-y-4 mb-6 print:hidden">
                <div className="flex justify-between items-center p-4 bg-white/5 border border-[var(--border)] rounded-xl">
                  <span className="text-gray-400">Status</span>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">OPEN</span>
                </div>
                {openShiftBranchName && (
                  <div className="flex justify-between items-center p-4 bg-white/5 border border-[var(--border)] rounded-xl">
                    <span className="text-gray-400">Branch</span>
                    <span className="font-medium">{openShiftBranchName}</span>
                  </div>
                )}
                <div className="flex justify-between items-center p-4 bg-white/5 border border-[var(--border)] rounded-xl">
                  <span className="text-gray-400">Opening Balance</span>
                  <span className="font-medium">{formatRupiah(Number(openShift.opening_cash))}</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-white/5 border border-[var(--border)] rounded-xl">
                  <span className="text-gray-400">Penjualan Cash (shift ini)</span>
                  <span className="font-medium">{formatRupiah(cashSales)}</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-white/5 border border-[var(--border)] rounded-xl">
                  <span className="text-gray-400">Petty Cash (Masuk − Keluar)</span>
                  <span className="font-medium">{formatRupiah(cashIn - expenseTotal)}</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-primary/10 border border-primary/30 rounded-xl">
                  <span className="text-gray-300 font-medium">Estimasi Kas Fisik (Seharusnya)</span>
                  <span className="font-bold text-primary">{formatRupiah(currentCash)}</span>
                </div>
              </div>

              <div className="space-y-2 mb-6 text-sm print:hidden">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Non-tunai (info, tidak masuk kas fisik)</p>
                <div className="flex justify-between text-gray-400">
                  <span>Penjualan QRIS</span>
                  <span className="text-gray-300">{formatRupiah(qrisSales)}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Penjualan Deposit (Share Wallet)</span>
                  <span className="text-gray-300">{formatRupiah(depositSales)}</span>
                </div>
              </div>

              <div className="flex items-start gap-3 text-sm text-amber-200/70 bg-amber-900/20 p-4 rounded-xl mb-6 print:hidden">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p>Hitung uang fisik di laci dan cocokkan dengan &ldquo;Estimasi Kas Fisik&rdquo; di atas sebelum menutup kasir.</p>
              </div>

              <CloseRegisterForm
                shiftId={openShift.id}
                estimatedCash={currentCash}
                branchName={openShiftBranchName ?? 'Cabang'}
                cashierName={current.profile.full_name ?? 'Kasir'}
                openedAt={openShift.opened_at}
                openingCash={Number(openShift.opening_cash)}
                cashSales={cashSales}
                qrisSales={qrisSales}
                depositSales={depositSales}
                pettyCashIn={cashIn}
                pettyCashExpense={expenseTotal}
                pettyCashEntries={pettyCashEntries}
              />
            </>
          ) : (
            <OpenRegisterForm userId={userId} branches={staffBranches} />
          )}
        </div>

        {/* Petty Cash */}
        <div className="glass-panel p-8 rounded-3xl print:hidden">
          <div className="flex items-center gap-3 mb-6 border-b border-[var(--border)] pb-4">
            <DollarSign className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-semibold">Petty Cash Tracker</h2>
          </div>

          {openShift ? (
            <>
              <PettyCashForm shiftId={openShift.id} />

              <h3 className="font-semibold mb-3">Today&apos;s Expenses</h3>
              <div className="space-y-3">
                {pettyCashEntries.length === 0 ? (
                  <p className="text-sm text-gray-500">Belum ada catatan kas kecil untuk shift ini.</p>
                ) : (
                  pettyCashEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex justify-between items-center p-3 bg-white/5 rounded-xl text-sm"
                    >
                      <span className="text-gray-300">{entry.description || '(tanpa keterangan)'}</span>
                      <span className={entry.type === 'expense' ? 'text-red-400' : 'text-green-400'}>
                        {entry.type === 'expense' ? '-' : '+'}
                        {formatRupiah(Number(entry.amount))}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">Buka kasir dulu untuk mencatat kas kecil.</p>
          )}
        </div>
      </div>
    </div>
  );
}
