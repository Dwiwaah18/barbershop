import Link from 'next/link';
import { Scissors } from 'lucide-react';

export function Navbar() {
  return (
    <nav className="fixed top-0 w-full z-50 glass border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center gap-2 group">
              <Scissors className="h-6 w-6 text-primary group-hover:rotate-12 transition-transform duration-300" />
              <span className="font-bold text-xl tracking-tight">System<span className="text-primary">Barbershop</span></span>
            </Link>
          </div>
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-8">
              <Link href="/" className="hover:text-primary transition-colors px-3 py-2 rounded-md text-sm font-medium">Home</Link>
              <Link href="/booking" className="hover:text-primary transition-colors px-3 py-2 rounded-md text-sm font-medium">Booking</Link>
              <Link href="/dashboard" className="hover:text-primary transition-colors px-3 py-2 rounded-md text-sm font-medium">Dashboard</Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/profile" className="hidden md:flex hover:text-primary transition-colors px-3 py-2 rounded-md text-sm font-medium">Profile</Link>
            <Link href="/auth" className="bg-primary hover:bg-amber-700 text-primary-foreground px-4 py-2 rounded-md text-sm font-medium transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-amber-900/20">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
