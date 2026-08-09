PRODUCT REQUIREMENTS DOCUMENT (PRD)
Nama Produk: Sistem Manajemen Barbershop All-in-One (Ultimate Enterprise & Secure Edition)
Platform: Web App (Pelanggan) & Web Dashboard/POS (Internal/Multi-Tenant)
Disusun oleh: Dwi Wahyudi
Tanggal Pembaruan: 9 Agustus 2026

1. Product Vision & Objective
Visi Produk:
Membangun ekosistem operasional barbershop end-to-end berskala multi-outlet yang sangat aman (Google Authentication & Multi-Tenant Isolation), transparan, otomatis (marketing, membership, deposit & re-engagement), serta dilengkapi analitik bisnis tingkat lanjut (Peak Hour & Retention Analytics) untuk memberikan kendali penuh kepada pengembang dan pemilik usaha.

Metrik Keberhasilan (Objectives):

Menjamin keamanan data akun pelanggan dan saldo deposit uang melalui integrasi Google Sign-In.

Menekan potensi kecurangan operasional (fraud) hingga 0% melalui sistem Audit Trail dan otorisasi Owner.

Meningkatkan repeat order dan retensi pelanggan hingga 40% lewat otomasi WhatsApp re-engagement, Loyalty Stamp Card, dan VIP Subscription.

Memastikan efisiensi penjadwalan kapster berdasarkan data operasional jam sibuk (Peak Hour Analytics).

2. User Roles & Access Control (Hak Akses Pengguna)
Sistem ini dirancang dengan hierarki Role-Based Access Control (RBAC) yang ketat:

Pengembang / Super Admin: Akses mutlak ke seluruh tingkat sistem (database Supabase, manajemen server, dan pemantauan lintas tenant).

Pemilik / Owner (Multi-Branch):

Dapat mengelola banyak cabang sekaligus dengan fitur Branch Switcher.

Self-Service Branch Creation: Menambah cabang baru secara mandiri; sistem Supabase otomatis menginisialisasi ruang data terisolasi untuk cabang tersebut.

Mengakses Business Intelligence (Peak Hour & Retention Analytics) serta menyetujui otorisasi kasir dan kasbon.

Kasir / Resepsionis (Branch-Level): Mengoperasikan POS, antrean, kas kecil, verifikasi pembayaran QRIS, validasi member/deposit keluarga, dan pencatatan transaksi.

Kapster / Barber (Branch-Level): Melakukan absensi berbasis geofencing/selfie, melihat jadwal, mengajukan tukar shift atau kasbon, serta memantau perolehan komisi dan riwayat gajinya.

3. Core Features (Fitur Utama)
A. Modul Booking Web App & Pengalaman Pelanggan (Secure & Family)
Autentikasi Aman Berbasis Google Sign-In:

Pelanggan wajib melakukan Login with Google untuk masuk ke Web App. Hal ini memastikan keamanan data akun, nomor telepon, serta saldo deposit uang / dompet digital milik pelanggan dari risiko pembajakan.

Manajemen Akun Keluarga (Family Account & Shared Wallet):

Satu akun utama pelanggan (yang sudah login dengan Google) dapat mendaftarkan dan mengelola profil anggota keluarga (misal: Anak atau Anggota Keluarga Lain).

Saldo deposit uang atau poin loyalitas di dalam dompet digital dapat digunakan bersama (shared wallet) untuk membayar layanan keluarga dalam satu manajemen akun.

Live Barber Status (Real-time): Indikator 🟢 Free, 🔴 Busy, dan 🟡 Istirahat yang sinkron langsung dengan absensi dan aktivitas kasir.

Smart Add-ons (Upselling Otomatis): Rekomendasi layanan tambahan secara otomatis (e.g., + Cuci Rambut, + Hair Tonic, + Cukur Jenggot) saat memilih layanan utama.

Paket Langganan Bulanan / VIP & Deposit Saldo:

Fitur top-up saldo deposit uang dan paket langganan VIP (bebas cukur dalam periode waktu tertentu) yang divalidasi langsung oleh sistem saat booking atau check-in di kasir.

Ulasan & Rating via Barcode: Pemindaian QR Code pada struk digital/fisik untuk memberikan ulasan bintang 1-5 bagi kapster.

B. Modul POS Kasir & Transaksi Lanjutan (Per Outlet)
Manajemen Antrean Interaktif & Trigger Status: Sinkronisasi instan antara booking online dan walk-in.

Multi-Item Cart, Deposit Redemption & Promo: Penggabungan jasa, produk ritel, pemotongan saldo deposit keluarga, serta penerapan kode promo/diskon.

Petty Cash & Expense Tracker: Pencatatan pengeluaran harian langsung dari laci kasir untuk keperluan operasional mendesak.

Shift Management & Reconciliation: Fitur Open/Close Register harian untuk pencocokan fisik uang tunai.

C. Modul Dashboard Pemilik & Business Intelligence (Analitik Lanjutan)
Peak Hour Analytics (Analisis Jam Sibuk):

Grafik visual di dashboard Owner yang memetakan jam-jam dan hari-hari tersibuk dalam seminggu berdasarkan data historis transaksi. Membantu Owner dalam menentukan penjadwalan shift kapster secara akurat agar tidak kekurangan tenaga kerja di jam padat.

Customer Retention Rate & Churned Report: Laporan otomatis persentase pelanggan yang kembali serta daftar pelanggan yang sudah lama tidak berkunjung.

Global & Branch Financial Analytics: Pemantauan omzet, laporan laba rugi, dan kas kecil yang dapat difilter per cabang.

D. Modul Keuangan & Kontrol Karyawan (Financial Control)
Manajemen Kasbon Karyawan (Employee Cash Advance): Fitur pengajuan pinjaman darurat oleh kapster yang memerlukan persetujuan Owner.

Pencatatan Gaji & Komisi Terdistribusi (Payroll Disbursal Tracking): Sistem perhitungan komisi otomatis (hybrid/persentase/flat), pelacakan status pembayaran gaji (Pending/Paid), serta pemotongan cicilan kasbon secara otomatis di akhir periode.

E. Keamanan & Pengawasan Kasir (Anti-Fraud & Audit Log)
Audit Trail / Log Aktivitas Kasir: Pencatatan otomatis setiap tindakan sensitif (pembatalan transaksi/void, diskon manual, pembukaan laci paksa).

Otorisasi Owner (Manager Approval): Sistem meminta PIN khusus atau persetujuan jarak jauh kepada Owner untuk tindakan di luar batas wajar.

F. Manajemen Inventaris, HR & Otomasi CRM
Stock Transfer Antar Cabang & Manajemen Aset: Pemindahan stok produk antar outlet serta pencatatan inventaris non-jual (kursi, alat cukur) beserta jadwal maintenance.

Absensi Berbasis Geofencing & Selfie Check-in: Clock-in/out kapster dengan validasi foto dan titik GPS.

WhatsApp Re-engagement (Auto-Reminder): Otomasi pengiriman pesan pengingat dan promosi berdasarkan siklus potong rambut pelanggan.

4. Technical & Integration Requirements
A. Arsitektur Database, Otentikasi & Keamanan (Supabase & Google Auth)
Supabase Auth (Google OAuth): Menggunakan integrasi login Google untuk mengamankan data pengguna, otorisasi sesi, serta perlindungan data dompet deposit finansial pelanggan.

Row Level Security (RLS): Menjamin isolasi data multi-tenant yang ketat antar Owner dan antar cabang.

B. Sistem Pembayaran & Deposit via QRIS Statis (Manual Verification)
Low Cost Operation: Tanpa Payment Gateway berbiaya MDR tinggi.

Upload QRIS Mandiri: Setiap Owner mengunggah barcode QRIS cabang mereka. Pelanggan mengunggah bukti transfer untuk top-up deposit atau pembayaran booking, yang kemudian divalidasi secara manual oleh kasir di sistem POS.

C. Real-Time Sync, WhatsApp API & Hardware
WebSockets / Real-Time Database: Sinkronisasi instan dua arah untuk Live Status kapster, antrean, validasi dompet keluarga, dan sistem otorisasi Owner.

WhatsApp API: Pengiriman notifikasi konfirmasi, reminder, re-engagement promo, struk digital ber-barcode ulasan, hingga pesan permohonan otorisasi kasir/kasbon.

Hardware Compatibility: Kompatibel dengan Tablet/PC untuk POS serta Bluetooth/USB Thermal Printer dan Cash Drawer.