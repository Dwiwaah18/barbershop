import { Wallet, Users, History } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/supabase/current-profile';
import type { Profile, WalletTransaction } from '@/lib/supabase/types';
import AddFamilyButton from './add-family-button';

const formatRupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

const walletTxLabel: Record<WalletTransaction['type'], string> = {
  topup: 'Top Up Saldo',
  redeem: 'Pemakaian Saldo',
  refund: 'Refund',
  adjustment: 'Penyesuaian',
};

const walletTxStatusLabel: Record<WalletTransaction['status'], string> = {
  pending: 'Menunggu',
  verified: 'Terverifikasi',
  rejected: 'Ditolak',
};

const walletTxStatusClass: Record<WalletTransaction['status'], string> = {
  pending: 'bg-amber-500/20 text-amber-400',
  verified: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
};

export default async function ProfilePage() {
  const current = await getCurrentProfile();
  if (!current) redirect('/auth');

  const { userId, profile } = current;
  const supabase = await createClient();

  const headId = profile.family_id ?? userId;

  const [{ data: familyData }, { data: walletTxData }] = await Promise.all([
    supabase.from('profiles').select('*').or(`id.eq.${headId},family_id.eq.${headId}`),
    supabase
      .from('wallet_transactions')
      .select('*')
      .eq('profile_id', userId)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const familyMembers = (familyData as Profile[] | null) ?? [];
  const walletTransactions = (walletTxData as WalletTransaction[] | null) ?? [];

  // Shared wallet: saldo yang ditampilkan & dipakai adalah saldo dompet keluarga (kepala keluarga),
  // bukan saldo pribadi baris ini. Anggota keluarga berbagi satu dompet — lihat wallet_head_id di schema.
  const headProfile = familyMembers.find((m) => m.id === headId);
  const sharedBalance = headProfile?.wallet_balance ?? profile.wallet_balance;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
      <h1 className="text-4xl font-bold mb-8">My Profile</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* Wallet Section */}
        <div className="glass-panel p-8 rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-bl-full -mr-10 -mt-10 blur-2xl"></div>
          <div className="flex items-center gap-3 mb-6">
            <Wallet className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-semibold">Shared Wallet</h2>
          </div>
          <p className="text-gray-400 text-sm mb-1">Available Balance</p>
          <h3 className="text-5xl font-extrabold mb-6 tracking-tighter">
            <span className="text-2xl align-top text-gray-500 mr-1">Rp</span>
            {Math.round(sharedBalance).toLocaleString('id-ID')}
          </h3>
          <Link href="/deposit" className="w-full inline-flex justify-center items-center px-4 py-3 bg-primary hover:bg-amber-600 rounded-xl font-bold transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-amber-900/30">
            Top Up Balance
          </Link>
        </div>

        {/* Family Account Section */}
        <div className="glass-panel p-8 rounded-3xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-semibold">Family Members</h2>
            </div>
            <AddFamilyButton />
          </div>

          <div className="space-y-4">
            {familyMembers.length <= 1 && (
              <p className="text-sm text-gray-400 mb-2">Belum ada anggota keluarga lain</p>
            )}
            {familyMembers.map((member) => {
              const isHead = member.id === headId;
              const name = member.full_name ?? 'Tanpa nama';
              const initial = name.charAt(0).toUpperCase();
              return (
                <div key={member.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                  <div className="flex items-center gap-3">
                    <div
                      className={
                        isHead
                          ? 'w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold'
                          : 'w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center font-bold text-blue-400'
                      }
                    >
                      {initial}
                    </div>
                    <div>
                      <p className="font-medium">
                        {name}
                        {isHead ? ' (Main)' : ''}
                      </p>
                      <p className="text-xs text-gray-400">{member.phone ?? 'Tidak ada nomor'}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="glass-panel p-8 rounded-3xl">
        <div className="flex items-center gap-3 mb-6">
          <History className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">Recent Transactions</h2>
        </div>
        <div className="space-y-4">
          {walletTransactions.length === 0 && (
            <p className="text-sm text-gray-400">Belum ada transaksi</p>
          )}
          {walletTransactions.map((tx) => {
            const isTopup = tx.type === 'topup';
            const date = new Date(tx.created_at).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });
            return (
              <div key={tx.id} className="flex justify-between items-center border-b border-[var(--border)] pb-4">
                <div>
                  <p className="font-medium">{walletTxLabel[tx.type]}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm text-gray-400">{date}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${walletTxStatusClass[tx.status]}`}>
                      {walletTxStatusLabel[tx.status]}
                    </span>
                  </div>
                </div>
                <p className={`font-bold ${isTopup ? 'text-green-400' : 'text-red-400'}`}>
                  {isTopup ? '+' : '-'}
                  {formatRupiah(tx.amount)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
