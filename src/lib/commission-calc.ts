import type { CommissionTier, CommissionType } from '@/lib/supabase/types';

export type CommissionBookingItem = {
  price: number;
  service_name: string;
  services?: { fixed_commission: number | null; cost_price: number | null } | null;
};

export type CommissionBooking = {
  id: string;
  total_price: number;
  completed_at: string | null;
  booking_items: CommissionBookingItem[];
};

export type CommissionBreakdownLine = { label: string; amount: number | null };

// One row per distinct (service, unit calculation) — e.g. "4x Classic Haircut" — so the barber
// sees exactly which services were counted without a wall of one-row-per-transaction duplicates.
export type CommissionLineItem = {
  serviceName: string;
  qty: number;
  unitAmount: number;
  detail: string;
  amount: number;
};

export type CommissionResult = {
  servicesCount: number;
  grossCommission: number;
  breakdown: CommissionBreakdownLine[];
  items: CommissionLineItem[];
};

const formatRupiahPlain = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

type RawLine = { serviceName: string; detail: string; amount: number };

// Groups raw per-transaction lines into qty-based rows. Two lines group together only when both
// the service name AND the per-unit calculation text match, so a price change (promo, etc.)
// correctly shows as its own row instead of being silently averaged away.
function groupLines(raw: RawLine[]): CommissionLineItem[] {
  const map = new Map<string, CommissionLineItem>();
  for (const line of raw) {
    const key = `${line.serviceName}::${line.detail}`;
    const existing = map.get(key);
    if (existing) {
      existing.qty += 1;
      existing.amount += line.amount;
    } else {
      map.set(key, { serviceName: line.serviceName, qty: 1, unitAmount: line.amount, detail: line.detail, amount: line.amount });
    }
  }
  return Array.from(map.values());
}

/**
 * Single source of truth for "how much commission did this barber earn in this period",
 * shared by the owner-facing Payroll page and the barber-facing "Payroll" (slip gaji) page so the
 * two can never disagree. `breakdown` is a human-readable trace of the arithmetic, and `items`
 * itemizes every contributing service (grouped by qty) — always show both next to the total so
 * the number is never a black box.
 */
export function calculateCommission(input: {
  commissionType: CommissionType;
  commissionPercent: number; // used by 'percent' and 'net_percent'
  bookings: CommissionBooking[]; // completed bookings for this barber+branch in the period
  monthlySalary?: number | null; // used by 'salary'
  periodDays: number; // used by 'salary' to prorate
  tiers?: CommissionTier[]; // used by 'tiered'
}): CommissionResult {
  const { commissionType, commissionPercent, bookings, monthlySalary, periodDays, tiers } = input;
  const servicesCount = bookings.length;

  switch (commissionType) {
    case 'percent': {
      let gross = 0;
      const raw: RawLine[] = [];
      for (const b of bookings) {
        gross += Number(b.total_price);
        for (const item of b.booking_items ?? []) {
          raw.push({
            serviceName: item.service_name,
            detail: `${commissionPercent}% × ${formatRupiahPlain(item.price)}`,
            amount: Number(item.price) * (commissionPercent / 100),
          });
        }
      }
      const commission = gross * (commissionPercent / 100);
      return {
        servicesCount,
        grossCommission: commission,
        breakdown: [
          { label: `Total omzet ${servicesCount} layanan`, amount: gross },
          { label: `${commissionPercent}% dari omzet`, amount: commission },
        ],
        items: groupLines(raw),
      };
    }

    case 'fixed': {
      let commission = 0;
      let itemCount = 0;
      const raw: RawLine[] = [];
      for (const b of bookings) {
        for (const item of b.booking_items ?? []) {
          const fixedCommission = Number(item.services?.fixed_commission ?? 0);
          commission += fixedCommission;
          itemCount += 1;
          raw.push({
            serviceName: item.service_name,
            detail: `Komisi tetap ${formatRupiahPlain(fixedCommission)}`,
            amount: fixedCommission,
          });
        }
      }
      return {
        servicesCount,
        grossCommission: commission,
        breakdown: [{ label: `${itemCount} item layanan × komisi tetap masing-masing`, amount: commission }],
        items: groupLines(raw),
      };
    }

    case 'net_percent': {
      let netTotal = 0;
      let itemCount = 0;
      const raw: RawLine[] = [];
      for (const b of bookings) {
        for (const item of b.booking_items ?? []) {
          const cost = Number(item.services?.cost_price ?? 0);
          const net = Math.max(0, Number(item.price) - cost);
          netTotal += net;
          itemCount += 1;
          raw.push({
            serviceName: item.service_name,
            detail: `(${formatRupiahPlain(item.price)} − ${formatRupiahPlain(cost)} modal) × ${commissionPercent}%`,
            amount: net * (commissionPercent / 100),
          });
        }
      }
      const commission = netTotal * (commissionPercent / 100);
      return {
        servicesCount,
        grossCommission: commission,
        breakdown: [
          { label: `Laba bersih ${itemCount} item (harga − modal)`, amount: netTotal },
          { label: `${commissionPercent}% dari laba bersih`, amount: commission },
        ],
        items: groupLines(raw),
      };
    }

    case 'tiered': {
      const sortedTiers = (tiers ?? []).slice().sort((a, b) => a.min_services - b.min_services);
      let appliedPercent = 0;
      let tierLabel = 'Belum ada tier yang terpenuhi (0%)';
      for (const tier of sortedTiers) {
        if (servicesCount >= tier.min_services) {
          appliedPercent = tier.commission_percent;
          tierLabel = `Tier ${tier.min_services}+ layanan → ${tier.commission_percent}%`;
        }
      }
      let gross = 0;
      const raw: RawLine[] = [];
      for (const b of bookings) {
        gross += Number(b.total_price);
        for (const item of b.booking_items ?? []) {
          raw.push({
            serviceName: item.service_name,
            detail: `${appliedPercent}% (${tierLabel}) × ${formatRupiahPlain(item.price)}`,
            amount: Number(item.price) * (appliedPercent / 100),
          });
        }
      }
      const commission = gross * (appliedPercent / 100);
      return {
        servicesCount,
        grossCommission: commission,
        breakdown: [
          { label: `${servicesCount} layanan selesai → ${tierLabel}`, amount: null },
          { label: `Total omzet ${formatRupiahPlain(gross)} × ${appliedPercent}%`, amount: commission },
        ],
        items: groupLines(raw),
      };
    }

    case 'salary': {
      const salary = Number(monthlySalary ?? 0);
      const prorated = salary * (periodDays / 30);
      return {
        servicesCount,
        grossCommission: prorated,
        breakdown: [
          {
            label: `Gaji bulanan ${formatRupiahPlain(salary)} × (${periodDays}/30 hari periode)`,
            amount: prorated,
          },
        ],
        items: [],
      };
    }
  }
}

export const commissionTypeLabel: Record<CommissionType, string> = {
  percent: 'Persen dari Omzet',
  fixed: 'Nominal Tetap per Layanan',
  salary: 'Gaji Tetap Bulanan',
  tiered: 'Komisi Bertingkat (Target)',
  net_percent: 'Persen dari Laba Bersih',
};
