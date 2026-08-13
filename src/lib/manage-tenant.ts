// Nama cookie "barbershop yang sedang dikelola superadmin". Dipisah ke modul tanpa dependensi
// server (next/headers) supaya aman diimpor dari komponen client maupun server.
export const MANAGE_TENANT_COOKIE = 'manage_tenant';

// Baca cookie dari sisi client (dipakai Dashboard yang berjalan di browser).
export function readManagedTenantIdClient(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${MANAGE_TENANT_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// Set cookie dari sisi client lalu (pemanggil) refresh halaman.
export function setManagedTenantIdClient(tenantId: string | null): void {
  if (typeof document === 'undefined') return;
  const base = `${MANAGE_TENANT_COOKIE}=`;
  if (tenantId) {
    document.cookie = `${base}${encodeURIComponent(tenantId)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
  } else {
    document.cookie = `${base}; path=/; max-age=0; samesite=lax`;
  }
}
