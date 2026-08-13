'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, Percent, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { commissionTypeLabel } from '@/lib/commission-calc';
import type { CommissionTier, CommissionType, Service } from '@/lib/supabase/types';
import type { BranchOption } from './page';

const formatRupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

const ALL_COMMISSION_TYPES: CommissionType[] = ['percent', 'fixed', 'salary', 'tiered', 'net_percent'];

type FormState = { name: string; price: string; duration: string; isAddon: boolean; fixedCommission: string; costPrice: string };
const EMPTY_FORM: FormState = { name: '', price: '', duration: '30', isAddon: false, fixedCommission: '', costPrice: '' };

export default function ServicesManager({ branches }: { branches: BranchOption[] }) {
  const [branchId, setBranchId] = useState(branches[0].id);
  const [branchSettings, setBranchSettings] = useState<Record<string, { commissionType: CommissionType; commissionPercent: string }>>(
    () =>
      Object.fromEntries(
        branches.map((b) => [b.id, { commissionType: b.commission_type, commissionPercent: String(b.commission_percent) }])
      )
  );
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [newService, setNewService] = useState<FormState>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<FormState>(EMPTY_FORM);
  const [rowBusy, setRowBusy] = useState<Set<string>>(new Set());
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const [tiers, setTiers] = useState<CommissionTier[]>([]);
  const [tiersLoading, setTiersLoading] = useState(true);
  const [tierMinServices, setTierMinServices] = useState('');
  const [tierPercent, setTierPercent] = useState('');
  const [addingTier, setAddingTier] = useState(false);
  const [tierError, setTierError] = useState<string | null>(null);
  const [tierBusy, setTierBusy] = useState<Set<string>>(new Set());

  const currentSettings = branchSettings[branchId];
  const commissionType = currentSettings.commissionType;
  const showFixedColumn = commissionType === 'fixed';
  const showCostColumn = commissionType === 'net_percent';
  const showPercentInput = commissionType === 'percent' || commissionType === 'net_percent';

  const loadServices = async (forBranchId: string) => {
    setLoading(true);
    setListError(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('branch_id', forBranchId)
      .order('is_addon', { ascending: true })
      .order('name', { ascending: true });
    if (error) setListError('Gagal memuat layanan.');
    setServices((data as Service[] | null) ?? []);
    setLoading(false);
  };

  const loadTiers = async (forBranchId: string) => {
    setTiersLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('commission_tiers')
      .select('*')
      .eq('branch_id', forBranchId)
      .order('min_services', { ascending: true });
    setTiers((data as CommissionTier[] | null) ?? []);
    setTiersLoading(false);
  };

  useEffect(() => {
    loadServices(branchId);
    loadTiers(branchId);
    setEditingId(null);
    setSettingsSaved(false);
    setSettingsError(null);
    setTierError(null);
  }, [branchId]);

  const setBusy = (id: string, on: boolean) => {
    setRowBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleSaveSettings = async () => {
    const percent = Number(currentSettings.commissionPercent);
    if (showPercentInput && (Number.isNaN(percent) || percent < 0 || percent > 100)) {
      setSettingsError('Persentase komisi harus antara 0-100.');
      return;
    }
    setSavingSettings(true);
    setSettingsError(null);
    setSettingsSaved(false);
    const supabase = createClient();
    const { error } = await supabase
      .from('branches')
      .update({
        commission_type: commissionType,
        commission_percent: showPercentInput ? percent : 0,
      })
      .eq('id', branchId);
    setSavingSettings(false);
    if (error) {
      setSettingsError('Gagal menyimpan pengaturan komisi.');
      return;
    }
    setSettingsSaved(true);
  };

  const handleAddTier = async () => {
    const minServices = Number(tierMinServices);
    const percent = Number(tierPercent);
    if (!minServices || minServices <= 0 || !Number.isInteger(minServices)) {
      setTierError('Jumlah layanan minimal harus bilangan bulat > 0.');
      return;
    }
    if (Number.isNaN(percent) || percent < 0 || percent > 100) {
      setTierError('Persentase tier harus antara 0-100.');
      return;
    }
    setAddingTier(true);
    setTierError(null);
    const supabase = createClient();
    const { error } = await supabase.from('commission_tiers').insert({
      branch_id: branchId,
      min_services: minServices,
      commission_percent: percent,
    });
    setAddingTier(false);
    if (error) {
      setTierError('Gagal menambah tier.');
      return;
    }
    setTierMinServices('');
    setTierPercent('');
    loadTiers(branchId);
  };

  const handleDeleteTier = async (id: string) => {
    setTierBusy((prev) => new Set(prev).add(id));
    const supabase = createClient();
    await supabase.from('commission_tiers').delete().eq('id', id);
    loadTiers(branchId);
  };

  const handleCreate = async () => {
    const price = Number(newService.price);
    const duration = Number(newService.duration);
    const fixedCommission = newService.fixedCommission.trim() === '' ? null : Number(newService.fixedCommission);
    const costPrice = newService.costPrice.trim() === '' ? null : Number(newService.costPrice);
    if (!newService.name.trim()) {
      setCreateError('Nama layanan wajib diisi.');
      return;
    }
    if (!price || price <= 0) {
      setCreateError('Harga harus lebih dari 0.');
      return;
    }
    if (!duration || duration <= 0) {
      setCreateError('Durasi harus lebih dari 0 menit.');
      return;
    }
    if (fixedCommission !== null && (Number.isNaN(fixedCommission) || fixedCommission < 0)) {
      setCreateError('Komisi tetap tidak valid.');
      return;
    }
    if (costPrice !== null && (Number.isNaN(costPrice) || costPrice < 0)) {
      setCreateError('Modal tidak valid.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    const supabase = createClient();
    const { error } = await supabase.from('services').insert({
      branch_id: branchId,
      name: newService.name.trim(),
      price,
      duration_minutes: duration,
      is_addon: newService.isAddon,
      fixed_commission: fixedCommission,
      cost_price: costPrice,
    });
    setCreating(false);
    if (error) {
      setCreateError('Gagal menambah layanan. Coba lagi.');
      return;
    }
    setNewService(EMPTY_FORM);
    loadServices(branchId);
  };

  const startEdit = (s: Service) => {
    setEditingId(s.id);
    setEditDraft({
      name: s.name,
      price: String(s.price),
      duration: String(s.duration_minutes),
      isAddon: s.is_addon,
      fixedCommission: s.fixed_commission === null ? '' : String(s.fixed_commission),
      costPrice: s.cost_price === null ? '' : String(s.cost_price),
    });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id: string) => {
    const price = Number(editDraft.price);
    const duration = Number(editDraft.duration);
    const fixedCommission = editDraft.fixedCommission.trim() === '' ? null : Number(editDraft.fixedCommission);
    const costPrice = editDraft.costPrice.trim() === '' ? null : Number(editDraft.costPrice);
    if (!editDraft.name.trim() || !price || price <= 0 || !duration || duration <= 0) {
      setRowError((prev) => ({ ...prev, [id]: 'Data tidak valid.' }));
      return;
    }
    if (fixedCommission !== null && (Number.isNaN(fixedCommission) || fixedCommission < 0)) {
      setRowError((prev) => ({ ...prev, [id]: 'Komisi tetap tidak valid.' }));
      return;
    }
    if (costPrice !== null && (Number.isNaN(costPrice) || costPrice < 0)) {
      setRowError((prev) => ({ ...prev, [id]: 'Modal tidak valid.' }));
      return;
    }
    setBusy(id, true);
    setRowError((prev) => ({ ...prev, [id]: '' }));
    const supabase = createClient();
    const { error } = await supabase
      .from('services')
      .update({
        name: editDraft.name.trim(),
        price,
        duration_minutes: duration,
        is_addon: editDraft.isAddon,
        fixed_commission: fixedCommission,
        cost_price: costPrice,
      })
      .eq('id', id);
    setBusy(id, false);
    if (error) {
      setRowError((prev) => ({ ...prev, [id]: 'Gagal menyimpan.' }));
      return;
    }
    setEditingId(null);
    loadServices(branchId);
  };

  const handleDelete = async (id: string) => {
    setBusy(id, true);
    setRowError((prev) => ({ ...prev, [id]: '' }));
    const supabase = createClient();
    const { error } = await supabase.from('services').delete().eq('id', id);
    setBusy(id, false);
    if (error) {
      setRowError((prev) => ({ ...prev, [id]: 'Gagal menghapus (mungkin masih dipakai di booking/transaksi lama).' }));
      return;
    }
    loadServices(branchId);
  };

  const extraColumnCount = useMemo(() => (showFixedColumn || showCostColumn ? 1 : 0), [showFixedColumn, showCostColumn]);

  return (
    <div>
      {branches.length > 1 && (
        <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-xl border border-[var(--border)] w-fit mb-6">
          {branches.map((b) => (
            <button
              key={b.id}
              onClick={() => setBranchId(b.id)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                branchId === b.id ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      {/* Commission settings */}
      <div className="glass-panel p-6 rounded-2xl mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Percent className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold">Pengaturan Komisi Kapster</h2>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Skema Komisi</label>
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white/5 rounded-xl border border-[var(--border)] w-fit">
            {ALL_COMMISSION_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setBranchSettings((prev) => ({ ...prev, [branchId]: { ...prev[branchId], commissionType: type } }));
                  setSettingsSaved(false);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  commissionType === type ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {commissionTypeLabel[type]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4 mt-4">
          {showPercentInput && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Persentase (%)</label>
              <input
                type="number"
                value={currentSettings.commissionPercent}
                onChange={(e) => {
                  setBranchSettings((prev) => ({
                    ...prev,
                    [branchId]: { ...prev[branchId], commissionPercent: e.target.value },
                  }));
                  setSettingsSaved(false);
                }}
                className="w-28 bg-white/5 border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
          )}
          <button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="inline-flex items-center gap-1.5 bg-primary hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {savingSettings ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </div>

        {commissionType === 'fixed' && (
          <p className="text-xs text-gray-500 mt-3">
            Set nominal komisi tetap per layanan di tabel bawah (kolom &ldquo;Komisi Tetap&rdquo;).
          </p>
        )}
        {commissionType === 'net_percent' && (
          <p className="text-xs text-gray-500 mt-3">
            Set modal/biaya bahan per layanan di tabel bawah (kolom &ldquo;Modal&rdquo;) — komisi dihitung dari
            harga dikurangi modal.
          </p>
        )}
        {commissionType === 'salary' && (
          <p className="text-xs text-gray-500 mt-3">
            Set nominal gaji bulanan per kapster di{' '}
            <Link href="/staff" className="text-primary hover:underline">
              Staff Management
            </Link>
            .
          </p>
        )}
        {commissionType === 'tiered' && (
          <p className="text-xs text-gray-500 mt-3">Atur tier target di panel &ldquo;Tier Komisi&rdquo; di bawah.</p>
        )}
        {settingsError && <p className="text-xs text-red-400 mt-3">{settingsError}</p>}
        {settingsSaved && <p className="text-xs text-green-400 mt-3">Pengaturan komisi tersimpan.</p>}
      </div>

      {/* Tier editor */}
      {commissionType === 'tiered' && (
        <div className="glass-panel p-6 rounded-2xl mb-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">Tier Komisi</h2>
          </div>
          {tiersLoading ? (
            <p className="text-sm text-gray-500">Memuat tier...</p>
          ) : (
            <div className="space-y-2 mb-4">
              {tiers.length === 0 && (
                <p className="text-sm text-gray-400">Belum ada tier. Tambahkan minimal satu di bawah.</p>
              )}
              {tiers.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between bg-white/5 border border-[var(--border)] rounded-lg px-4 py-2.5"
                >
                  <span className="text-sm">
                    ≥ <span className="font-semibold">{t.min_services}</span> layanan dalam periode →{' '}
                    <span className="font-semibold text-primary">{t.commission_percent}%</span>
                  </span>
                  <button
                    onClick={() => handleDeleteTier(t.id)}
                    disabled={tierBusy.has(t.id)}
                    className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50"
                    aria-label="Hapus tier"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Minimal Layanan</label>
              <input
                type="number"
                value={tierMinServices}
                onChange={(e) => setTierMinServices(e.target.value)}
                placeholder="50"
                className="w-32 bg-white/5 border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Persentase (%)</label>
              <input
                type="number"
                value={tierPercent}
                onChange={(e) => setTierPercent(e.target.value)}
                placeholder="40"
                className="w-28 bg-white/5 border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <button
              onClick={handleAddTier}
              disabled={addingTier}
              className="inline-flex items-center gap-1.5 bg-primary hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4" />
              {addingTier ? 'Menambah...' : 'Tambah Tier'}
            </button>
          </div>
          {tierError && <p className="text-xs text-red-400 mt-3">{tierError}</p>}
        </div>
      )}

      {/* Add new service */}
      <div className="glass-panel p-6 rounded-2xl mb-6">
        <h2 className="text-lg font-semibold mb-4">Tambah Layanan / Add-on</h2>
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-400 mb-1">Nama</label>
            <input
              type="text"
              value={newService.name}
              onChange={(e) => setNewService((p) => ({ ...p, name: e.target.value }))}
              placeholder="mis. Hair Coloring"
              className="w-full bg-white/5 border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Harga (Rp)</label>
            <input
              type="number"
              value={newService.price}
              onChange={(e) => setNewService((p) => ({ ...p, price: e.target.value }))}
              placeholder="50000"
              className="w-full bg-white/5 border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Durasi (menit)</label>
            <input
              type="number"
              value={newService.duration}
              onChange={(e) => setNewService((p) => ({ ...p, duration: e.target.value }))}
              className="w-full bg-white/5 border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>
          {showFixedColumn && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Komisi Tetap (Rp)</label>
              <input
                type="number"
                value={newService.fixedCommission}
                onChange={(e) => setNewService((p) => ({ ...p, fixedCommission: e.target.value }))}
                placeholder="30000"
                className="w-full bg-white/5 border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
          )}
          {showCostColumn && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Modal (Rp)</label>
              <input
                type="number"
                value={newService.costPrice}
                onChange={(e) => setNewService((p) => ({ ...p, costPrice: e.target.value }))}
                placeholder="15000"
                className="w-full bg-white/5 border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={newService.isAddon}
                onChange={(e) => setNewService((p) => ({ ...p, isAddon: e.target.checked }))}
                className="w-4 h-4 accent-primary"
              />
              Add-on
            </label>
          </div>
        </div>
        {createError && <p className="text-xs text-red-400 mt-3">{createError}</p>}
        <button
          onClick={handleCreate}
          disabled={creating}
          className="mt-4 inline-flex items-center gap-1.5 bg-primary hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          {creating ? 'Menambah...' : 'Tambah'}
        </button>
      </div>

      {/* List */}
      {listError && <p className="text-sm text-red-400 mb-4">{listError}</p>}
      {loading ? (
        <p className="text-gray-500 text-sm">Memuat layanan...</p>
      ) : services.length === 0 ? (
        <div className="glass-panel p-6 rounded-2xl text-center text-gray-400">
          Belum ada layanan di cabang ini.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 bg-white/5">
                <th className="px-4 py-3 font-medium">Nama</th>
                <th className="px-4 py-3 font-medium">Tipe</th>
                <th className="px-4 py-3 font-medium">Harga</th>
                <th className="px-4 py-3 font-medium">Durasi</th>
                {showFixedColumn && <th className="px-4 py-3 font-medium">Komisi Tetap</th>}
                {showCostColumn && <th className="px-4 py-3 font-medium">Modal</th>}
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => {
                const isEditing = editingId === s.id;
                return (
                  <Fragment key={s.id}>
                  <tr className="border-t border-[var(--border)]">
                    {isEditing ? (
                      <>
                        <td className="px-4 py-2.5">
                          <input
                            value={editDraft.name}
                            onChange={(e) => setEditDraft((p) => ({ ...p, name: e.target.value }))}
                            className="w-full bg-white/10 border border-[var(--border)] rounded-lg px-2 py-1"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <label className="flex items-center gap-1.5 text-xs">
                            <input
                              type="checkbox"
                              checked={editDraft.isAddon}
                              onChange={(e) => setEditDraft((p) => ({ ...p, isAddon: e.target.checked }))}
                              className="w-3.5 h-3.5 accent-primary"
                            />
                            Add-on
                          </label>
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number"
                            value={editDraft.price}
                            onChange={(e) => setEditDraft((p) => ({ ...p, price: e.target.value }))}
                            className="w-24 bg-white/10 border border-[var(--border)] rounded-lg px-2 py-1"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number"
                            value={editDraft.duration}
                            onChange={(e) => setEditDraft((p) => ({ ...p, duration: e.target.value }))}
                            className="w-20 bg-white/10 border border-[var(--border)] rounded-lg px-2 py-1"
                          />
                        </td>
                        {showFixedColumn && (
                          <td className="px-4 py-2.5">
                            <input
                              type="number"
                              value={editDraft.fixedCommission}
                              onChange={(e) => setEditDraft((p) => ({ ...p, fixedCommission: e.target.value }))}
                              placeholder="0"
                              className="w-24 bg-white/10 border border-[var(--border)] rounded-lg px-2 py-1"
                            />
                          </td>
                        )}
                        {showCostColumn && (
                          <td className="px-4 py-2.5">
                            <input
                              type="number"
                              value={editDraft.costPrice}
                              onChange={(e) => setEditDraft((p) => ({ ...p, costPrice: e.target.value }))}
                              placeholder="0"
                              className="w-24 bg-white/10 border border-[var(--border)] rounded-lg px-2 py-1"
                            />
                          </td>
                        )}
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <button
                            onClick={() => saveEdit(s.id)}
                            disabled={rowBusy.has(s.id)}
                            className="p-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-50 mr-1.5"
                            aria-label="Simpan"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1.5 rounded-lg bg-white/10 text-gray-300 hover:bg-white/20"
                            aria-label="Batal"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-medium">{s.name}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              s.is_addon ? 'bg-blue-500/20 text-blue-400' : 'bg-white/10 text-gray-300'
                            }`}
                          >
                            {s.is_addon ? 'Add-on' : 'Utama'}
                          </span>
                        </td>
                        <td className="px-4 py-3 tabular-nums">{formatRupiah(s.price)}</td>
                        <td className="px-4 py-3 text-gray-400">{s.duration_minutes} mnt</td>
                        {showFixedColumn && (
                          <td className="px-4 py-3 tabular-nums text-primary">
                            {s.fixed_commission ? formatRupiah(s.fixed_commission) : '-'}
                          </td>
                        )}
                        {showCostColumn && (
                          <td className="px-4 py-3 tabular-nums text-gray-300">
                            {s.cost_price ? formatRupiah(s.cost_price) : '-'}
                          </td>
                        )}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => startEdit(s)}
                            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 mr-1.5"
                            aria-label={`Edit ${s.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(s.id)}
                            disabled={rowBusy.has(s.id)}
                            className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50"
                            aria-label={`Hapus ${s.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                  {rowError[s.id] && (
                    <tr>
                      <td colSpan={4 + extraColumnCount + 1} className="px-4 pb-2 text-xs text-red-400">
                        {rowError[s.id]}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
