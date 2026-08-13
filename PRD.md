PRODUCT REQUIREMENTS DOCUMENT (PRD)
Nama Produk: Barbershop All-in-One SaaS Platform (Ultimate Enterprise & Secure Edition)
Platform: Web App (Pelanggan) & Web Dashboard/POS (Internal / Multi-Tenant SaaS)
Disusun oleh: Dwi Wahyudi
Tanggal Pembaruan: 9 Agustus 2026

1. Product Vision & Objective
Visi Produk:
Membangun ekosistem operasional barbershop end-to-end berbasis SaaS (Software as a Service) yang aman (Google Authentication & Supabase RLS), transparan, otomatis (marketing, membership, family shared wallet, & re-engagement), serta dilengkapi analitik bisnis tingkat lanjut (Peak Hour & Retention Analytics). Platform ini dirancang agar dapat digunakan sendiri maupun disewakan secara komersial ke jaringan barbershop lain dengan sistem manajemen langganan mandiri (self-service & auto-provisioning).

Metrik Keberhasilan (Objectives):

Menjamin keamanan data akun pelanggan dan saldo deposit uang melalui integrasi Google Sign-In.

Menekan potensi kecurangan operasional (fraud) hingga 0% melalui sistem Audit Trail dan otorisasi Owner.

Meningkatkan repeat order dan retensi pelanggan hingga 40% lewat otomasi WhatsApp re-engagement, Loyalty Stamp Card, dan VIP Subscription.

Memungkinkan monetisasi bisnis perangkat lunak (SaaS) melalui pengelolaan tenant dan penagihan langganan otomatis.

2. User Roles & Access Control (Hak Akses Pengguna)
Sistem ini dirancang dengan hierarki Role-Based Access Control (RBAC) dan Multi-Tenant Architecture:

Pengembang / Super Admin (Anda):

Akses mutlak ke seluruh tingkat sistem (database Supabase, manajemen server, dan pemantauan lintas tenant).

SaaS Management Dashboard: Memantau daftar seluruh barbershop klien yang berlangganan, status langganan (Active/Trial/Suspended), serta mengatur paket layanan SaaS.

Pemilik / Owner (Multi-Branch Tenant):

Dapat mengelola banyak cabang sekaligus dengan fitur Branch Switcher.

Self-Service Branch Creation: Menambah cabang baru secara mandiri; sistem Supabase otomatis menginisialisasi ruang data terisolasi untuk cabang tersebut.

Mengakses analitik bisnis (Peak Hour & Retention), menyetujui otorisasi kasir, kasbon, dan memantau status langganan SaaS mereka.

Kasir / Resepsionis (Branch-Level): Mengoperasikan POS, antrean, kas kecil, verifikasi pembayaran QRIS, validasi member/deposit keluarga, dan pencatatan transaksi.

Kapster / Barber (Branch-Level): Melakukan absensi berbasis geofencing/selfie, melihat jadwal, mengajukan tukar shift atau kasbon, serta memantau perolehan komisi dan riwayat gajinya.

3. Core Features (Fitur Utama)
A. Modul SaaS & Billing Engine (Untuk Pengembang / Super Admin)
Tenant Management & Provisioning: Sistem manajemen klien barbershop yang mendaftar ke platform Anda.

Auto-Provisioning Supabase: Ketika klien mendaftar dan memilih paket SaaS, sistem otomatis mengalokasikan ruang data terisolasi (isolated schema/tenant) tanpa intervensi manual.

Subscription & Billing Engine: Pengaturan masa aktif langganan (bulanan/tahunan).

Auto-Suspend System: Sistem otomatis menangguhkan (suspend) akses login Owner dan outlet jika masa langganan habis dan belum diperpanjang.

B. Modul Booking Web App & Pengalaman Pelanggan (Secure & Family)
Autentikasi Aman Berbasis Google Sign-In: Wajib Login with Google untuk mengamankan data akun, nomor telepon, dan saldo deposit uang / dompet digital pelanggan.

Manajemen Akun Keluarga (Family Account & Shared Wallet): Satu akun utama (Google) dapat mendaftarkan profil keluarga dan menggunakan saldo deposit atau poin loyalitas bersama (shared wallet).

Live Barber Status (Real-time): Indikator 🟢 Free, 🔴 Busy, dan 🟡 Istirahat yang sinkron langsung dengan absensi dan aktivitas kasir.

Smart Add-ons (Upselling Otomatis): Rekomendasi layanan tambahan secara otomatis (e.g., + Cuci Rambut, + Hair Tonic, + Cukur Jenggot) saat memilih layanan utama.

Paket Langganan Bulanan / VIP & Top-up Deposit: Validasi otomatis masa aktif langganan atau saldo deposit saat booking atau check-in di kasir.

Ulasan & Rating via Barcode: Pemindaian QR Code pada struk digital/fisik untuk memberikan ulasan bintang 1-5 bagi kapster.

C. Modul POS Kasir & Transaksi Lanjutan (Per Outlet)
Manajemen Antrean Interaktif & Trigger Status: Sinkronisasi instan antara booking online dan walk-in.

Multi-Item Cart, Deposit Redemption & Promo: Penggabungan jasa, produk ritel, pemotongan saldo deposit keluarga, serta penerapan kode promo/diskon.

Petty Cash & Expense Tracker: Pencatatan pengeluaran harian langsung dari laci kasir.

Shift Management & Reconciliation: Fitur Open/Close Register harian untuk pencocokan fisik uang tunai.

D. Modul Dashboard Pemilik & Business Intelligence (Analitik Lanjutan)
Peak Hour Analytics (Analisis Jam Sibuk): Grafik visual pemetaan jam/hari tersibuk untuk membantu penjadwalan shift kapster secara akurat.

Customer Retention Rate & Churned Report: Laporan otomatis persentase pelanggan yang kembali serta daftar pelanggan pasif.

Global & Branch Financial Analytics: Pemantauan omzet, laba rugi, dan kas kecil per cabang atau secara gabungan.

E. Modul Keuangan & Kontrol Karyawan (Financial Control)
Manajemen Kasbon Karyawan (Employee Cash Advance): Fitur pengajuan pinjaman darurat oleh kapster dengan persetujuan Owner.

Pencatatan Gaji & Komisi Terdistribusi (Payroll Disbursal Tracking): Sistem perhitungan komisi otomatis, pelacakan status pembayaran gaji (Pending/Paid), serta pemotongan cicilan kasbon secara otomatis di akhir periode.

F. Keamanan & Pengawasan Kasir (Anti-Fraud & Audit Log)
Audit Trail / Log Aktivitas Kasir: Pencatatan otomatis setiap tindakan sensitif (pembatalan transaksi/void, diskon manual, pembukaan laci paksa).

Otorisasi Owner (Manager Approval): Sistem meminta PIN khusus atau persetujuan jarak jauh kepada Owner untuk tindakan di luar batas wajar.

G. Manajemen Inventaris, HR & Otomasi CRM
Stock Transfer Antar Cabang & Manajemen Aset: Pemindahan stok produk antar outlet serta pencatatan inventaris non-jual beserta jadwal maintenance.

Absensi Berbasis Geofencing & Selfie Check-in: Clock-in/out kapster dengan validasi foto dan titik GPS.

WhatsApp Re-engagement (Auto-Reminder): Otomasi pengiriman pesan pengingat dan promosi berdasarkan siklus potong rambut pelanggan.

4. Technical & Integration Requirements
A. Arsitektur Database, Otentikasi & Keamanan (Supabase, Multi-Tenant RLS & Google Auth)
Supabase Auth (Google OAuth): Mengamankan data pengguna dan perlindungan data dompet deposit finansial pelanggan.

Row Level Security (RLS) & Multi-Tenant Isolation: Menjamin isolasi data ketat antar Tenant (Owner) dan antar cabang, di mana data tiap barbershop terpisah secara mandiri dan aman.

B. Sistem Pembayaran & Deposit via QRIS Statis (Manual Verification)
Low Cost Operation: Tanpa Payment Gateway berbiaya MDR tinggi.

Upload QRIS Mandiri: Setiap Owner mengunggah barcode QRIS cabang mereka di dashboard untuk keperluan top-up deposit atau pembayaran booking, yang divalidasi manual oleh kasir di POS.

C. Real-Time Sync, WhatsApp API & Hardware
WebSockets / Real-Time Database: Sinkronisasi instan dua arah untuk Live Status kapster, antrean, validasi dompet keluarga, dan sistem otorisasi Owner.

WhatsApp API: Pengiriman notifikasi konfirmasi, reminder, re-engagement promo, struk digital ber-barcode ulasan, hingga pesan permohonan otorisasi kasir/kasbon.

Hardware Compatibility: Kompatibel dengan Tablet/PC untuk POS serta Bluetooth/USB Thermal Printer dan Cash Drawer.