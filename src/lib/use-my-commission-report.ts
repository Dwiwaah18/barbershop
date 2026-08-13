'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { calculateCommission, type CommissionBooking, type CommissionResult } from '@/lib/commission-calc';
import type { Branch, CommissionTier } from '@/lib/supabase/types';

const EMPTY_RESULT: CommissionResult = { servicesCount: 0, grossCommission: 0, breakdown: [], items: [] };

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function dateInputValue(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function defaultPeriodStart() {
  const d = new Date();
  d.setDate(1);
  return dateInputValue(d);
}

function defaultPeriodEnd() {
  return dateInputValue(new Date());
}

// 'YYYY-MM-DD' from a date input, interpreted in the browser's local timezone.
function startOfDayISO(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toISOString();
}

function nextDayStartISO(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

function periodDaysBetween(startStr: string, endStr: string) {
  const start = new Date(`${startStr}T00:00:00`);
  const end = new Date(`${endStr}T00:00:00`);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
}

// Shared by the "Laporan Saya" and "Payroll" (slip gaji) pages so their numbers can never
// diverge — both are just different presentations of the same calculateCommission() call.
export function useMyCommissionReport(branches: Branch[], userId: string) {
  const [branchId, setBranchId] = useState(branches[0].id);
  const selectedBranch = useMemo(() => branches.find((b) => b.id === branchId) ?? branches[0], [branches, branchId]);

  const [monthlySalary, setMonthlySalary] = useState<number | null>(null);
  const [tiers, setTiers] = useState<CommissionTier[]>([]);

  const [periodStart, setPeriodStart] = useState(defaultPeriodStart);
  const [periodEnd, setPeriodEnd] = useState(defaultPeriodEnd);

  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [hasCalculated, setHasCalculated] = useState(false);
  const [result, setResult] = useState<CommissionResult>(EMPTY_RESULT);

  useEffect(() => {
    setHasCalculated(false);
    setResult(EMPTY_RESULT);
    setCalcError(null);

    const supabase = createClient();
    let cancelled = false;

    supabase
      .from('profiles')
      .select('monthly_salary')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (!cancelled) setMonthlySalary((data as { monthly_salary: number | null } | null)?.monthly_salary ?? null);
      });

    supabase
      .from('commission_tiers')
      .select('*')
      .eq('branch_id', branchId)
      .order('min_services', { ascending: true })
      .then(({ data }) => {
        if (!cancelled) setTiers((data as CommissionTier[] | null) ?? []);
      });

    return () => {
      cancelled = true;
    };
  }, [branchId, userId]);

  const handleCalculate = useCallback(async () => {
    if (calculating) return;
    setCalculating(true);
    setCalcError(null);

    if (!periodStart || !periodEnd || periodStart > periodEnd) {
      setCalcError('Rentang tanggal tidak valid.');
      setCalculating(false);
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from('bookings')
      .select(
        'id, total_price, completed_at, booking_items(price, service_name, service_id, services(fixed_commission, cost_price))'
      )
      .eq('barber_id', userId)
      .eq('branch_id', branchId)
      .eq('status', 'completed')
      .gte('completed_at', startOfDayISO(periodStart))
      .lt('completed_at', nextDayStartISO(periodEnd));

    if (error) {
      setCalcError('Gagal menghitung laporan. Coba lagi.');
      setCalculating(false);
      return;
    }

    const bookings = (data as unknown as CommissionBooking[] | null) ?? [];
    const commissionResult = calculateCommission({
      commissionType: selectedBranch.commission_type,
      commissionPercent: selectedBranch.commission_percent,
      bookings,
      monthlySalary,
      periodDays: periodDaysBetween(periodStart, periodEnd),
      tiers,
    });

    setResult(commissionResult);
    setHasCalculated(true);
    setCalculating(false);
  }, [calculating, periodStart, periodEnd, userId, branchId, selectedBranch, monthlySalary, tiers]);

  return {
    branchId,
    setBranchId,
    selectedBranch,
    periodStart,
    setPeriodStart,
    periodEnd,
    setPeriodEnd,
    calculating,
    calcError,
    hasCalculated,
    result,
    handleCalculate,
  };
}
