import { Wallet, Users, Plus, History } from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
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
            250.000
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
            <button className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
              <Plus className="h-5 w-5" />
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold">M</div>
                <div>
                  <p className="font-medium">Me (Main)</p>
                  <p className="text-xs text-gray-400">+62 812 3456 7890</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center font-bold text-blue-400">J</div>
                <div>
                  <p className="font-medium">Jojo (Son)</p>
                  <p className="text-xs text-gray-400">Child Account</p>
                </div>
              </div>
            </div>
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
           <div className="flex justify-between items-center border-b border-[var(--border)] pb-4">
             <div>
               <p className="font-medium">Haircut - Senopati Branch</p>
               <p className="text-sm text-gray-400">Today, 14:00 (Jojo)</p>
             </div>
             <p className="font-bold text-red-400">-Rp 50.000</p>
           </div>
           <div className="flex justify-between items-center border-b border-[var(--border)] pb-4">
             <div>
               <p className="font-medium">Wallet Top-up</p>
               <p className="text-sm text-gray-400">Yesterday, 10:30</p>
             </div>
             <p className="font-bold text-green-400">+Rp 300.000</p>
           </div>
         </div>
      </div>
    </div>
  );
}
