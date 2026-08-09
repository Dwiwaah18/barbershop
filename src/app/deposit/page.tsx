import { QrCode, UploadCloud, ShieldCheck } from 'lucide-react';

export default function DepositPage() {
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

        <div className="bg-white/5 border border-[var(--border)] rounded-2xl p-6 mb-8 text-center">
          <h3 className="font-medium mb-4">Choose Amount</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {['50.000', '100.000', '250.000', '500.000'].map(amount => (
              <button key={amount} className="py-2 rounded-xl border border-[var(--border)] hover:border-primary hover:bg-primary/10 transition-colors">
                Rp {amount}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-medium">Upload Payment Proof</h3>
          <div className="border-2 border-dashed border-[var(--border)] hover:border-primary transition-colors rounded-2xl p-10 text-center cursor-pointer flex flex-col items-center justify-center group">
            <div className="bg-primary/20 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
              <UploadCloud className="h-8 w-8 text-primary" />
            </div>
            <p className="font-medium mb-1">Click to upload screenshot</p>
            <p className="text-sm text-gray-400">JPG, PNG up to 5MB</p>
          </div>
          
          <div className="flex items-start gap-3 text-sm text-amber-200/70 bg-amber-900/20 p-4 rounded-xl mt-6">
            <ShieldCheck className="h-5 w-5 shrink-0" />
            <p>Your top-up will be manually verified by our cashier before it appears in your Shared Wallet. Usually takes &lt; 5 minutes during operational hours.</p>
          </div>

          <button className="w-full mt-4 bg-primary hover:bg-amber-700 text-white font-bold py-4 rounded-xl transition-transform active:scale-95 shadow-lg shadow-amber-900/20">
            Submit Payment Proof
          </button>
        </div>
      </div>
    </div>
  );
}
