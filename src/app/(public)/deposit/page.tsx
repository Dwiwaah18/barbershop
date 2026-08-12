import { redirect } from 'next/navigation';
import { QrCode } from 'lucide-react';
import { getCurrentProfile } from '@/lib/supabase/current-profile';
import DepositForm from './deposit-form';

export default async function DepositPage() {
  const current = await getCurrentProfile();
  if (!current) redirect('/auth');

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
      <h1 className="text-4xl font-bold mb-8 text-center">Top Up Deposit</h1>

      <div className="glass-panel p-8 rounded-3xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-48 h-48 bg-white p-4 rounded-2xl mb-6 shadow-2xl">
            {/* Mock QR Code space */}
            <QrCode className="w-full h-full text-slate-800" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Scan to Pay (QRIS)</h2>
          <p className="text-gray-400">System Barbershop - PT Utama Sejahtera</p>
        </div>

        <DepositForm userId={current.userId} />
      </div>
    </div>
  );
}
