'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="hidden md:flex hover:text-primary transition-colors px-3 py-2 rounded-md text-sm font-medium"
    >
      Sign Out
    </button>
  );
}
