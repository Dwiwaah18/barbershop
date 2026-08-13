import { createClient } from '@/lib/supabase/client';
import { readManagedTenantIdClient } from '@/lib/manage-tenant';

type SupabaseBrowserClient = ReturnType<typeof createClient>;

export type BranchId = string;
export type DashboardView = BranchId | 'all';

export type BranchOption = { id: BranchId; name: string; color: string };

export const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
export const HOUR_LABELS = ['09–11', '11–13', '13–15', '15–17', '17–19', '19–21'];

// Cycled by index when an owner has more branches than colors defined here.
const BRANCH_COLORS = ['#3987e5', '#d95926', '#199e70', '#a855f7', '#eab308', '#ec4899', '#06b6d4'];

type Kpis = {
  revenueToday: number;
  revenueDeltaPct: number;
  transactionsToday: number;
  transactionsDeltaPct: number;
  avgTicket: number;
  avgTicketDeltaPct: number;
  activeCustomers: number;
  activeCustomersDeltaPct: number;
};

export type Churned = { id: string; name: string; lastVisit: string; daysSince: number };
export type BranchBreakdown = { branchId: BranchId; branchName: string; revenue: number };
export type BarberPerformance = { barberId: string; barberName: string; servicesCount: number; revenue: number };

export type DashboardData = {
  kpis: Kpis;
  peakHours: number[][]; // [hourBlock][day] — raw completed-booking counts, not a busyness %
  revenueTrend: number[]; // 14 values aligned with trendDates
  trendDates: string[];
  retention: { repeatRatePct: number; repeatRateDeltaPct: number; churned: Churned[] };
  branchBreakdown: BranchBreakdown[] | null;
  barberPerformance: BarberPerformance[]; // same 14-day window as revenueTrend, sorted by revenue desc
};

function emptyDashboardData(trendDates: string[]): DashboardData {
  return {
    kpis: {
      revenueToday: 0,
      revenueDeltaPct: 0,
      transactionsToday: 0,
      transactionsDeltaPct: 0,
      avgTicket: 0,
      avgTicketDeltaPct: 0,
      activeCustomers: 0,
      activeCustomersDeltaPct: 0,
    },
    peakHours: Array.from({ length: HOUR_LABELS.length }, () => Array(DAY_LABELS.length).fill(0)),
    revenueTrend: Array(14).fill(0),
    trendDates,
    retention: { repeatRatePct: 0, repeatRateDeltaPct: 0, churned: [] },
    branchBreakdown: null,
    barberPerformance: [],
  };
}

function pctDelta(current: number, previous: number) {
  if (!previous) return 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, days: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatDdMm(d: Date) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function formatIndoDate(d: Date) {
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Maps the 6 fixed 2-hour blocks used by the heatmap (09–21). Anything outside that window is dropped.
function hourBucket(hour: number): number | null {
  if (hour >= 9 && hour < 11) return 0;
  if (hour >= 11 && hour < 13) return 1;
  if (hour >= 13 && hour < 15) return 2;
  if (hour >= 15 && hour < 17) return 3;
  if (hour >= 17 && hour < 19) return 4;
  if (hour >= 19 && hour < 21) return 5;
  return null;
}

// Monday = 0 .. Sunday = 6, matching DAY_LABELS order (JS getDay() is Sunday = 0).
function dayIndex(d: Date) {
  return (d.getDay() + 6) % 7;
}

export async function fetchOwnedBranches(supabase: SupabaseBrowserClient): Promise<BranchOption[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Superadmin tidak punya cabang sendiri — dia mengelola barbershop yang dipilih lewat switcher
  // (cookie manage_tenant). Owner tetap terikat ke cabang miliknya sendiri.
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const isSuperadmin = (profile as { role?: string } | null)?.role === 'superadmin';

  let query = supabase.from('branches').select('id, name').order('name', { ascending: true });
  if (isSuperadmin) {
    const managedTenantId = readManagedTenantIdClient();
    if (!managedTenantId) return [];
    query = query.eq('tenant_id', managedTenantId);
  } else {
    query = query.eq('owner_id', user.id);
  }

  const { data } = await query;

  return ((data ?? []) as { id: string; name: string }[]).map((b, i) => ({
    id: b.id,
    name: b.name,
    color: BRANCH_COLORS[i % BRANCH_COLORS.length],
  }));
}

export async function fetchDashboardData(
  supabase: SupabaseBrowserClient,
  view: DashboardView,
  branches: BranchOption[]
): Promise<DashboardData> {
  const now = new Date();
  const startToday = startOfDay(now);
  const startYesterday = addDays(startToday, -1);
  const trendStart = addDays(startToday, -13); // 14 days including today
  const trendDates = Array.from({ length: 14 }, (_, i) => formatDdMm(addDays(trendStart, i)));

  if (view !== 'all' && !branches.some((b) => b.id === view)) {
    // Switcher can't point at an unowned branch, but guard anyway rather than firing filtered
    // queries for an id RLS would silently return nothing for.
    return emptyDashboardData(trendDates);
  }

  type TxRow = { total: number; created_at: string; branch_id: string };
  type BookingCustomerRow = { customer_id: string | null };
  type BookingPeakRow = { completed_at: string | null; scheduled_at: string };
  type BookingRetentionRow = { customer_id: string | null; customer_name: string | null; completed_at: string | null };

  // --- Revenue / transactions: today vs yesterday (for KPI deltas) ---
  // .eq('status', 'paid') excludes voided sales — must match the same filter used by the Laporan
  // Keuangan revenue query, otherwise the two pages disagree on what counts as revenue.
  const todayTxBase = supabase
    .from('transactions')
    .select('total, created_at, branch_id')
    .eq('status', 'paid')
    .gte('created_at', startToday.toISOString());
  const { data: todayTxData } = await (view === 'all' ? todayTxBase : todayTxBase.eq('branch_id', view));
  const todayTx = (todayTxData ?? []) as TxRow[];

  const yesterdayTxBase = supabase
    .from('transactions')
    .select('total, created_at, branch_id')
    .eq('status', 'paid')
    .gte('created_at', startYesterday.toISOString())
    .lt('created_at', startToday.toISOString());
  const { data: yesterdayTxData } = await (view === 'all' ? yesterdayTxBase : yesterdayTxBase.eq('branch_id', view));
  const yesterdayTx = (yesterdayTxData ?? []) as TxRow[];

  const revenueToday = todayTx.reduce((sum, r) => sum + Number(r.total), 0);
  const transactionsToday = todayTx.length;
  const revenueYesterday = yesterdayTx.reduce((sum, r) => sum + Number(r.total), 0);
  const transactionsYesterday = yesterdayTx.length;

  const avgTicket = transactionsToday ? Math.round(revenueToday / transactionsToday) : 0;
  const avgTicketYesterday = transactionsYesterday ? Math.round(revenueYesterday / transactionsYesterday) : 0;

  // --- Active customers: distinct customer_id on bookings in a trailing 30-day window ---
  // "Yesterday" snapshot uses the same 30-day window shifted back one day, so the delta reflects
  // real day-over-day movement instead of comparing two near-identical windows by accident.
  const activeTodayBase = supabase
    .from('bookings')
    .select('customer_id, branch_id')
    .not('customer_id', 'is', null)
    .gte('created_at', addDays(startToday, -29).toISOString());
  const { data: activeTodayData } = await (view === 'all' ? activeTodayBase : activeTodayBase.eq('branch_id', view));
  const activeToday = new Set(((activeTodayData ?? []) as BookingCustomerRow[]).map((r) => r.customer_id));

  const activeYesterdayBase = supabase
    .from('bookings')
    .select('customer_id, branch_id')
    .not('customer_id', 'is', null)
    .gte('created_at', addDays(startYesterday, -29).toISOString())
    .lt('created_at', startToday.toISOString());
  const { data: activeYesterdayData } = await (view === 'all' ? activeYesterdayBase : activeYesterdayBase.eq('branch_id', view));
  const activeYesterday = new Set(((activeYesterdayData ?? []) as BookingCustomerRow[]).map((r) => r.customer_id));

  const kpis: Kpis = {
    revenueToday,
    revenueDeltaPct: pctDelta(revenueToday, revenueYesterday),
    transactionsToday,
    transactionsDeltaPct: pctDelta(transactionsToday, transactionsYesterday),
    avgTicket,
    avgTicketDeltaPct: pctDelta(avgTicket, avgTicketYesterday),
    activeCustomers: activeToday.size,
    activeCustomersDeltaPct: pctDelta(activeToday.size, activeYesterday.size),
  };

  // --- Peak hours: all-time completed bookings bucketed into 6 blocks x 7 days ---
  const peakBase = supabase.from('bookings').select('completed_at, scheduled_at, branch_id').eq('status', 'completed');
  const { data: peakData } = await (view === 'all' ? peakBase : peakBase.eq('branch_id', view));
  const peakHours = Array.from({ length: HOUR_LABELS.length }, () => Array(DAY_LABELS.length).fill(0));
  for (const row of (peakData ?? []) as BookingPeakRow[]) {
    const ts = row.completed_at ?? row.scheduled_at;
    if (!ts) continue;
    const d = new Date(ts);
    const block = hourBucket(d.getHours());
    if (block === null) continue;
    peakHours[block][dayIndex(d)] += 1;
  }

  // --- Revenue trend (14 days) + branch breakdown over the same window ---
  const trendBase = supabase
    .from('transactions')
    .select('total, created_at, branch_id')
    .eq('status', 'paid')
    .gte('created_at', trendStart.toISOString());
  const { data: trendData } = await (view === 'all' ? trendBase : trendBase.eq('branch_id', view));
  const trendRows = (trendData ?? []) as TxRow[];

  const revenueTrend = Array(14).fill(0);
  const branchTotals = new Map<string, number>();
  for (const row of trendRows) {
    const dayOffset = Math.round((startOfDay(new Date(row.created_at)).getTime() - trendStart.getTime()) / 86_400_000);
    if (dayOffset >= 0 && dayOffset < 14) revenueTrend[dayOffset] += Number(row.total);
    branchTotals.set(row.branch_id, (branchTotals.get(row.branch_id) ?? 0) + Number(row.total));
  }

  const branchBreakdown: BranchBreakdown[] | null =
    view === 'all'
      ? branches
          .map((b) => ({ branchId: b.id, branchName: b.name, revenue: branchTotals.get(b.id) ?? 0 }))
          .sort((a, b) => b.revenue - a.revenue)
      : null;

  // --- Barber performance (same 14-day window as the revenue trend) — a profiles join is safe
  // here (unlike the customer_name note below) since staff profiles are covered by "Owner views
  // tenant profiles", not the narrower customer-only visibility rules.
  type BarberPerfRow = { barber_id: string | null; total_price: number; profiles: { full_name: string | null } | null };
  const barberBase = supabase
    .from('bookings')
    .select('barber_id, total_price, profiles:barber_id(full_name)')
    .eq('status', 'completed')
    .not('barber_id', 'is', null)
    .gte('completed_at', trendStart.toISOString());
  const { data: barberData } = await (view === 'all' ? barberBase : barberBase.eq('branch_id', view));

  const barberTotals = new Map<string, { name: string; count: number; revenue: number }>();
  for (const row of (barberData ?? []) as unknown as BarberPerfRow[]) {
    if (!row.barber_id) continue;
    const existing = barberTotals.get(row.barber_id);
    if (existing) {
      existing.count += 1;
      existing.revenue += Number(row.total_price);
    } else {
      barberTotals.set(row.barber_id, {
        name: row.profiles?.full_name ?? 'Tanpa nama',
        count: 1,
        revenue: Number(row.total_price),
      });
    }
  }
  const barberPerformance: BarberPerformance[] = [...barberTotals.entries()]
    .map(([barberId, v]) => ({ barberId, barberName: v.name, servicesCount: v.count, revenue: v.revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  // --- Retention & churn: among customers with 1+ completed booking ever, in scope ---
  // bookings.customer_name is used directly (a snapshot stored at booking time) instead of joining
  // profiles: RLS only grants owners read access to branch bookings/transactions, not to arbitrary
  // customer profile rows, so a profiles join would silently come back empty for real customers.
  const retentionBase = supabase
    .from('bookings')
    .select('customer_id, customer_name, completed_at, branch_id')
    .eq('status', 'completed')
    .not('customer_id', 'is', null);
  const { data: retentionData } = await (view === 'all' ? retentionBase : retentionBase.eq('branch_id', view));
  const retentionRows = (retentionData ?? []) as BookingRetentionRow[];

  type CustAgg = { count: number; last: Date; name: string };
  const perCustomer = new Map<string, CustAgg>();
  for (const row of retentionRows) {
    if (!row.customer_id || !row.completed_at) continue;
    const completedAt = new Date(row.completed_at);
    const existing = perCustomer.get(row.customer_id);
    if (existing) {
      existing.count += 1;
      if (completedAt > existing.last) {
        existing.last = completedAt;
        existing.name = row.customer_name ?? existing.name;
      }
    } else {
      perCustomer.set(row.customer_id, { count: 1, last: completedAt, name: row.customer_name ?? 'Pelanggan' });
    }
  }

  const totalCustomers = perCustomer.size;
  const repeatCustomers = [...perCustomer.values()].filter((c) => c.count >= 2).length;
  const repeatRatePct = totalCustomers ? Math.round((repeatCustomers / totalCustomers) * 100) : 0;

  // "vs bulan lalu" delta: recompute the same rate using only bookings completed 30+ days ago, i.e.
  // the repeat rate as it stood a month back. No historical snapshot table exists to compare against,
  // so this reconstructs one from the same completed-booking history rather than fabricating a number.
  const monthAgoCutoff = addDays(startToday, -30);
  const perCustomerPast = new Map<string, number>();
  for (const row of retentionRows) {
    if (!row.customer_id || !row.completed_at) continue;
    if (new Date(row.completed_at) > monthAgoCutoff) continue;
    perCustomerPast.set(row.customer_id, (perCustomerPast.get(row.customer_id) ?? 0) + 1);
  }
  const totalCustomersPast = perCustomerPast.size;
  const repeatCustomersPast = [...perCustomerPast.values()].filter((c) => c >= 2).length;
  const repeatRatePctPast = totalCustomersPast ? Math.round((repeatCustomersPast / totalCustomersPast) * 100) : 0;

  const churned: Churned[] = [...perCustomer.entries()]
    .map(([customerId, agg]) => ({
      id: customerId,
      name: agg.name,
      lastVisit: formatIndoDate(agg.last),
      daysSince: Math.floor((now.getTime() - agg.last.getTime()) / 86_400_000),
    }))
    .filter((c) => c.daysSince > 30)
    .sort((a, b) => b.daysSince - a.daysSince)
    .slice(0, 5);

  return {
    kpis,
    peakHours,
    revenueTrend,
    trendDates,
    retention: {
      repeatRatePct,
      repeatRateDeltaPct: pctDelta(repeatRatePct, repeatRatePctPast),
      churned,
    },
    branchBreakdown,
    barberPerformance,
  };
}
