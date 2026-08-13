'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';

export default function AddFamilyButton() {
  const [showNote, setShowNote] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setShowNote((v) => !v)}
        className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"
        aria-label="Tambah anggota keluarga"
      >
        <Plus className="h-5 w-5" />
      </button>
      {showNote && (
        <div className="absolute right-0 top-full mt-2 w-56 p-3 rounded-xl bg-black/90 border border-[var(--border)] text-xs text-gray-300 shadow-lg z-10">
          Untuk menggabungkan akun keluarga (shared wallet), minta bantuan kasir/owner di kasir barbershop.
        </div>
      )}
    </div>
  );
}
