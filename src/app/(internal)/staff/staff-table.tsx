'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Save } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Profile, UserRole } from '@/lib/supabase/types';
import type { BranchOption } from './page';

const ASSIGNABLE_ROLES: UserRole[] = ['customer', 'barber', 'cashier', 'owner'];

const roleLabel: Record<UserRole, string> = {
  customer: 'Customer',
  barber: 'Barber',
  cashier: 'Cashier',
  owner: 'Owner',
  superadmin: 'Super Admin',
};

const roleBadgeClass: Record<UserRole, string> = {
  customer: 'bg-white/10 text-gray-300',
  barber: 'bg-blue-500/20 text-blue-400',
  cashier: 'bg-primary/20 text-primary',
  owner: 'bg-green-500/20 text-green-400',
  superadmin: 'bg-purple-500/20 text-purple-400',
};

type Draft = {
  role: UserRole;
  branchId: string | null;
  extraBranchIds: string[];
  monthlySalary: string;
  isWorkingBarber: boolean;
};

export default function StaffTable({
  profiles,
  branches,
  currentUserId,
  extraBranchesByProfile,
}: {
  profiles: Profile[];
  branches: BranchOption[];
  currentUserId: string;
  extraBranchesByProfile: Record<string, string[]>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [rowSaved, setRowSaved] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) => (p.full_name ?? '').toLowerCase().includes(q) || (p.phone ?? '').toLowerCase().includes(q)
    );
  }, [profiles, query]);

  const baseDraftFor = (id: string): Draft => {
    const p = profiles.find((x) => x.id === id);
    return {
      role: p?.role ?? 'customer',
      branchId: p?.branch_id ?? null,
      extraBranchIds: extraBranchesByProfile[id] ?? [],
      monthlySalary: p?.monthly_salary === null || p?.monthly_salary === undefined ? '' : String(p.monthly_salary),
      isWorkingBarber: p?.is_working_barber ?? false,
    };
  };

  const getDraft = (p: Profile): Draft => drafts[p.id] ?? baseDraftFor(p.id);

  const setDraft = (id: string, patch: Partial<Draft>) => {
    setRowSaved((prev) => ({ ...prev, [id]: false }));
    setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] ?? baseDraftFor(id)), ...patch } }));
  };

  const toggleExtraBranch = (id: string, branchId: string) => {
    const current = getDraft(profiles.find((p) => p.id === id)!);
    const next = current.extraBranchIds.includes(branchId)
      ? current.extraBranchIds.filter((b) => b !== branchId)
      : [...current.extraBranchIds, branchId];
    setDraft(id, { extraBranchIds: next });
  };

  const setBusy = (id: string, on: boolean) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const isDirtyFor = (p: Profile) => {
    const draft = getDraft(p);
    const base = baseDraftFor(p.id);
    return (
      draft.role !== base.role ||
      draft.branchId !== base.branchId ||
      draft.extraBranchIds.slice().sort().join(',') !== base.extraBranchIds.slice().sort().join(',') ||
      draft.monthlySalary !== base.monthlySalary ||
      draft.isWorkingBarber !== base.isWorkingBarber
    );
  };

  const handleSave = async (profileId: string) => {
    const draft = getDraft(profiles.find((p) => p.id === profileId)!);
    const salaryValue = draft.monthlySalary.trim() === '' ? 0 : Number(draft.monthlySalary);
    if (Number.isNaN(salaryValue) || salaryValue < 0) {
      setRowError((prev) => ({ ...prev, [profileId]: 'Gaji bulanan tidak valid.' }));
      return;
    }

    setBusy(profileId, true);
    setRowError((prev) => ({ ...prev, [profileId]: '' }));
    setRowSaved((prev) => ({ ...prev, [profileId]: false }));

    const supabase = createClient();

    const { error: roleError } = await supabase.rpc('admin_set_staff_role', {
      target_id: profileId,
      new_role: draft.role,
      new_branch_id: draft.role === 'customer' ? null : draft.branchId,
      set_working_barber: draft.role === 'customer' ? false : draft.isWorkingBarber,
    });

    if (roleError) {
      setBusy(profileId, false);
      setRowError((prev) => ({ ...prev, [profileId]: 'Gagal menyimpan role/cabang utama. Coba lagi.' }));
      return;
    }

    const { error: branchesError } = await supabase.rpc('admin_set_staff_branches', {
      target_id: profileId,
      new_branch_ids: draft.role === 'customer' ? [] : draft.extraBranchIds,
    });

    if (branchesError) {
      setBusy(profileId, false);
      setRowError((prev) => ({ ...prev, [profileId]: 'Cabang utama tersimpan, tapi cabang tambahan gagal. Coba lagi.' }));
      return;
    }

    if (draft.role === 'barber' || draft.isWorkingBarber) {
      const { error: salaryError } = await supabase.rpc('admin_set_staff_salary', {
        target_id: profileId,
        new_salary: salaryValue,
      });
      if (salaryError) {
        setBusy(profileId, false);
        setRowError((prev) => ({ ...prev, [profileId]: 'Role/cabang tersimpan, tapi gaji bulanan gagal. Coba lagi.' }));
        return;
      }
    }

    setBusy(profileId, false);
    setRowSaved((prev) => ({ ...prev, [profileId]: true }));
    router.refresh();
  };

  // Baris "Akun Anda" tidak boleh self-edit role/cabang (privilege escalation), tapi menandai
  // diri sendiri sebagai kapster aktif + gaji itu aman — lewat RPC set_my_working_barber.
  const handleSaveSelf = async (profileId: string) => {
    const draft = getDraft(profiles.find((p) => p.id === profileId)!);
    const salaryValue = draft.monthlySalary.trim() === '' ? 0 : Number(draft.monthlySalary);
    if (Number.isNaN(salaryValue) || salaryValue < 0) {
      setRowError((prev) => ({ ...prev, [profileId]: 'Gaji bulanan tidak valid.' }));
      return;
    }

    setBusy(profileId, true);
    setRowError((prev) => ({ ...prev, [profileId]: '' }));
    setRowSaved((prev) => ({ ...prev, [profileId]: false }));

    const supabase = createClient();
    const { error: selfError } = await supabase.rpc('set_my_working_barber', {
      new_is_working_barber: draft.isWorkingBarber,
      new_monthly_salary: draft.isWorkingBarber ? salaryValue : null,
    });

    setBusy(profileId, false);
    if (selfError) {
      setRowError((prev) => ({ ...prev, [profileId]: 'Gagal menyimpan status kapster. Coba lagi.' }));
      return;
    }
    setRowSaved((prev) => ({ ...prev, [profileId]: true }));
    router.refresh();
  };

  return (
    <div>
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama atau nomor telepon..."
          className="w-full bg-white/5 border border-[var(--border)] rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 bg-white/5">
              <th className="px-4 py-3 font-medium">Nama</th>
              <th className="px-4 py-3 font-medium">Telepon</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Kapster Aktif</th>
              <th className="px-4 py-3 font-medium">Cabang Utama</th>
              <th className="px-4 py-3 font-medium">Cabang Tambahan</th>
              <th className="px-4 py-3 font-medium">Gaji Bulanan</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  Tidak ada yang cocok dengan pencarian.
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const draft = getDraft(p);
              const isSelf = p.id === currentUserId;
              const isDirty = isDirtyFor(p);
              const selfBranch = branches.find((b) => b.id === p.branch_id);
              const branchName = selfBranch && (selfBranch.tenantName ? `${selfBranch.name} — ${selfBranch.tenantName}` : selfBranch.name);
              const isStaffRole = draft.role !== 'customer';
              const isBarber = draft.role === 'barber';
              const isBarberLike = isBarber || draft.isWorkingBarber;
              // Profil yang udah punya tenant_id (misal owner/staff barbershop tertentu) cuma boleh pilih
              // cabang dari tenant-nya sendiri. Profil belum ke-klaim (customer baru) bebas pilih tenant mana pun.
              const primaryBranchCandidates = branches.filter((b) => !p.tenant_id || !b.tenantId || b.tenantId === p.tenant_id);
              const primaryBranchTenantId = branches.find((b) => b.id === draft.branchId)?.tenantId;
              const extraBranchCandidates = branches.filter(
                (b) => b.id !== draft.branchId && (!primaryBranchTenantId || b.tenantId === primaryBranchTenantId)
              );

              return (
                <tr key={p.id} className="border-t border-[var(--border)] align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{p.full_name ?? 'Tanpa nama'}</p>
                    {isSelf && <p className="text-xs text-gray-500">Akun Anda</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-300">{p.phone ?? '-'}</td>
                  <td className="px-4 py-3">
                    {isSelf ? (
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${roleBadgeClass[p.role]}`}>
                        {roleLabel[p.role]}
                      </span>
                    ) : (
                      <select
                        value={draft.role}
                        onChange={(e) => setDraft(p.id, { role: e.target.value as UserRole })}
                        className="bg-white/10 border border-[var(--border)] rounded-lg text-sm px-2 py-1.5"
                      >
                        {ASSIGNABLE_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {roleLabel[r]}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!isStaffRole ? (
                      <span className="text-gray-600">-</span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={draft.isWorkingBarber}
                        onChange={(e) => setDraft(p.id, { isWorkingBarber: e.target.checked })}
                        className="h-4 w-4 rounded border-[var(--border)] accent-primary"
                        aria-label="Kapster aktif"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isSelf ? (
                      <span className="text-gray-400">{branchName ?? '-'}</span>
                    ) : draft.role === 'customer' ? (
                      <span className="text-gray-600">-</span>
                    ) : (
                      <select
                        value={draft.branchId ?? ''}
                        onChange={(e) => setDraft(p.id, { branchId: e.target.value || null })}
                        className="bg-white/10 border border-[var(--border)] rounded-lg text-sm px-2 py-1.5"
                      >
                        <option value="">Pilih cabang...</option>
                        {primaryBranchCandidates.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.tenantName ? `${b.name} — ${b.tenantName}` : b.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isSelf || !isStaffRole ? (
                      <span className="text-gray-600">-</span>
                    ) : !draft.branchId && branches.some((b) => b.tenantId) ? (
                      <span className="text-gray-600 text-xs">Pilih cabang utama dulu</span>
                    ) : extraBranchCandidates.length === 0 ? (
                      <span className="text-gray-600 text-xs">Cuma 1 cabang</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 max-w-[220px]">
                        {extraBranchCandidates
                          .map((b) => {
                            const active = draft.extraBranchIds.includes(b.id);
                            return (
                              <button
                                key={b.id}
                                type="button"
                                onClick={() => toggleExtraBranch(p.id, b.id)}
                                className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                                  active
                                    ? 'bg-primary/20 border-primary text-primary'
                                    : 'bg-white/5 border-[var(--border)] text-gray-400 hover:border-primary/50'
                                }`}
                              >
                                {b.tenantName ? `${b.name} — ${b.tenantName}` : b.name}
                              </button>
                            );
                          })}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!isBarberLike ? (
                      <span className="text-gray-600">-</span>
                    ) : (
                      <input
                        type="number"
                        value={draft.monthlySalary}
                        onChange={(e) => setDraft(p.id, { monthlySalary: e.target.value })}
                        placeholder="0"
                        className="w-28 bg-white/10 border border-[var(--border)] rounded-lg text-sm px-2 py-1.5"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <button
                        onClick={() => (isSelf ? handleSaveSelf(p.id) : handleSave(p.id))}
                        disabled={!isDirty || pendingIds.has(p.id) || (!isSelf && draft.role !== 'customer' && !draft.branchId)}
                        className="inline-flex items-center gap-1.5 bg-primary hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Save className="h-3.5 w-3.5" />
                        {pendingIds.has(p.id) ? 'Menyimpan...' : 'Simpan'}
                      </button>
                      {rowError[p.id] && <p className="text-xs text-red-400 max-w-[140px] text-right">{rowError[p.id]}</p>}
                      {rowSaved[p.id] && <p className="text-xs text-green-400">Tersimpan</p>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
