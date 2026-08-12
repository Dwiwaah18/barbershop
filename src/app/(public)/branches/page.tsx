import { MapPin, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_TENANT_SLUG, getTenantBySlug } from '@/lib/supabase/tenant';
import type { Branch } from '@/lib/supabase/types';

export default async function BranchesPage() {
  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, DEFAULT_TENANT_SLUG);

  const { data } = tenant
    ? await supabase.from('branches').select('*').eq('tenant_id', tenant.id).order('name')
    : { data: null };
  const branches = (data ?? []) as Branch[];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
      <h1 className="text-4xl font-bold mb-2">Select a Branch</h1>
      <p className="text-gray-400 mb-8">Choose a location near you to book an appointment.</p>

      {branches.length === 0 ? (
        <div className="glass-panel rounded-2xl py-16 px-6 text-center text-gray-400">
          Belum ada cabang terdaftar
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {branches.map((branch) => (
            <div key={branch.id} className="glass-panel p-6 rounded-2xl flex flex-col group hover:border-primary/50 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div className="bg-primary/20 p-3 rounded-full">
                  <MapPin className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-1">{branch.name}</h3>
              <p className="text-gray-400 mb-6">{branch.address ?? 'Alamat belum tersedia'}</p>
              <Link href={`/booking?branch=${branch.id}`} className="mt-auto w-full inline-flex items-center justify-center px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors font-medium border border-[var(--border)]">
                Select Branch <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
