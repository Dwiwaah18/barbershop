// Pesan kosong bersama untuk halaman owner: bedakan "superadmin belum pilih barbershop" vs
// "barbershop ini memang belum punya cabang".
export function ManagedBranchEmpty({ needsTenantSelection }: { needsTenantSelection: boolean }) {
  return (
    <div className="glass-panel p-6 rounded-2xl text-gray-400">
      {needsTenantSelection
        ? 'Pilih dulu barbershop yang mau dikelola lewat dropdown "Barbershop Aktif" di kiri atas sidebar.'
        : 'Belum ada cabang untuk barbershop ini. Tambahkan lewat menu Kelola Cabang.'}
    </div>
  );
}
