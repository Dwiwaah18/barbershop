export type ShiftReconciliationRow = {
  id: string;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  closing_cash: number | null;
};

export type ReconciliationTxRow = {
  total: number;
  payment_method: 'cash' | 'qris' | 'deposit';
  created_at: string;
};

export type ReconciliationPettyCashRow = {
  shift_id: string;
  type: 'cash_in' | 'expense';
  amount: number;
};

export type ShiftReconciliation = {
  cashSales: number;
  qrisSales: number;
  depositSales: number;
  expectedCash: number;
  selisih: number | null;
};

/**
 * Single source of truth for shift cash reconciliation — used by both the owner-facing shift
 * report and the finance report's Operasional section, so the two can never disagree. Only
 * 'cash' payments move physical money; QRIS/deposit are computed but excluded from expectedCash.
 * A still-open shift's window extends to "now" (Infinity) since it has no closed_at yet.
 */
export function reconcileShift(
  shift: ShiftReconciliationRow,
  transactions: ReconciliationTxRow[],
  pettyCash: ReconciliationPettyCashRow[]
): ShiftReconciliation {
  const start = new Date(shift.opened_at).getTime();
  const end = shift.closed_at ? new Date(shift.closed_at).getTime() : Infinity;
  const withinShift = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= start && t < end;
  };

  let cashSales = 0;
  let qrisSales = 0;
  let depositSales = 0;
  for (const tx of transactions) {
    if (!withinShift(tx.created_at)) continue;
    if (tx.payment_method === 'cash') cashSales += Number(tx.total);
    else if (tx.payment_method === 'qris') qrisSales += Number(tx.total);
    else if (tx.payment_method === 'deposit') depositSales += Number(tx.total);
  }

  let pettyIn = 0;
  let pettyExpense = 0;
  for (const p of pettyCash) {
    if (p.shift_id !== shift.id) continue;
    if (p.type === 'cash_in') pettyIn += Number(p.amount);
    else pettyExpense += Number(p.amount);
  }

  const expectedCash = Number(shift.opening_cash) + cashSales + pettyIn - pettyExpense;
  const selisih = shift.closing_cash !== null ? Number(shift.closing_cash) - expectedCash : null;

  return { cashSales, qrisSales, depositSales, expectedCash, selisih };
}
