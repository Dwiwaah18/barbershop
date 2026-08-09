import { MapPin, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function BranchesPage() {
  const mockBranches = [
    { id: 1, name: 'Senopati Branch', status: 'Open', distance: '1.2 km' },
    { id: 2, name: 'Kemang Branch', status: 'Busy', distance: '3.5 km' },
    { id: 3, name: 'Tebet Branch', status: 'Open', distance: '5.0 km' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
      <h1 className="text-4xl font-bold mb-2">Select a Branch</h1>
      <p className="text-gray-400 mb-8">Choose a location near you to book an appointment.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockBranches.map((branch) => (
          <div key={branch.id} className="glass-panel p-6 rounded-2xl flex flex-col group hover:border-primary/50 transition-colors">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-primary/20 p-3 rounded-full">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${branch.status === 'Open' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                {branch.status}
              </span>
            </div>
            <h3 className="text-2xl font-bold mb-1">{branch.name}</h3>
            <p className="text-gray-400 mb-6">{branch.distance} away</p>
            <Link href="/booking" className="mt-auto w-full inline-flex items-center justify-center px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors font-medium border border-[var(--border)]">
              Select Branch <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
