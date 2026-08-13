'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Plus, UserSearch, UserX, CheckCircle2, Pencil, Check, X, ChevronDown, ChevronRight, MapPin, Trash2, Power, RotateCcw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { TenantRow } from './page';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type OwnerCandidate = { id: string; full_name: string | null; phone: string | null; role: string };

export default function TenantsClient({ tenants }: { tenants: TenantRow[] }) {
  const router = useRouter();

  const [tenantName, setTenantName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [branchAddress, setBranchAddress] = useState('');

  const [ownerQuery, setOwnerQuery] = useState('');
  const [ownerResults, setOwnerResults] = useState<OwnerCandidate[]>([]);
  const [searchingOwner, setSearchingOwner] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState<OwnerCandidate | null>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [listError, setListError] = useState<string | null>(null);
  const [expandedTenantId, setExpandedTenantId] = useState<string | null>(null);
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
  const [tenantNameDraft, setTenantNameDraft] = useState('');
  const [savingTenant, setSavingTenant] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [branchNameDraft, setBranchNameDraft] = useState('');
  const [savingBranch, setSavingBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [addingBranchToTenantId, setAddingBranchToTenantId] = useState<string | null>(null);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(tenantName));
  }, [tenantName, slugTouched]);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    const q = ownerQuery.trim();
    if (!q) {
      setOwnerResults([]);
      return;
    }
    searchDebounce.current = setTimeout(async () => {
      setSearchingOwner(true);
      const supabase = createClient();
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, phone, role')
        .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(8);
      setOwnerResults((data as OwnerCandidate[] | null) ?? []);
      setSearchingOwner(false);
    }, 300);
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, [ownerQuery]);

  const handleCreate = async () => {
    setError(null);
    setSuccess(null);

    if (!selectedOwner) {
      setError('Pilih akun pemilik terlebih dahulu (harus sudah pernah login sekali ke sistem ini).');
      return;
    }
    if (!tenantName.trim() || !slug.trim() || !branchName.trim()) {
      setError('Nama barbershop, slug, dan nama outlet pertama wajib diisi.');
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc('superadmin_create_tenant', {
      tenant_slug: slug.trim(),
      tenant_name: tenantName.trim(),
      owner_profile_id: selectedOwner.id,
      first_branch_name: branchName.trim(),
      first_branch_address: branchAddress.trim() || null,
    });
    setSubmitting(false);

    if (rpcError) {
      setError(
        rpcError.message.includes('duplicate') || rpcError.message.includes('unique')
          ? 'Slug sudah dipakai barbershop lain. Coba slug lain.'
          : `Gagal mendaftarkan barbershop: ${rpcError.message}`
      );
      return;
    }

    setSuccess(`Barbershop "${tenantName.trim()}" berhasil didaftarkan dengan owner ${selectedOwner.full_name ?? 'akun terpilih'}.`);
    setTenantName('');
    setSlug('');
    setSlugTouched(false);
    setBranchName('');
    setBranchAddress('');
    setSelectedOwner(null);
    setOwnerQuery('');
    router.refresh();
  };

  const startEditTenant = (t: TenantRow) => {
    setListError(null);
    setEditingTenantId(t.id);
    setTenantNameDraft(t.name);
  };

  const saveTenantName = async (tenantId: string) => {
    const trimmed = tenantNameDraft.trim();
    if (!trimmed) return;
    setSavingTenant(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.from('tenants').update({ name: trimmed }).eq('id', tenantId);
    setSavingTenant(false);
    if (updateError) {
      setListError(`Gagal ganti nama barbershop: ${updateError.message}`);
      return;
    }
    setEditingTenantId(null);
    router.refresh();
  };

  const startEditBranch = (b: { id: string; name: string }) => {
    setListError(null);
    setEditingBranchId(b.id);
    setBranchNameDraft(b.name);
  };

  const saveBranchName = async (branchId: string) => {
    const trimmed = branchNameDraft.trim();
    if (!trimmed) return;
    setSavingBranch(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.from('branches').update({ name: trimmed }).eq('id', branchId);
    setSavingBranch(false);
    if (updateError) {
      setListError(`Gagal ganti nama outlet: ${updateError.message}`);
      return;
    }
    setEditingBranchId(null);
    router.refresh();
  };

  const addBranch = async (tenant: TenantRow) => {
    const trimmed = newBranchName.trim();
    if (!trimmed) return;
    setAddingBranchToTenantId(tenant.id);
    const supabase = createClient();
    const { error: insertError } = await supabase.from('branches').insert({
      tenant_id: tenant.id,
      owner_id: tenant.owner_id,
      name: trimmed,
      address: newBranchAddress.trim() || null,
    });
    setAddingBranchToTenantId(null);
    if (insertError) {
      setListError(`Gagal nambah outlet: ${insertError.message}`);
      return;
    }
    setNewBranchName('');
    setNewBranchAddress('');
    router.refresh();
  };

  const toggleStatus = async (tenant: TenantRow) => {
    setListError(null);
    const nextStatus = tenant.status === 'active' ? 'suspended' : 'active';
    const supabase = createClient();
    const { error: updateError } = await supabase.from('tenants').update({ status: nextStatus }).eq('id', tenant.id);
    if (updateError) {
      setListError(`Gagal mengubah status: ${updateError.message}`);
      return;
    }
    router.refresh();
  };

  const deleteBranch = async (branchId: string, branchName: string) => {
    setListError(null);
    if (!window.confirm(`Hapus cabang "${branchName}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc('superadmin_delete_branch', { target_branch_id: branchId });
    if (rpcError) {
      setListError(rpcError.message);
      return;
    }
    router.refresh();
  };

  const resetBranch = async (branchId: string, branchName: string) => {
    setListError(null);
    if (
      !window.confirm(
        `RESET cabang "${branchName}"?\n\nSemua transaksi, booking, shift, petty cash, absensi, riwayat payroll & kasbon cabang ini akan DIHAPUS PERMANEN. Saldo wallet pelanggan, layanan, dan staff TIDAK terpengaruh.\n\nLanjutkan?`
      )
    )
      return;
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc('superadmin_reset_branch', { target_branch_id: branchId });
    if (rpcError) {
      setListError(`Gagal reset cabang: ${rpcError.message}`);
      return;
    }
    setSuccess(`Cabang "${branchName}" berhasil direset (data operasional dihapus).`);
    router.refresh();
  };

  const resetTenant = async (tenant: TenantRow) => {
    setListError(null);
    if (
      !window.confirm(
        `RESET SELURUH barbershop "${tenant.name}"?\n\nSemua transaksi, booking, shift, petty cash, absensi, riwayat payroll & kasbon di SEMUA cabang barbershop ini akan DIHAPUS PERMANEN. Saldo wallet pelanggan, layanan, dan staff TIDAK terpengaruh.\n\nLanjutkan?`
      )
    )
      return;
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc('superadmin_reset_tenant', { target_tenant_id: tenant.id });
    if (rpcError) {
      setListError(`Gagal reset barbershop: ${rpcError.message}`);
      return;
    }
    setSuccess(`Barbershop "${tenant.name}" berhasil direset (data operasional semua cabang dihapus).`);
    router.refresh();
  };

  return (
    <div className="space-y-8">
      {/* Add new tenant */}
      <div className="glass-panel p-6 rounded-2xl">
        <div className="flex items-center gap-2 mb-4">
          <Plus className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Daftarkan Barbershop Baru</h2>
        </div>

        <div className="mb-4">
          <label className="block text-xs text-gray-400 mb-1">Cari Akun Pemilik (nama/no. HP)</label>
          {selectedOwner ? (
            <div className="flex items-center justify-between gap-2 bg-white/5 border border-[var(--border)] rounded-xl p-3">
              <div>
                <p className="text-sm font-medium">{selectedOwner.full_name ?? 'Tanpa nama'}</p>
                <p className="text-xs text-gray-400">
                  {selectedOwner.phone ?? '-'} · Role saat ini: {selectedOwner.role}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedOwner(null)} aria-label="Hapus pilihan" className="text-gray-400 hover:text-white">
                <UserX className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <UserSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                type="text"
                value={ownerQuery}
                onChange={(e) => setOwnerQuery(e.target.value)}
                placeholder="Cari akun yang sudah pernah login (calon owner)..."
                className="w-full bg-white/5 border border-[var(--border)] rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-primary transition-colors"
              />
              {(searchingOwner || ownerResults.length > 0) && ownerQuery.trim() && (
                <div className="absolute z-10 mt-1 w-full bg-slate-800 border border-[var(--border)] rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  {searchingOwner && <p className="px-3 py-2 text-xs text-gray-500">Mencari...</p>}
                  {!searchingOwner && ownerResults.length === 0 && (
                    <p className="px-3 py-2 text-xs text-gray-500">
                      Tidak ditemukan. Minta calon klien login Google dulu ke situs ini, baru bisa dicari di sini.
                    </p>
                  )}
                  {ownerResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedOwner(c);
                        setOwnerQuery('');
                        setOwnerResults([]);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors"
                    >
                      <p className="font-medium">{c.full_name ?? 'Tanpa nama'}</p>
                      <p className="text-xs text-gray-400">
                        {c.phone ?? '-'} · Role: {c.role}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Nama Barbershop</label>
            <input
              type="text"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              placeholder="mis. Gagah Barbershop"
              className="w-full bg-white/5 border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Slug (URL identifier)</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => {
                setSlug(slugify(e.target.value));
                setSlugTouched(true);
              }}
              placeholder="gagah-barbershop"
              className="w-full bg-white/5 border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Nama Outlet Pertama</label>
            <input
              type="text"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="mis. Cabang Pusat"
              className="w-full bg-white/5 border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Alamat Outlet (opsional)</label>
            <input
              type="text"
              value={branchAddress}
              onChange={(e) => setBranchAddress(e.target.value)}
              placeholder="Alamat lengkap"
              className="w-full bg-white/5 border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
        {success && (
          <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 mb-3">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={submitting}
          className="inline-flex items-center gap-1.5 bg-primary hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          {submitting ? 'Mendaftarkan...' : 'Daftarkan Barbershop'}
        </button>
      </div>

      {/* Tenant list */}
      <div className="glass-panel p-6 rounded-2xl">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Semua Barbershop ({tenants.length})</h2>
        </div>
        {listError && <p className="text-xs text-red-400 mb-3">{listError}</p>}
        <p className="text-xs text-gray-500 mb-4">
          Klik ikon pensil buat ganti nama barbershop, atau klik jumlah outlet buat lihat & ganti nama tiap cabang.
        </p>
        {tenants.length === 0 ? (
          <p className="text-sm text-gray-400">Belum ada barbershop terdaftar.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 bg-white/5">
                  <th className="px-4 py-3 font-medium">Nama</th>
                  <th className="px-4 py-3 font-medium">Slug</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Outlet</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Terdaftar</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <Fragment key={t.id}>
                    <tr className="border-t border-[var(--border)]">
                      <td className="px-4 py-3 font-medium">
                        {editingTenantId === t.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={tenantNameDraft}
                              onChange={(e) => setTenantNameDraft(e.target.value)}
                              autoFocus
                              className="bg-white/5 border border-primary rounded-lg px-2 py-1 text-sm focus:outline-none w-40"
                            />
                            <button
                              type="button"
                              onClick={() => saveTenantName(t.id)}
                              disabled={savingTenant}
                              aria-label="Simpan nama barbershop"
                              className="text-green-400 hover:text-green-300 disabled:opacity-50"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingTenantId(null)}
                              aria-label="Batal"
                              className="text-gray-500 hover:text-gray-300"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 group">
                            <span>{t.name}</span>
                            <button
                              type="button"
                              onClick={() => startEditTenant(t)}
                              aria-label="Ganti nama barbershop"
                              className="text-gray-600 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">{t.slug}</td>
                      <td className="px-4 py-3 text-gray-300">
                        {t.owner?.full_name ?? 'Tanpa nama'}
                        <span className="text-gray-500"> · {t.owner?.phone ?? '-'}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        <button
                          type="button"
                          onClick={() => setExpandedTenantId(expandedTenantId === t.id ? null : t.id)}
                          className="inline-flex items-center gap-1 hover:text-primary transition-colors"
                        >
                          {expandedTenantId === t.id ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                          {t.branches.length} outlet
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleStatus(t)}
                          title={t.status === 'active' ? 'Klik untuk menonaktifkan' : 'Klik untuk mengaktifkan'}
                          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-colors ${
                            t.status === 'active'
                              ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                              : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                          }`}
                        >
                          <Power className="h-3 w-3" />
                          {t.status === 'active' ? 'Aktif' : 'Nonaktif'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{formatDate(t.created_at)}</td>
                    </tr>
                    {expandedTenantId === t.id && (
                      <tr className="border-t border-[var(--border)] bg-white/[0.02]">
                        <td colSpan={6} className="px-4 py-3">
                          {t.branches.length === 0 ? (
                            <p className="text-xs text-gray-500 pl-6">Belum ada outlet.</p>
                          ) : (
                            <ul className="space-y-1.5 pl-6">
                              {t.branches.map((b) => (
                                <li key={b.id} className="flex items-center gap-1.5 text-sm">
                                  {editingBranchId === b.id ? (
                                    <>
                                      <input
                                        type="text"
                                        value={branchNameDraft}
                                        onChange={(e) => setBranchNameDraft(e.target.value)}
                                        autoFocus
                                        className="bg-white/5 border border-primary rounded-lg px-2 py-1 text-sm focus:outline-none w-40"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => saveBranchName(b.id)}
                                        disabled={savingBranch}
                                        aria-label="Simpan nama outlet"
                                        className="text-green-400 hover:text-green-300 disabled:opacity-50"
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingBranchId(null)}
                                        aria-label="Batal"
                                        className="text-gray-500 hover:text-gray-300"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-gray-300">{b.name}</span>
                                      <button
                                        type="button"
                                        onClick={() => startEditBranch(b)}
                                        aria-label="Ganti nama outlet"
                                        className="text-gray-600 hover:text-primary"
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => resetBranch(b.id, b.name)}
                                        aria-label="Reset data operasional outlet"
                                        title="Reset data operasional (transaksi, booking, shift, absensi)"
                                        className="text-gray-600 hover:text-amber-400"
                                      >
                                        <RotateCcw className="h-3 w-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => deleteBranch(b.id, b.name)}
                                        aria-label="Hapus outlet"
                                        className="text-gray-600 hover:text-red-400"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="flex items-center gap-2 pl-6 mt-3">
                            <MapPin className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                            <input
                              type="text"
                              value={newBranchName}
                              onChange={(e) => setNewBranchName(e.target.value)}
                              placeholder="Nama outlet baru"
                              className="bg-white/5 border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-primary w-44"
                            />
                            <input
                              type="text"
                              value={newBranchAddress}
                              onChange={(e) => setNewBranchAddress(e.target.value)}
                              placeholder="Alamat (opsional)"
                              className="bg-white/5 border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-primary w-52"
                            />
                            <button
                              type="button"
                              onClick={() => addBranch(t)}
                              disabled={!newBranchName.trim() || addingBranchToTenantId === t.id}
                              className="inline-flex items-center gap-1 bg-primary hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              {addingBranchToTenantId === t.id ? 'Menambah...' : 'Tambah Cabang'}
                            </button>
                          </div>

                          <div className="pl-6 mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between gap-3 flex-wrap">
                            <p className="text-xs text-gray-500 max-w-md">
                              Reset barbershop menghapus semua transaksi, booking, shift, petty cash, absensi, riwayat
                              payroll &amp; kasbon di seluruh cabang. Saldo wallet, layanan, dan staff tidak terpengaruh.
                            </p>
                            <button
                              type="button"
                              onClick={() => resetTenant(t)}
                              className="inline-flex items-center gap-1.5 border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shrink-0"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Reset Seluruh Barbershop
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
