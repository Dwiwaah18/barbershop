import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/supabase/current-profile';
import { getSignedImageUrl } from '@/lib/supabase/storage-server';
import type { Profile, WalletTransaction } from '@/lib/supabase/types';
import TopupList from './topup-list';

export type PendingTopup = WalletTransaction & { customerName: string; proofSignedUrl: string | null };

export default async function TopupsPage() {
  const current = await getCurrentProfile();

  if (!current) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Verifikasi Top-up</h1>
        <div className="glass-panel p-6 rounded-2xl text-gray-400">
          Anda harus login untuk mengakses halaman ini.
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  const { data: pendingRows } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('status', 'pending')
    .eq('type', 'topup')
    .order('created_at', { ascending: true });

  const pending = (pendingRows as WalletTransaction[] | null) ?? [];

  const customerIds = [...new Set(pending.map((tx) => tx.profile_id))];
  let profileById = new Map<string, Profile>();
  if (customerIds.length > 0) {
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('*')
      .in('id', customerIds);
    profileById = new Map(((profileRows as Profile[] | null) ?? []).map((p) => [p.id, p]));
  }

  const pendingWithNames: PendingTopup[] = await Promise.all(
    pending.map(async (tx) => ({
      ...tx,
      customerName: profileById.get(tx.profile_id)?.full_name ?? 'Pelanggan',
      proofSignedUrl: tx.proof_url ? await getSignedImageUrl(tx.proof_url) : null,
    }))
  );

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Verifikasi Top-up</h1>
      <p className="text-gray-400 mb-8">
        Cocokkan bukti transfer pelanggan dengan mutasi rekening/QRIS sebelum menyetujui.
      </p>
      <TopupList items={pendingWithNames} verifierId={current.userId} />
    </div>
  );
}
