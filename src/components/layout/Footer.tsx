import { Scissors } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] glass mt-auto">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <Scissors className="h-5 w-5 text-primary" />
          <span className="font-bold tracking-tight">System<span className="text-primary">Barbershop</span></span>
        </div>
        <p className="text-sm text-gray-400">
          &copy; {new Date().getFullYear()} System Barbershop. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
