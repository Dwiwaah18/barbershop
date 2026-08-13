'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ShoppingBag, CreditCard, Banknote, QrCode, Minus, X, UserSearch, UserX } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Service } from '@/lib/supabase/types';

type CartLine = {
  serviceId: string;
  name: string;
  price: number;
  quantity: number;
};

type CustomerResult = { id: string; full_name: string | null; phone: string | null; effective_balance: number };
type PaymentMethod = 'cash' | 'qris' | 'deposit';

type Receipt = {
  transactionId: string;
  branchName: string;
  cashierName: string;
  customerName: string | null;
  paymentMethod: PaymentMethod;
  items: CartLine[];
  subtotal: number;
  paidAt: string;
};

const formatRupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

const paymentMethodLabel: Record<PaymentMethod, string> = {
  cash: 'Cash',
  qris: 'QRIS',
  deposit: 'Deposit',
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PosClient({
  services,
  branchId,
  cashierId,
  cashierName,
  branchName,
  qrisImageUrl,
}: {
  services: Service[];
  branchId: string;
  cashierId: string;
  cashierName: string;
  branchName: string;
  qrisImageUrl: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerResult[]>([]);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredServices = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) => s.name.toLowerCase().includes(q));
  }, [services, query]);

  const subtotal = useMemo(
    () => cart.reduce((sum, line) => sum + line.price * line.quantity, 0),
    [cart]
  );

  // Auto-print the receipt as soon as a transaction is confirmed. The small delay lets the
  // printable markup (rendered via CSS print: variants) paint before the print dialog opens.
  useEffect(() => {
    if (!receipt) return;
    const timer = setTimeout(() => window.print(), 150);
    return () => clearTimeout(timer);
  }, [receipt]);

  const depositInsufficient =
    paymentMethod === 'deposit' && selectedCustomer !== null && selectedCustomer.effective_balance < subtotal;

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    const q = customerQuery.trim();
    if (!q) {
      setCustomerResults([]);
      return;
    }
    searchDebounce.current = setTimeout(async () => {
      setSearchingCustomer(true);
      const supabase = createClient();
      const { data } = await supabase
        .from('customer_effective_wallet')
        .select('id, full_name, phone, effective_balance')
        .eq('role', 'customer')
        .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(8);
      setCustomerResults((data as CustomerResult[] | null) ?? []);
      setSearchingCustomer(false);
    }, 300);
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, [customerQuery]);

  const addToCart = (service: Service) => {
    setSuccessMessage(null);
    setCart((prev) => {
      const existing = prev.find((l) => l.serviceId === service.id);
      if (existing) {
        return prev.map((l) =>
          l.serviceId === service.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [...prev, { serviceId: service.id, name: service.name, price: service.price, quantity: 1 }];
    });
  };

  const decrementLine = (serviceId: string) => {
    setCart((prev) =>
      prev
        .map((l) => (l.serviceId === serviceId ? { ...l, quantity: l.quantity - 1 } : l))
        .filter((l) => l.quantity > 0)
    );
  };

  const removeLine = (serviceId: string) => {
    setCart((prev) => prev.filter((l) => l.serviceId !== serviceId));
  };

  const selectCustomer = (customer: CustomerResult) => {
    setSelectedCustomer(customer);
    setCustomerQuery('');
    setCustomerResults([]);
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    if (paymentMethod === 'deposit') setPaymentMethod('cash');
  };

  const choosePaymentMethod = (method: PaymentMethod) => {
    if (method === 'deposit' && !selectedCustomer) {
      setError('Pilih pelanggan dulu untuk bayar pakai Deposit.');
      return;
    }
    setError(null);
    setPaymentMethod(method);
  };

  const handleProcessPayment = async () => {
    if (cart.length === 0 || submitting) return;
    if (paymentMethod === 'deposit' && (!selectedCustomer || depositInsufficient)) return;

    setSubmitting(true);
    setError(null);

    const supabase = createClient();

    if (paymentMethod === 'deposit' && selectedCustomer) {
      const { error: redeemError } = await supabase.from('wallet_transactions').insert({
        profile_id: selectedCustomer.id,
        type: 'redeem',
        amount: subtotal,
        status: 'verified',
        verified_by: cashierId,
      });
      if (redeemError) {
        setError(
          redeemError.message.includes('insufficient')
            ? 'Saldo deposit pelanggan tidak cukup.'
            : 'Gagal memotong saldo deposit. Coba lagi.'
        );
        setSubmitting(false);
        return;
      }
    }

    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        branch_id: branchId,
        cashier_id: cashierId,
        customer_id: selectedCustomer?.id ?? null,
        subtotal,
        discount: 0,
        deposit_used: paymentMethod === 'deposit' ? subtotal : 0,
        total: subtotal,
        payment_method: paymentMethod,
        status: 'paid',
      })
      .select()
      .single();

    if (txError || !transaction) {
      setError('Saldo sudah terpotong tapi transaksi gagal tersimpan. Hubungi admin.');
      setSubmitting(false);
      return;
    }

    const { error: itemsError } = await supabase.from('transaction_items').insert(
      cart.map((line) => ({
        transaction_id: transaction.id,
        service_id: line.serviceId,
        name: line.name,
        price: line.price,
        quantity: line.quantity,
      }))
    );

    if (itemsError) {
      setError('Transaksi tersimpan tapi item gagal disimpan. Hubungi admin.');
      setSubmitting(false);
      return;
    }

    setSuccessMessage(`Transaksi berhasil, total ${formatRupiah(subtotal)}`);
    setReceipt({
      transactionId: transaction.id,
      branchName,
      cashierName,
      customerName: selectedCustomer?.full_name ?? null,
      paymentMethod,
      items: cart,
      subtotal,
      paidAt: new Date().toISOString(),
    });
    setCart([]);
    setSelectedCustomer(null);
    setPaymentMethod('cash');
    setSubmitting(false);
    router.refresh();
  };

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 print:hidden">
      {/* Left Side: Product/Service Selection */}
      <div className="lg:col-span-2 space-y-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search services or retail products..."
            className="w-full bg-white/5 border border-[var(--border)] rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {services.length === 0 ? (
          <div className="glass-panel p-6 rounded-xl text-gray-400 text-center">
            Belum ada layanan/produk di cabang ini
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="glass-panel p-6 rounded-xl text-gray-400 text-center">
            Tidak ada layanan yang cocok dengan pencarian.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {filteredServices.map((service) => (
              <button
                key={service.id}
                type="button"
                onClick={() => addToCart(service)}
                className="glass-panel p-4 rounded-xl cursor-pointer hover:border-primary transition-colors flex flex-col justify-between h-24 text-left"
              >
                <p className="font-medium text-sm leading-tight">{service.name}</p>
                <p className="text-primary font-bold text-sm">{formatRupiah(service.price)}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right Side: Cart & Payment */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col h-[calc(100vh-12rem)]">
        <div className="flex items-center gap-2 border-b border-[var(--border)] pb-4 mb-4">
          <ShoppingBag className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Current Order</h2>
        </div>

        {successMessage && (
          <div className="mb-4 flex items-start justify-between gap-2 bg-green-500/10 border border-green-500/30 text-green-400 text-sm rounded-xl p-3">
            <div>
              <p>{successMessage}</p>
              {receipt && (
                <button type="button" onClick={() => window.print()} className="underline text-xs mt-1">
                  Cetak Ulang Struk
                </button>
              )}
            </div>
            <button type="button" onClick={() => setSuccessMessage(null)} className="shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl p-3">
            {error}
          </div>
        )}

        {/* Customer lookup */}
        <div className="mb-4">
          {selectedCustomer ? (
            <div className="flex items-center justify-between gap-2 bg-white/5 border border-[var(--border)] rounded-xl p-3">
              <div>
                <p className="text-sm font-medium">{selectedCustomer.full_name ?? 'Tanpa nama'}</p>
                <p className="text-xs text-gray-400">Saldo: {formatRupiah(selectedCustomer.effective_balance)}</p>
              </div>
              <button type="button" onClick={clearCustomer} aria-label="Hapus pelanggan" className="text-gray-400 hover:text-white">
                <UserX className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <UserSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                type="text"
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                placeholder="Cari pelanggan (nama/telepon) untuk redeem deposit..."
                className="w-full bg-white/5 border border-[var(--border)] rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-primary transition-colors"
              />
              {(searchingCustomer || customerResults.length > 0) && customerQuery.trim() && (
                <div className="absolute z-10 mt-1 w-full bg-slate-800 border border-[var(--border)] rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  {searchingCustomer && (
                    <p className="px-3 py-2 text-xs text-gray-500">Mencari...</p>
                  )}
                  {!searchingCustomer && customerResults.length === 0 && (
                    <p className="px-3 py-2 text-xs text-gray-500">Tidak ditemukan.</p>
                  )}
                  {customerResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectCustomer(c)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors"
                    >
                      <p className="font-medium">{c.full_name ?? 'Tanpa nama'}</p>
                      <p className="text-xs text-gray-400">{c.phone ?? '-'} · Saldo {formatRupiah(c.effective_balance)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
          {cart.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Keranjang kosong. Pilih layanan di sebelah kiri.</p>
          ) : (
            cart.map((line) => (
              <div key={line.serviceId} className="flex justify-between items-start gap-2">
                <div>
                  <p className="font-medium">{line.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => decrementLine(line.serviceId)}
                      className="p-0.5 rounded bg-white/10 hover:bg-white/20 transition-colors"
                      aria-label={`Kurangi ${line.name}`}
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-xs text-gray-400">{line.quantity}x</span>
                    <button
                      type="button"
                      onClick={() => removeLine(line.serviceId)}
                      className="p-0.5 rounded bg-white/10 hover:bg-white/20 transition-colors"
                      aria-label={`Hapus ${line.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <p className="font-semibold whitespace-nowrap">{formatRupiah(line.price * line.quantity)}</p>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-[var(--border)] pt-4 mt-4 space-y-3">
          <div className="flex justify-between text-sm text-gray-400">
            <span>Subtotal</span>
            <span>{formatRupiah(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-primary">
            <span>Discount (Promo Code)</span>
            <span>- Rp 0</span>
          </div>
          <div className="flex justify-between font-bold text-xl pt-2 border-t border-[var(--border)]">
            <span>Total</span>
            <span className="text-primary">{formatRupiah(subtotal)}</span>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="grid grid-cols-3 gap-2 mt-6">
          <button
            type="button"
            onClick={() => choosePaymentMethod('cash')}
            className={`flex flex-col items-center justify-center py-3 rounded-xl border transition-colors ${
              paymentMethod === 'cash' ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-[var(--border)] hover:border-primary/50'
            }`}
          >
            <Banknote className="h-5 w-5 mb-1" />
            <span className="text-xs">Cash</span>
          </button>
          <button
            type="button"
            onClick={() => choosePaymentMethod('qris')}
            className={`flex flex-col items-center justify-center py-3 rounded-xl border transition-colors ${
              paymentMethod === 'qris' ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-[var(--border)] hover:border-primary/50'
            }`}
          >
            <QrCode className="h-5 w-5 mb-1 text-blue-400" />
            <span className="text-xs">QRIS</span>
          </button>
          <button
            type="button"
            onClick={() => choosePaymentMethod('deposit')}
            title={!selectedCustomer ? 'Pilih pelanggan dulu' : undefined}
            className={`flex flex-col items-center justify-center py-3 rounded-xl border transition-colors ${
              paymentMethod === 'deposit'
                ? 'bg-primary/20 border-primary text-primary'
                : 'bg-white/5 border-[var(--border)] hover:border-primary/50'
            }`}
          >
            <CreditCard className="h-5 w-5 mb-1" />
            <span className="text-xs">Deposit</span>
          </button>
        </div>
        {depositInsufficient && (
          <p className="text-xs text-red-400 mt-2">Saldo pelanggan tidak cukup untuk total ini.</p>
        )}

        {paymentMethod === 'qris' && (
          <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-[var(--border)] bg-white/5 p-4">
            {qrisImageUrl ? (
              <>
                <div className="w-40 h-40 bg-white rounded-lg p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrisImageUrl} alt="QRIS pembayaran" className="w-full h-full object-contain" />
                </div>
                <p className="text-xs text-gray-400">Tunjukkan QR ini ke pelanggan untuk scan &amp; bayar.</p>
              </>
            ) : (
              <p className="text-xs text-amber-400 text-center">
                Gambar QRIS belum diatur untuk barbershop ini. Owner bisa mengunggahnya di menu Kelola Cabang.
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={handleProcessPayment}
          disabled={cart.length === 0 || submitting || (paymentMethod === 'deposit' && (!selectedCustomer || depositInsufficient))}
          className="w-full mt-4 bg-primary hover:bg-amber-700 text-white font-bold py-3 rounded-xl transition-transform active:scale-95 shadow-lg shadow-amber-900/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          {submitting ? 'Memproses...' : 'Process Payment'}
        </button>
      </div>
    </div>

    {/* Printable receipt — hidden on screen, shown only via the print: variant when window.print() fires */}
    {receipt && (
      <div className="hidden print:block max-w-xs mx-auto text-black text-sm font-mono">
        <div className="text-center mb-3">
          <p className="font-bold text-base">{receipt.branchName}</p>
          <p>Struk Transaksi</p>
        </div>
        <div className="border-t border-dashed border-black pt-2 mb-2">
          <p>Tanggal: {formatDateTime(receipt.paidAt)}</p>
          <p>Kasir: {receipt.cashierName}</p>
          <p>Pelanggan: {receipt.customerName ?? 'Walk-in'}</p>
          <p>No. Transaksi: {receipt.transactionId.slice(0, 8)}</p>
        </div>
        <div className="border-t border-dashed border-black pt-2 mb-2 space-y-1">
          {receipt.items.map((line) => (
            <div key={line.serviceId} className="flex justify-between gap-2">
              <span>
                {line.name} x{line.quantity}
              </span>
              <span>{formatRupiah(line.price * line.quantity)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-dashed border-black pt-2 space-y-1">
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>{formatRupiah(receipt.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Bayar ({paymentMethodLabel[receipt.paymentMethod]})</span>
            <span>{formatRupiah(receipt.subtotal)}</span>
          </div>
        </div>
        <p className="text-center mt-4">Terima kasih!</p>
      </div>
    )}
    </>
  );
}
