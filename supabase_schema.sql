-- Skema Database untuk Supabase SQL Editor
-- Dijalankan sekali, urut dari atas ke bawah, di project baru yang masih kosong.

-- Custom Types
CREATE TYPE public.user_role AS ENUM ('superadmin', 'owner', 'cashier', 'barber', 'customer');
CREATE TYPE public.booking_status AS ENUM ('pending', 'approved', 'confirmed', 'completed', 'cancelled');
CREATE TYPE public.barber_status AS ENUM ('free', 'busy', 'break');
CREATE TYPE public.commission_type AS ENUM ('percent', 'fixed', 'salary', 'tiered', 'net_percent');
CREATE TYPE public.tenant_status AS ENUM ('active', 'suspended');

-- Table: tenants (satu baris = satu barbershop/klien SaaS. Multi-tenant Phase 1: tenant_id sudah
-- ada di branches, tapi isolasi data pelanggan/wallet antar tenant belum ditegakkan di RLS —
-- itu Phase 2. Phase 1 cuma bikin superadmin bisa mendaftarkan tenant baru + outlet pertamanya.)
CREATE TABLE public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    owner_id UUID, -- FK ke profiles ditambahkan setelah tabel profiles dibuat
    status public.tenant_status NOT NULL DEFAULT 'active',
    -- Gambar QRIS barbershop (data URL base64) yang di-upload owner, ditampilkan di halaman Top Up
    -- share wallet & POS. Per-tenant supaya tiap barbershop pakai QRIS-nya sendiri.
    qris_image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: branches
CREATE TABLE public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id),
    name TEXT NOT NULL,
    address TEXT,
    owner_id UUID, -- FK ke profiles ditambahkan setelah tabel profiles dibuat
    commission_type public.commission_type NOT NULL DEFAULT 'percent',
    commission_percent DECIMAL(5,2) NOT NULL DEFAULT 40.00, -- dipakai kalau commission_type = 'percent'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: profiles (Berelasi dengan auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    phone TEXT,
    role public.user_role DEFAULT 'customer',
    branch_id UUID REFERENCES public.branches(id), -- Untuk staff
    wallet_balance DECIMAL(12,2) DEFAULT 0.00,
    family_id UUID REFERENCES public.profiles(id), -- Shared wallet head
    barber_status public.barber_status,
    monthly_salary DECIMAL(12,2), -- dipakai kalau branch.commission_type = 'salary'; NULL = 0
    -- Independen dari `role` — staff role apa pun (termasuk owner) bisa juga jadi kapster aktif
    -- (booking, Live Kapster Status, walk-in queue, absensi, payroll komisi). Lihat
    -- public_barber_status view dan admin_set_staff_role di bawah.
    is_working_barber BOOLEAN NOT NULL DEFAULT false,
    -- Tenant (barbershop) yang "memiliki" pelanggan ini — NULL sampai mereka pertama kali
    -- interaksi (booking/transaksi/verifikasi topup) dengan salah satu tenant, lalu sticky
    -- (first-write-wins, lihat trigger di bawah). Isolasi lintas-tenant Phase 2 ditegakkan
    -- lewat kolom ini + RLS, bukan lewat query aplikasi.
    tenant_id UUID REFERENCES public.tenants(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.branches ADD CONSTRAINT branches_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id);
ALTER TABLE public.tenants ADD CONSTRAINT tenants_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id);

-- Table: services
CREATE TABLE public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.branches(id),
    name TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    duration_minutes INT NOT NULL,
    is_addon BOOLEAN DEFAULT false,
    fixed_commission DECIMAL(10,2), -- dipakai kalau branch.commission_type = 'fixed'; NULL = 0
    cost_price DECIMAL(10,2), -- dipakai kalau branch.commission_type = 'net_percent'; NULL = 0
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: commission_tiers (dipakai kalau branch.commission_type = 'tiered' — komisi naik
-- berdasarkan jumlah layanan yang diselesaikan kapster dalam periode payroll)
CREATE TABLE public.commission_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    min_services INT NOT NULL,
    commission_percent DECIMAL(5,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Mengaktifkan RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_tiers ENABLE ROW LEVEL SECURITY;

-- Helper functions (SECURITY DEFINER agar query di dalamnya tidak memicu ulang
-- RLS pada `profiles` — dipakai oleh SEMUA policy di bawah, termasuk milik
-- `profiles` sendiri, supaya tidak terjadi infinite recursion).
CREATE OR REPLACE FUNCTION public.current_role()
RETURNS public.user_role
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_branch_id()
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT branch_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_family_id()
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT family_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Shared wallet: SEMUA uang wallet satu keluarga disimpan di baris "kepala keluarga". Fungsi ini
-- me-resolve profil mana pun ke pemilik dompetnya — anggota (punya family_id) → kepala keluarga;
-- kepala keluarga / pelanggan tanpa keluarga → dirinya sendiri. Dipakai di trigger wallet, RPC
-- penyelesaian booking, dan view saldo efektif supaya redeem/topup selalu mengenai satu dompet.
CREATE OR REPLACE FUNCTION public.wallet_head_id(target_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SET search_path = public AS $$
    SELECT COALESCE((SELECT family_id FROM public.profiles WHERE id = target_id), target_id)
$$;

CREATE OR REPLACE FUNCTION public.is_branch_owner(target_branch_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM public.branches WHERE id = target_branch_id AND owner_id = auth.uid())
$$;

-- Resolves ANY staff/owner profile's tenant: owner -> the tenant they own directly; staff
-- (cashier/barber) -> the tenant of their primary branch. Takes an explicit id (not just
-- auth.uid()) so triggers can resolve tenant from e.g. NEW.verified_by, not just the caller.
CREATE OR REPLACE FUNCTION public.tenant_id_for_staff(staff_id uuid)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT COALESCE(
        (SELECT t.id FROM public.tenants t WHERE t.owner_id = staff_id),
        (SELECT b.tenant_id FROM public.profiles p JOIN public.branches b ON b.id = p.branch_id WHERE p.id = staff_id)
    )
$$;

-- The calling staff/owner's own tenant — used throughout Phase 2 RLS to scope what they can see.
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT public.tenant_id_for_staff(auth.uid())
$$;

-- Table: staff_branch_assignments (satu staff bisa ditugaskan ke banyak cabang, di luar
-- "cabang utama" di profiles.branch_id yang tetap dipertahankan untuk kompatibilitas mundur
-- — dipakai sebagai default & untuk field NOT NULL seperti attendances.branch_id).
CREATE TABLE public.staff_branch_assignments (
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    PRIMARY KEY (profile_id, branch_id)
);
ALTER TABLE public.staff_branch_assignments ENABLE ROW LEVEL SECURITY;

-- True kalau target_branch_id adalah cabang utama ATAU salah satu cabang tambahan user ini.
CREATE OR REPLACE FUNCTION public.is_staff_branch(target_branch_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT target_branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.staff_branch_assignments
            WHERE profile_id = auth.uid() AND branch_id = target_branch_id
        )
$$;

-- Semua cabang yang boleh dioperasikan user saat ini (cabang utama + assignment tambahan).
CREATE OR REPLACE FUNCTION public.my_staff_branch_ids()
RETURNS SETOF uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT branch_id FROM public.profiles WHERE id = auth.uid() AND branch_id IS NOT NULL
    UNION
    SELECT branch_id FROM public.staff_branch_assignments WHERE profile_id = auth.uid()
$$;

CREATE POLICY "Staff view own branch assignments" ON public.staff_branch_assignments FOR SELECT
    USING (profile_id = auth.uid());
CREATE POLICY "Owner manages staff branch assignments" ON public.staff_branch_assignments FOR ALL
    USING (public.is_branch_owner(branch_id))
    WITH CHECK (public.is_branch_owner(branch_id));

-- Semua orang bisa melihat cabang
CREATE POLICY "Branches viewable by everyone" ON public.branches FOR SELECT USING (true);

-- Owner mengatur setting komisi cabang miliknya (commission_type, commission_percent)
CREATE POLICY "Owner updates own branch settings" ON public.branches FOR UPDATE
    USING (public.is_branch_owner(id)) WITH CHECK (public.is_branch_owner(id));

-- Policy: tenants (superadmin platform-wide, owner cuma lihat tenant miliknya sendiri)
CREATE POLICY "Superadmin manages tenants" ON public.tenants FOR ALL
    USING (public.current_role() = 'superadmin') WITH CHECK (public.current_role() = 'superadmin');
CREATE POLICY "Owner views own tenant" ON public.tenants FOR SELECT
    USING (owner_id = auth.uid());
-- Phase 3: public /toko/{slug} pages need anon read access to resolve slug -> tenant. Only
-- 'active' tenants are visible this way — a superadmin can hide a tenant's public pages entirely
-- by flipping status to 'suspended' (their internal dashboard still works via the policy above).
CREATE POLICY "Active tenants viewable by everyone" ON public.tenants FOR SELECT
    USING (status = 'active');

-- Superadmin juga perlu INSERT langsung ke branches saat mendaftarkan outlet pertama tenant baru
-- (dipakai oleh RPC superadmin_create_tenant di bawah — RPC-nya SECURITY DEFINER jadi sebenarnya
-- bypass RLS, tapi policy ini tetap ditambahkan untuk konsistensi kalau suatu saat superadmin
-- perlu insert/kelola branch langsung dari client, bukan cuma lewat RPC).
CREATE POLICY "Superadmin manages all branches" ON public.branches FOR ALL
    USING (public.current_role() = 'superadmin') WITH CHECK (public.current_role() = 'superadmin');

-- RPC: superadmin mendaftarkan tenant (barbershop klien) baru + outlet pertamanya sekaligus, dan
-- menaikkan role profil yang dipilih jadi 'owner' (tidak menimpa kalau sudah owner/superadmin).
-- Profil ownernya harus sudah pernah login (dibuat otomatis oleh handle_new_user trigger) — sistem
-- ini tidak punya service-role admin client untuk membuat akun auth.users langsung dari sini.
CREATE OR REPLACE FUNCTION public.superadmin_create_tenant(
    tenant_slug TEXT,
    tenant_name TEXT,
    owner_profile_id UUID,
    first_branch_name TEXT,
    first_branch_address TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    IF COALESCE(public.current_role()::text, '') != 'superadmin' THEN
        RAISE EXCEPTION 'not authorized';
    END IF;

    INSERT INTO public.tenants (slug, name, owner_id)
    VALUES (tenant_slug, tenant_name, owner_profile_id)
    RETURNING id INTO v_tenant_id;

    UPDATE public.profiles SET role = 'owner'
    WHERE id = owner_profile_id AND role NOT IN ('owner', 'superadmin');

    INSERT INTO public.branches (tenant_id, name, address, owner_id)
    VALUES (v_tenant_id, first_branch_name, first_branch_address, owner_profile_id);

    RETURN v_tenant_id;
END;
$$;

-- RPC: owner menambah cabang ke-2/ke-3/dst untuk tenant miliknya sendiri, tanpa perlu lewat
-- superadmin (superadmin_create_tenant di atas cuma bikin cabang pertama saat tenant baru
-- didaftarkan). tenant_id & owner_id diambil dari tenant si caller sendiri — sengaja tidak jadi
-- parameter, supaya klien yang di-compromise tidak bisa nyuntik branch ke tenant_id orang lain.
CREATE OR REPLACE FUNCTION public.owner_create_branch(branch_name TEXT, branch_address TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_owner_id UUID;
    v_branch_id UUID;
BEGIN
    IF COALESCE(public.current_role()::text, '') NOT IN ('owner', 'superadmin') THEN
        RAISE EXCEPTION 'not authorized';
    END IF;

    v_tenant_id := public.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'no tenant found for this account';
    END IF;

    SELECT owner_id INTO v_owner_id FROM public.tenants WHERE id = v_tenant_id;

    INSERT INTO public.branches (tenant_id, name, address, owner_id)
    VALUES (v_tenant_id, branch_name, branch_address, v_owner_id)
    RETURNING id INTO v_branch_id;

    RETURN v_branch_id;
END;
$$;

-- RPC: set gambar QRIS sebuah barbershop. Owner hanya boleh mengatur barbershop miliknya sendiri;
-- superadmin boleh mengatur barbershop mana pun (mis. saat membantu setup klien).
CREATE OR REPLACE FUNCTION public.set_tenant_qris_image(target_tenant_id uuid, image_data_url text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_owner uuid;
BEGIN
    IF COALESCE(public.current_role()::text, '') NOT IN ('owner', 'superadmin') THEN
        RAISE EXCEPTION 'not authorized';
    END IF;
    IF public.current_role() = 'owner' THEN
        SELECT owner_id INTO v_owner FROM public.tenants WHERE id = target_tenant_id;
        IF v_owner IS DISTINCT FROM auth.uid() THEN
            RAISE EXCEPTION 'not your barbershop';
        END IF;
    END IF;
    UPDATE public.tenants SET qris_image_url = image_data_url WHERE id = target_tenant_id;
END;
$$;

-- RPC: superadmin menghapus sebuah cabang. Sengaja MENOLAK penghapusan kalau cabang punya riwayat
-- keuangan/operasional (transaksi, booking, shift, absensi) atau masih ada staff dengan cabang utama
-- ini — melindungi data yang tidak boleh hilang. Cabang "bersih" (mis. salah buat) boleh dihapus:
-- konfigurasinya (layanan, tier komisi, penugasan cabang tambahan) ikut dibersihkan.
CREATE OR REPLACE FUNCTION public.superadmin_delete_branch(target_branch_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    IF COALESCE(public.current_role()::text, '') <> 'superadmin' THEN
        RAISE EXCEPTION 'not authorized';
    END IF;

    IF EXISTS (SELECT 1 FROM public.transactions WHERE branch_id = target_branch_id)
       OR EXISTS (SELECT 1 FROM public.bookings WHERE branch_id = target_branch_id)
       OR EXISTS (SELECT 1 FROM public.shifts WHERE branch_id = target_branch_id)
       OR EXISTS (SELECT 1 FROM public.attendances WHERE branch_id = target_branch_id) THEN
        RAISE EXCEPTION 'cabang ini punya riwayat transaksi/booking/shift/absensi — tidak bisa dihapus demi keamanan data';
    END IF;

    IF EXISTS (SELECT 1 FROM public.profiles WHERE branch_id = target_branch_id) THEN
        RAISE EXCEPTION 'masih ada staff dengan cabang utama ini — pindahkan dulu di Staff Management';
    END IF;

    -- Bersihkan konfigurasi yang mereferensikan cabang (kalau tidak, DELETE branch akan FK-error).
    DELETE FROM public.services WHERE branch_id = target_branch_id;
    DELETE FROM public.commission_tiers WHERE branch_id = target_branch_id;
    DELETE FROM public.staff_branch_assignments WHERE branch_id = target_branch_id;

    BEGIN
        DELETE FROM public.branches WHERE id = target_branch_id;
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE EXCEPTION 'cabang masih terhubung ke data lain — tidak bisa dihapus';
    END;
END;
$$;

-- RPC: superadmin me-RESET data OPERASIONAL sebuah cabang (transaksi, booking, shift, petty cash,
-- absensi, riwayat payroll & kasbon) — cabang mulai dari nol. TIDAK menyentuh: saldo wallet &
-- riwayat wallet, layanan, staff, akun pelanggan. Urutan penting: transactions dulu
-- (transactions.booking_id mereferensi bookings), lalu bookings/shifts/attendances. Anak tabel
-- (transaction_items, booking_items, petty_cash_entries) ikut terhapus lewat ON DELETE CASCADE.
CREATE OR REPLACE FUNCTION public.superadmin_reset_branch(target_branch_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    IF COALESCE(public.current_role()::text, '') <> 'superadmin' THEN
        RAISE EXCEPTION 'not authorized';
    END IF;
    DELETE FROM public.transactions WHERE branch_id = target_branch_id;
    DELETE FROM public.bookings WHERE branch_id = target_branch_id;
    DELETE FROM public.shifts WHERE branch_id = target_branch_id;
    DELETE FROM public.attendances WHERE branch_id = target_branch_id;
    DELETE FROM public.payroll_payments WHERE branch_id = target_branch_id;
    DELETE FROM public.cash_advances WHERE branch_id = target_branch_id;
END;
$$;

-- RPC: superadmin me-RESET data operasional SELURUH cabang dalam satu barbershop sekaligus.
-- Cakupan & pengecualian sama seperti superadmin_reset_branch.
CREATE OR REPLACE FUNCTION public.superadmin_reset_tenant(target_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_branch_ids uuid[];
BEGIN
    IF COALESCE(public.current_role()::text, '') <> 'superadmin' THEN
        RAISE EXCEPTION 'not authorized';
    END IF;
    SELECT array_agg(id) INTO v_branch_ids FROM public.branches WHERE tenant_id = target_tenant_id;
    IF v_branch_ids IS NULL THEN
        RETURN;
    END IF;
    DELETE FROM public.transactions WHERE branch_id = ANY(v_branch_ids);
    DELETE FROM public.bookings WHERE branch_id = ANY(v_branch_ids);
    DELETE FROM public.shifts WHERE branch_id = ANY(v_branch_ids);
    DELETE FROM public.attendances WHERE branch_id = ANY(v_branch_ids);
    DELETE FROM public.payroll_payments WHERE branch_id = ANY(v_branch_ids);
    DELETE FROM public.cash_advances WHERE branch_id = ANY(v_branch_ids);
END;
$$;

-- Pengguna bisa melihat & update profilnya sendiri
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Staff & anggota keluarga bisa saling melihat (untuk shared wallet & operasional).
-- Lewat helper function, BUKAN subquery langsung ke profiles, supaya tidak recursive.
-- `role != 'superadmin'`: RLS bersifat OR (permissive) — tanpa pengecualian ini, seorang
-- superadmin yang kebetulan branch_id-nya sama dengan cabang seorang owner akan tetap terlihat
-- oleh owner itu lewat policy ini, walaupun "Owner views tenant profiles" sudah mengecualikannya.
CREATE POLICY "Staff view branch colleagues" ON public.profiles FOR SELECT USING (
    branch_id IS NOT NULL AND role != 'superadmin' AND public.is_staff_branch(branch_id)
);
CREATE POLICY "Family members view each other" ON public.profiles FOR SELECT USING (
    family_id IS NOT NULL AND family_id = public.current_family_id()
);

-- Owner perlu melihat profil pelanggan/calon-staff untuk Staff Management, dibatasi ke tenant
-- miliknya sendiri (Phase 2 isolation) — plus profil yang belum ke-klaim tenant manapun (tenant_id
-- IS NULL, orang yang belum pernah transaksi di tenant manapun). Superadmin lihat semua (platform
-- oversight). Read-only — perubahan role/branch_id lewat RPC admin_set_staff_role di bawah.
-- `role != 'superadmin'`: seorang superadmin dengan tenant_id NULL (mis. developer yang tidak
-- punya toko pribadi) kalau tidak dikecualikan akan dianggap "belum diklaim" dan muncul + bisa
-- diedit di Staff Management milik owner mana pun — pernah kejadian nyata dan menyebabkan akun
-- superadmin ter-demote jadi customer. Superadmin tidak boleh pernah terlihat oleh owner.
CREATE POLICY "Owner views tenant profiles" ON public.profiles FOR SELECT
    USING (
        public.current_role() = 'superadmin'
        OR (
            public.current_role() = 'owner'
            AND role != 'superadmin'
            AND (tenant_id = public.current_tenant_id() OR tenant_id IS NULL)
        )
    );

-- RPC: owner/superadmin mengubah role & branch_id staff. Sengaja BUKAN policy UPDATE
-- langsung di tabel profiles (itu akan membuka semua kolom lain juga, termasuk
-- wallet_balance, untuk diubah owner) — function ini SECURITY DEFINER dan hanya
-- menyentuh dua kolom yang relevan, dengan pengecekan role di dalamnya sendiri.
DROP FUNCTION IF EXISTS public.admin_set_staff_role(uuid, public.user_role, uuid);
DROP FUNCTION IF EXISTS public.admin_set_staff_role(uuid, public.user_role, uuid, boolean);

CREATE OR REPLACE FUNCTION public.admin_set_staff_role(
    target_id uuid,
    new_role public.user_role,
    new_branch_id uuid,
    set_working_barber BOOLEAN DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_target_tenant_id uuid;
    v_target_role public.user_role;
BEGIN
    -- COALESCE is required: for an unauthenticated/roleless caller current_role() is NULL, and
    -- `IF NULL THEN ... END IF` in PL/pgSQL treats NULL as false and SILENTLY SKIPS the check
    -- (this was a real bug — anon requests could reach the UPDATE below unauthorized).
    IF COALESCE(public.current_role()::text, '') NOT IN ('owner', 'superadmin') THEN
        RAISE EXCEPTION 'not authorized';
    END IF;

    SELECT tenant_id, role INTO v_target_tenant_id, v_target_role FROM public.profiles WHERE id = target_id;

    -- Defense-in-depth (independen dari RLS "Owner views tenant profiles"): owner tidak boleh
    -- pernah mengubah profil superadmin, apa pun tenant_id-nya. Tanpa guard ini seorang owner
    -- pernah tidak sengaja men-demote akun superadmin (tenant_id NULL) jadi customer lewat form.
    IF public.current_role() = 'owner' AND v_target_role = 'superadmin' THEN
        RAISE EXCEPTION 'cannot modify a superadmin profile';
    END IF;

    -- Phase 2 cross-tenant guard: an owner (not superadmin) may only touch a profile that's
    -- already unclaimed or already theirs — otherwise Owner A could reassign/demote Owner B's
    -- staff just by knowing their profile id. Only role check alone (above) doesn't catch this.
    IF public.current_role() = 'owner' AND v_target_tenant_id IS NOT NULL AND v_target_tenant_id != public.current_tenant_id() THEN
        RAISE EXCEPTION 'target belongs to a different tenant';
    END IF;

    -- Promoting someone to staff claims them into the promoting owner's tenant (sticky,
    -- first-write-wins — same rule as the booking/transaction/topup triggers below), so an owner
    -- can't accidentally staff a customer that already belongs to a different tenant.
    UPDATE public.profiles
    SET role = new_role,
        branch_id = new_branch_id,
        is_working_barber = set_working_barber,
        tenant_id = COALESCE(tenant_id, public.current_tenant_id())
    WHERE id = target_id;
END;
$$;

-- RPC: staff menyalakan/mematikan status kapster-aktif DIRINYA SENDIRI (mis. owner yang juga
-- motong rambut). Staff Management sengaja tidak mengizinkan self-edit untuk role/cabang, tapi
-- is_working_barber + gaji bukan privilege escalation — hanya menandai diri sebagai kapster.
CREATE OR REPLACE FUNCTION public.set_my_working_barber(new_is_working_barber BOOLEAN, new_monthly_salary NUMERIC DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    UPDATE public.profiles
    SET is_working_barber = new_is_working_barber,
        monthly_salary = COALESCE(new_monthly_salary, monthly_salary)
    WHERE id = auth.uid();
END;
$$;

-- RPC: owner mengganti SELURUH daftar cabang tambahan seorang staff sekaligus (replace penuh,
-- bukan cabang utama di profiles.branch_id — itu tetap lewat admin_set_staff_role di atas).
CREATE OR REPLACE FUNCTION public.admin_set_staff_branches(target_id uuid, new_branch_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_target_tenant_id uuid;
    v_target_role public.user_role;
    v_caller_tenant_id uuid;
    v_foreign_branch_count int;
BEGIN
    IF COALESCE(public.current_role()::text, '') NOT IN ('owner', 'superadmin') THEN
        RAISE EXCEPTION 'not authorized';
    END IF;

    v_caller_tenant_id := public.current_tenant_id();

    SELECT tenant_id, role INTO v_target_tenant_id, v_target_role FROM public.profiles WHERE id = target_id;

    IF public.current_role() = 'owner' AND v_target_role = 'superadmin' THEN
        RAISE EXCEPTION 'cannot modify a superadmin profile';
    END IF;

    IF public.current_role() = 'owner' AND v_target_tenant_id IS NOT NULL AND v_target_tenant_id != v_caller_tenant_id THEN
        RAISE EXCEPTION 'target belongs to a different tenant';
    END IF;

    -- An owner could otherwise assign their own staff into ANY branch id they can guess, giving
    -- that person operational access (is_staff_branch()) to a rival tenant's queue/POS.
    IF public.current_role() = 'owner' THEN
        SELECT count(*) INTO v_foreign_branch_count
        FROM unnest(new_branch_ids) AS b
        WHERE b NOT IN (SELECT id FROM public.branches WHERE tenant_id = v_caller_tenant_id);
        IF v_foreign_branch_count > 0 THEN
            RAISE EXCEPTION 'one or more branches do not belong to your tenant';
        END IF;
    END IF;

    DELETE FROM public.staff_branch_assignments WHERE profile_id = target_id;
    INSERT INTO public.staff_branch_assignments (profile_id, branch_id)
    SELECT target_id, b FROM unnest(new_branch_ids) AS b
    ON CONFLICT DO NOTHING;
END;
$$;

-- RPC: owner mengatur gaji bulanan flat seorang staff (dipakai kalau commission_type = 'salary').
-- Sama seperti RPC lain di atas: sengaja bukan policy UPDATE langsung ke profiles.
CREATE OR REPLACE FUNCTION public.admin_set_staff_salary(target_id uuid, new_salary numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_target_tenant_id uuid;
    v_target_role public.user_role;
BEGIN
    IF COALESCE(public.current_role()::text, '') NOT IN ('owner', 'superadmin') THEN
        RAISE EXCEPTION 'not authorized';
    END IF;

    SELECT tenant_id, role INTO v_target_tenant_id, v_target_role FROM public.profiles WHERE id = target_id;

    IF public.current_role() = 'owner' AND v_target_role = 'superadmin' THEN
        RAISE EXCEPTION 'cannot modify a superadmin profile';
    END IF;

    IF public.current_role() = 'owner' AND v_target_tenant_id IS NOT NULL AND v_target_tenant_id != public.current_tenant_id() THEN
        RAISE EXCEPTION 'target belongs to a different tenant';
    END IF;

    UPDATE public.profiles SET monthly_salary = new_salary WHERE id = target_id;
END;
$$;

-- Semua orang bisa melihat layanan
CREATE POLICY "Services viewable by everyone" ON public.services FOR SELECT USING (true);

-- Owner mengelola layanan/add-on di cabang miliknya sendiri (buat/ubah/hapus)
CREATE POLICY "Owner manages branch services" ON public.services FOR ALL
    USING (public.is_branch_owner(branch_id))
    WITH CHECK (public.is_branch_owner(branch_id));

-- Semua orang bisa melihat tier komisi (dipakai untuk menghitung skema 'tiered')
CREATE POLICY "Commission tiers viewable by everyone" ON public.commission_tiers FOR SELECT USING (true);

-- Owner mengelola tier komisi di cabang miliknya sendiri
CREATE POLICY "Owner manages branch commission tiers" ON public.commission_tiers FOR ALL
    USING (public.is_branch_owner(branch_id))
    WITH CHECK (public.is_branch_owner(branch_id));

-- Trigger: auto-create profile saat user baru sign in (Google OAuth)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
        'customer'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- PHASE 3: Modul Operasional (Booking, POS, Shift, Attendance)
-- ============================================================

-- Custom Types
CREATE TYPE public.payment_method AS ENUM ('cash', 'qris', 'deposit');
CREATE TYPE public.transaction_status AS ENUM ('paid', 'void');
CREATE TYPE public.wallet_tx_type AS ENUM ('topup', 'redeem', 'refund', 'adjustment');
CREATE TYPE public.wallet_tx_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE public.shift_status AS ENUM ('open', 'closed');
CREATE TYPE public.petty_cash_type AS ENUM ('cash_in', 'expense');
CREATE TYPE public.attendance_status AS ENUM ('clocked_in', 'clocked_out');
CREATE TYPE public.cash_advance_status AS ENUM ('pending', 'approved', 'rejected', 'paid');
CREATE TYPE public.booking_source AS ENUM ('online', 'walkin');

-- Table: bookings (reservasi online & walk-in / dasar Queue Management)
CREATE TABLE public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id),
    customer_id UUID REFERENCES public.profiles(id),
    customer_name TEXT,
    barber_id UUID REFERENCES public.profiles(id),
    status public.booking_status NOT NULL DEFAULT 'pending',
    source public.booking_source NOT NULL DEFAULT 'online',
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    total_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: booking_items (layanan utama + add-on per booking)
CREATE TABLE public.booking_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services(id),
    service_name TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL
);

-- Table: transactions (transaksi POS)
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id),
    booking_id UUID REFERENCES public.bookings(id),
    cashier_id UUID NOT NULL REFERENCES public.profiles(id),
    customer_id UUID REFERENCES public.profiles(id),
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount DECIMAL(12,2) NOT NULL DEFAULT 0,
    deposit_used DECIMAL(12,2) NOT NULL DEFAULT 0,
    total DECIMAL(12,2) NOT NULL DEFAULT 0,
    payment_method public.payment_method NOT NULL DEFAULT 'cash',
    status public.transaction_status NOT NULL DEFAULT 'paid',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: transaction_items (item jasa/produk dalam satu transaksi)
CREATE TABLE public.transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    service_id UUID REFERENCES public.services(id),
    name TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    quantity INT NOT NULL DEFAULT 1
);

-- Table: wallet_transactions (top-up deposit & redemption saldo/keluarga)
CREATE TABLE public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id),
    branch_id UUID REFERENCES public.branches(id),
    type public.wallet_tx_type NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    status public.wallet_tx_status NOT NULL DEFAULT 'pending',
    proof_url TEXT,
    verified_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: shifts (Open/Close Register kasir)
CREATE TABLE public.shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id),
    cashier_id UUID NOT NULL REFERENCES public.profiles(id),
    opening_cash DECIMAL(12,2) NOT NULL DEFAULT 0,
    closing_cash DECIMAL(12,2),
    status public.shift_status NOT NULL DEFAULT 'open',
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    closed_at TIMESTAMP WITH TIME ZONE
);

-- Table: petty_cash_entries (kas kecil per shift)
CREATE TABLE public.petty_cash_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
    type public.petty_cash_type NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: attendances (absensi kapster - geofencing/selfie)
CREATE TABLE public.attendances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id),
    branch_id UUID NOT NULL REFERENCES public.branches(id),
    status public.attendance_status NOT NULL DEFAULT 'clocked_in',
    clock_in_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    clock_out_at TIMESTAMP WITH TIME ZONE,
    clock_in_lat DOUBLE PRECISION,
    clock_in_lng DOUBLE PRECISION,
    clock_in_photo_url TEXT
);

-- Table: cash_advances (kasbon karyawan)
CREATE TABLE public.cash_advances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id),
    branch_id UUID NOT NULL REFERENCES public.branches(id),
    amount DECIMAL(12,2) NOT NULL,
    reason TEXT,
    status public.cash_advance_status NOT NULL DEFAULT 'pending',
    approved_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: payroll_payments (riwayat pembayaran komisi kapster per periode)
CREATE TABLE public.payroll_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id), -- kapster yang dibayar
    branch_id UUID NOT NULL REFERENCES public.branches(id),
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    services_count INT NOT NULL DEFAULT 0,
    gross_commission DECIMAL(12,2) NOT NULL DEFAULT 0,
    kasbon_deduction DECIMAL(12,2) NOT NULL DEFAULT 0,
    net_pay DECIMAL(12,2) NOT NULL DEFAULT 0,
    paid_by UUID REFERENCES public.profiles(id),
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: audit_logs (jejak audit tindakan sensitif kasir/owner)
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id),
    branch_id UUID REFERENCES public.branches(id),
    action TEXT NOT NULL,
    target_table TEXT,
    target_id UUID,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Mengaktifkan RLS di semua tabel baru
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petty_cash_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: bookings (customer only gets SELECT + INSERT directly; cancel/reschedule go through
-- the SECURITY DEFINER RPCs below so a customer can't tamper with status/price/barber_id/etc.
-- by calling .update() on arbitrary columns — see customer_cancel_booking below for why).
CREATE POLICY "Customers view own bookings" ON public.bookings FOR SELECT
    USING (customer_id = auth.uid());
CREATE POLICY "Customers create own bookings" ON public.bookings FOR INSERT
    WITH CHECK (customer_id = auth.uid() AND status = 'pending' AND source = 'online');
CREATE POLICY "Branch staff manage branch bookings" ON public.bookings FOR ALL
    USING (public.current_role() IN ('cashier', 'barber') AND public.is_staff_branch(branch_id))
    WITH CHECK (public.current_role() IN ('cashier', 'barber') AND public.is_staff_branch(branch_id));
CREATE POLICY "Owner manages own branch bookings" ON public.bookings FOR ALL
    USING (public.is_branch_owner(branch_id)) WITH CHECK (public.is_branch_owner(branch_id));

-- RPC: customer cancels their own booking. Allowed while 'pending' or 'approved' (not yet picked
-- up) — once 'confirmed' a barber is already assigned/working on it (see queue-board.tsx "In
-- Progress"), so cancelling at that point no longer makes sense.
CREATE OR REPLACE FUNCTION public.customer_cancel_booking(target_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_status public.booking_status;
    v_customer_id uuid;
BEGIN
    SELECT status, customer_id INTO v_status, v_customer_id
    FROM public.bookings WHERE id = target_booking_id;

    IF v_customer_id IS NULL OR v_customer_id != auth.uid() THEN
        RAISE EXCEPTION 'not authorized';
    END IF;
    IF v_status NOT IN ('pending', 'approved') THEN
        RAISE EXCEPTION 'booking can only be cancelled while still pending or approved';
    END IF;

    UPDATE public.bookings SET status = 'cancelled' WHERE id = target_booking_id;
END;
$$;

-- RPC: customer reschedules their own booking — allowed while 'pending' or 'approved', and only
-- up to 2 hours before the CURRENT scheduled time (not the new one).
CREATE OR REPLACE FUNCTION public.customer_reschedule_booking(target_booking_id uuid, new_scheduled_at timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_status public.booking_status;
    v_customer_id uuid;
    v_scheduled_at timestamptz;
BEGIN
    SELECT status, customer_id, scheduled_at INTO v_status, v_customer_id, v_scheduled_at
    FROM public.bookings WHERE id = target_booking_id;

    IF v_customer_id IS NULL OR v_customer_id != auth.uid() THEN
        RAISE EXCEPTION 'not authorized';
    END IF;
    IF v_status NOT IN ('pending', 'approved') THEN
        RAISE EXCEPTION 'booking can only be rescheduled while still pending or approved';
    END IF;
    IF v_scheduled_at - now() < interval '2 hours' THEN
        RAISE EXCEPTION 'reschedule window has passed — must be at least 2 hours before the current schedule';
    END IF;
    IF new_scheduled_at <= now() THEN
        RAISE EXCEPTION 'new schedule must be in the future';
    END IF;

    -- Reschedule always drops back to 'pending' so the new slot gets re-validated
    -- (customer_try_auto_confirm_booking) rather than silently staying 'approved' for a time the
    -- barber was never actually checked against.
    UPDATE public.bookings SET scheduled_at = new_scheduled_at, status = 'pending' WHERE id = target_booking_id;
END;
$$;

-- Trigger: a booking is a customer's first real interaction with a tenant more often than a
-- topup — claims them into that branch's tenant (sticky, first-write-wins).
CREATE OR REPLACE FUNCTION public.handle_booking_claims_customer_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    IF NEW.customer_id IS NOT NULL THEN
        UPDATE public.profiles
        SET tenant_id = COALESCE(tenant_id, (SELECT tenant_id FROM public.branches WHERE id = NEW.branch_id))
        WHERE id = NEW.customer_id AND tenant_id IS NULL;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_booking_claims_customer_tenant ON public.bookings;
CREATE TRIGGER on_booking_claims_customer_tenant
    AFTER INSERT ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.handle_booking_claims_customer_tenant();

-- Policy: booking_items (mengikuti akses booking induknya)
CREATE POLICY "Access booking_items via parent booking" ON public.booking_items FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.bookings b WHERE b.id = booking_id
        AND (b.customer_id = auth.uid()
             OR (public.current_role() IN ('cashier', 'barber') AND public.is_staff_branch(b.branch_id))
             OR public.is_branch_owner(b.branch_id))
    ));

-- Policy: transactions & transaction_items (kasir & owner cabang, pelanggan lihat miliknya).
-- Owner needs full ALL here (not just SELECT) — POS is usable by owner too (see proxy.ts
-- CASHIER_ROLES), so an owner-run sale must be able to INSERT a transaction row, not just view it.
CREATE POLICY "Cashier manages branch transactions" ON public.transactions FOR ALL
    USING (public.current_role() = 'cashier' AND public.is_staff_branch(branch_id))
    WITH CHECK (public.current_role() = 'cashier' AND public.is_staff_branch(branch_id));
CREATE POLICY "Owner manages branch transactions" ON public.transactions FOR ALL
    USING (public.is_branch_owner(branch_id)) WITH CHECK (public.is_branch_owner(branch_id));
CREATE POLICY "Customer views own transactions" ON public.transactions FOR SELECT
    USING (customer_id = auth.uid());
-- Barbers can open/close shifts too (see proxy.ts STAFF_PATHS including /shift), and shift
-- reconciliation needs to read branch transactions (cash sales) to compute expected cash — the
-- "Cashier manages..." ALL policy above only covers role='cashier', so add read-only for barber.
CREATE POLICY "Staff views branch transactions for reconciliation" ON public.transactions FOR SELECT
    USING (public.current_role() IN ('cashier', 'barber') AND public.is_staff_branch(branch_id));

-- Trigger: a POS sale also counts as a customer's first real interaction with a tenant (covers
-- walk-in-turned-POS-checkout customers who never went through a booking) — same sticky claim
-- rule as bookings/topups.
CREATE OR REPLACE FUNCTION public.handle_transaction_claims_customer_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    IF NEW.customer_id IS NOT NULL THEN
        UPDATE public.profiles
        SET tenant_id = COALESCE(tenant_id, (SELECT tenant_id FROM public.branches WHERE id = NEW.branch_id))
        WHERE id = NEW.customer_id AND tenant_id IS NULL;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_transaction_claims_customer_tenant ON public.transactions;
CREATE TRIGGER on_transaction_claims_customer_tenant
    AFTER INSERT ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.handle_transaction_claims_customer_tenant();

CREATE POLICY "Access transaction_items via parent transaction" ON public.transaction_items FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.transactions t WHERE t.id = transaction_id
        AND (t.customer_id = auth.uid()
             OR (public.current_role() = 'cashier' AND public.is_staff_branch(t.branch_id))
             OR public.is_branch_owner(t.branch_id))
    ));

-- Policy: wallet_transactions (pemilik saldo + keluarga hanya baca+insert milik sendiri, HANYA
-- sebagai 'pending topup' — status lain (verified/rejected) atau type lain (redeem/refund/
-- adjustment) hanya boleh dibuat staff; verifikasi/penolakan juga hanya oleh staff)
CREATE POLICY "Customer creates own pending topup" ON public.wallet_transactions FOR INSERT
    WITH CHECK (profile_id = auth.uid() AND status = 'pending' AND type = 'topup');
CREATE POLICY "Customer views own wallet entries" ON public.wallet_transactions FOR SELECT
    USING (profile_id = auth.uid());
CREATE POLICY "Family shares wallet visibility" ON public.wallet_transactions FOR SELECT
    USING (
        public.current_family_id() IS NOT NULL
        AND profile_id IN (SELECT p.id FROM public.profiles p WHERE p.family_id = public.current_family_id())
    );
-- Top-up bersifat level akun (bukan per-cabang, tidak ada pilihan cabang saat submit), jadi
-- di-scope lewat tenant_id si PELANGGAN (profiles.tenant_id), bukan wallet_transactions.branch_id
-- yang sering NULL. tenant_id IS NULL = pelanggan belum ke-klaim tenant manapun — tetap boleh
-- dilihat/diproses staf tenant manapun sampai mereka klaim (lihat trigger di bawah).
-- Phase 2 isolation: staf tenant lain TIDAK BOLEH lihat/verifikasi/redeem wallet pelanggan tenant
-- lain, walau role-nya cashier/owner — sebelumnya (Phase 1) ini global lintas semua tenant.
CREATE POLICY "Staff view tenant wallet entries" ON public.wallet_transactions FOR SELECT
    USING (
        public.current_role() = 'superadmin'
        OR (
            public.current_role() IN ('cashier', 'owner')
            AND EXISTS (
                SELECT 1 FROM public.profiles p WHERE p.id = wallet_transactions.profile_id
                AND (p.tenant_id = public.current_tenant_id() OR p.tenant_id IS NULL)
            )
        )
    );
CREATE POLICY "Staff verify tenant wallet topups" ON public.wallet_transactions FOR UPDATE
    USING (
        public.current_role() = 'superadmin'
        OR (
            public.current_role() IN ('cashier', 'owner')
            AND EXISTS (
                SELECT 1 FROM public.profiles p WHERE p.id = wallet_transactions.profile_id
                AND (p.tenant_id = public.current_tenant_id() OR p.tenant_id IS NULL)
            )
        )
    )
    WITH CHECK (
        public.current_role() = 'superadmin'
        OR (
            public.current_role() IN ('cashier', 'owner')
            AND EXISTS (
                SELECT 1 FROM public.profiles p WHERE p.id = wallet_transactions.profile_id
                AND (p.tenant_id = public.current_tenant_id() OR p.tenant_id IS NULL)
            )
        )
    );
CREATE POLICY "Staff create tenant wallet entries" ON public.wallet_transactions FOR INSERT
    WITH CHECK (
        public.current_role() = 'superadmin'
        OR (
            public.current_role() IN ('cashier', 'owner')
            AND EXISTS (
                SELECT 1 FROM public.profiles p WHERE p.id = wallet_transactions.profile_id
                AND (p.tenant_id = public.current_tenant_id() OR p.tenant_id IS NULL)
            )
        )
    );

-- Staff (kasir/owner) perlu mencari akun pelanggan by nama/telepon untuk redemption saldo di POS,
-- dibatasi ke tenant sendiri + pelanggan yang belum ke-klaim tenant manapun.
CREATE POLICY "Staff search customer profiles" ON public.profiles FOR SELECT
    USING (
        role = 'customer'
        AND (
            public.current_role() = 'superadmin'
            OR (public.current_role() IN ('cashier', 'owner') AND (tenant_id = public.current_tenant_id() OR tenant_id IS NULL))
        )
    );

-- Trigger: saat entri wallet berstatus 'verified' (topup ditambah, redeem dikurangi).
-- Fires di INSERT juga (bukan cuma UPDATE) karena redemption POS langsung insert dengan
-- status='verified' tanpa lewat tahap pending.
CREATE OR REPLACE FUNCTION public.handle_wallet_tx_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    current_balance DECIMAL(12,2);
    became_verified BOOLEAN;
BEGIN
    became_verified := NEW.status = 'verified' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'verified');

    -- Phase 2 tenant claim: whoever verifies this customer's first-ever wallet entry claims them
    -- into their own tenant (sticky, first-write-wins — same rule as the booking/transaction
    -- triggers below). Covers the case where a customer's very first platform interaction is a
    -- topup rather than a booking, so they don't stay permanently unclaimed.
    IF became_verified AND NEW.verified_by IS NOT NULL THEN
        UPDATE public.profiles
        SET tenant_id = COALESCE(tenant_id, public.tenant_id_for_staff(NEW.verified_by))
        WHERE id = NEW.profile_id AND tenant_id IS NULL;
    END IF;

    -- Shared wallet: uang bergerak di saldo KEPALA KELUARGA, bukan di baris anggota. NEW.profile_id
    -- tetap mencatat SIAPA yang bertransaksi (jejak audit), tapi saldo yang bertambah/berkurang
    -- selalu milik wallet_head_id(NEW.profile_id) — jadi anggota mana pun berbagi satu dompet.
    IF became_verified AND NEW.type = 'topup' THEN
        UPDATE public.profiles SET wallet_balance = wallet_balance + NEW.amount
        WHERE id = public.wallet_head_id(NEW.profile_id);
    ELSIF became_verified AND NEW.type = 'redeem' THEN
        SELECT wallet_balance INTO current_balance FROM public.profiles
        WHERE id = public.wallet_head_id(NEW.profile_id) FOR UPDATE;
        IF current_balance IS NULL OR current_balance < NEW.amount THEN
            RAISE EXCEPTION 'insufficient wallet balance';
        END IF;
        UPDATE public.profiles SET wallet_balance = wallet_balance - NEW.amount
        WHERE id = public.wallet_head_id(NEW.profile_id);
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_wallet_tx_verified ON public.wallet_transactions;
CREATE TRIGGER on_wallet_tx_verified
    AFTER INSERT OR UPDATE ON public.wallet_transactions
    FOR EACH ROW EXECUTE FUNCTION public.handle_wallet_tx_verified();

-- View: customer_effective_wallet — sama seperti profiles pelanggan tapi kolom saldonya adalah
-- saldo DOMPET KELUARGA (kepala keluarga), bukan saldo pribadi baris itu. Dipakai pencarian
-- pelanggan di POS supaya kasir melihat & memeriksa saldo gabungan yang benar. security_invoker =
-- true → RLS "Staff search customer profiles" tetap berlaku (scope tenant), tidak bocor lintas tenant.
CREATE OR REPLACE VIEW public.customer_effective_wallet
WITH (security_invoker = true) AS
SELECT
    p.id,
    p.full_name,
    p.phone,
    p.role,
    p.tenant_id,
    p.family_id,
    COALESCE(head.wallet_balance, p.wallet_balance) AS effective_balance
FROM public.profiles p
LEFT JOIN public.profiles head ON head.id = p.family_id;

GRANT SELECT ON public.customer_effective_wallet TO authenticated;

-- RPC: kasir/owner menggabungkan seorang pelanggan (member) ke dalam keluarga seorang kepala
-- keluarga (head) — set family_id + PINDAHKAN saldo member ke head (satu dompet bersama). Sengaja
-- SECURITY DEFINER (bukan policy UPDATE langsung) karena menyentuh family_id + wallet_balance dua
-- baris sekaligus, dengan pengaman role, isolasi tenant, dan pencegahan struktur keluarga rusak.
CREATE OR REPLACE FUNCTION public.admin_link_family_member(member_id uuid, head_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_caller_tenant uuid;
    v_member_tenant uuid; v_member_role public.user_role; v_member_balance numeric; v_member_family uuid;
    v_head_tenant uuid; v_head_role public.user_role; v_head_family uuid;
    v_member_has_members int;
BEGIN
    IF COALESCE(public.current_role()::text, '') NOT IN ('cashier', 'owner', 'superadmin') THEN
        RAISE EXCEPTION 'not authorized';
    END IF;
    IF member_id = head_id THEN
        RAISE EXCEPTION 'member and head cannot be the same';
    END IF;

    v_caller_tenant := public.current_tenant_id();

    SELECT tenant_id, role, wallet_balance, family_id
    INTO v_member_tenant, v_member_role, v_member_balance, v_member_family
    FROM public.profiles WHERE id = member_id;
    SELECT tenant_id, role, family_id
    INTO v_head_tenant, v_head_role, v_head_family
    FROM public.profiles WHERE id = head_id;

    IF v_member_role IS NULL OR v_head_role IS NULL THEN
        RAISE EXCEPTION 'profile not found';
    END IF;
    IF v_member_role <> 'customer' OR v_head_role <> 'customer' THEN
        RAISE EXCEPTION 'only customers can be grouped into a family';
    END IF;

    -- Isolasi tenant: kasir/owner hanya boleh menggabungkan pelanggan dalam tenant-nya sendiri
    -- (atau yang belum ke-klaim). Superadmin dikecualikan.
    IF public.current_role() <> 'superadmin' THEN
        IF (v_member_tenant IS NOT NULL AND v_member_tenant <> v_caller_tenant)
           OR (v_head_tenant IS NOT NULL AND v_head_tenant <> v_caller_tenant) THEN
            RAISE EXCEPTION 'customer belongs to a different tenant';
        END IF;
    END IF;

    -- Head harus kepala keluarga puncak (bukan anggota keluarga lain), dan member tidak boleh
    -- sedang menjadi kepala keluarga bagi orang lain (kalau tidak, anggotanya jadi yatim).
    IF v_head_family IS NOT NULL THEN
        RAISE EXCEPTION 'kepala keluarga yang dipilih sudah menjadi anggota keluarga lain';
    END IF;
    SELECT count(*) INTO v_member_has_members FROM public.profiles WHERE family_id = member_id;
    IF v_member_has_members > 0 THEN
        RAISE EXCEPTION 'pelanggan ini sudah menjadi kepala keluarga lain — keluarkan anggotanya dulu';
    END IF;

    -- Gabungkan: saldo member pindah ke head, member di-set jadi anggota dengan saldo 0.
    UPDATE public.profiles SET wallet_balance = wallet_balance + COALESCE(v_member_balance, 0) WHERE id = head_id;
    UPDATE public.profiles SET family_id = head_id, wallet_balance = 0 WHERE id = member_id;
END;
$$;

-- RPC: kasir/owner mengeluarkan seorang anggota dari keluarga (family_id = NULL). Saldo tetap di
-- dompet keluarga (kepala keluarga) — anggota keluar dengan saldo 0, karena uangnya sudah menyatu.
CREATE OR REPLACE FUNCTION public.admin_unlink_family_member(member_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_caller_tenant uuid; v_member_tenant uuid; v_member_family uuid;
BEGIN
    IF COALESCE(public.current_role()::text, '') NOT IN ('cashier', 'owner', 'superadmin') THEN
        RAISE EXCEPTION 'not authorized';
    END IF;
    v_caller_tenant := public.current_tenant_id();
    SELECT tenant_id, family_id INTO v_member_tenant, v_member_family FROM public.profiles WHERE id = member_id;
    IF v_member_family IS NULL THEN
        RETURN; -- bukan anggota keluarga, tidak ada yang perlu dilakukan
    END IF;
    IF public.current_role() <> 'superadmin' AND v_member_tenant IS NOT NULL AND v_member_tenant <> v_caller_tenant THEN
        RAISE EXCEPTION 'customer belongs to a different tenant';
    END IF;
    UPDATE public.profiles SET family_id = NULL WHERE id = member_id;
END;
$$;

-- Policy: shifts & petty_cash_entries (kasir cabang, owner)
CREATE POLICY "Cashier manages own shifts" ON public.shifts FOR ALL
    USING (cashier_id = auth.uid()) WITH CHECK (cashier_id = auth.uid());
CREATE POLICY "Owner views branch shifts" ON public.shifts FOR SELECT
    USING (public.is_branch_owner(branch_id));

CREATE POLICY "Access petty_cash via parent shift" ON public.petty_cash_entries FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.shifts s WHERE s.id = shift_id
        AND (s.cashier_id = auth.uid() OR public.is_branch_owner(s.branch_id))
    ));

-- Policy: attendances (kapster milik sendiri, owner cabang)
CREATE POLICY "Staff manages own attendance" ON public.attendances FOR ALL
    USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
CREATE POLICY "Owner views branch attendance" ON public.attendances FOR SELECT
    USING (public.is_branch_owner(branch_id));

-- View: public_barber_status — narrow, publicly-readable slice of profiles+attendances for the
-- public booking page's "Live Kapster Status" & barber picker. Deliberately NOT a profiles RLS
-- policy: profiles also holds phone/wallet_balance/monthly_salary, and a policy is row-level only
-- (any caller could still request those columns once a row is readable). This view runs with the
-- owner's privileges (bypassing profiles/attendances RLS) but only ever exposes these 4 columns,
-- and only for barbers who currently have an open ('clocked_in') attendance row — i.e. actually
-- on shift right now, at whichever branch they clocked into today (not just their primary branch).
-- barber_status is overridden to 'busy' whenever the barber has a 'confirmed' (In Progress in
-- Queue Management) booking right now — ground truth beats their manual Free/Busy/Break toggle.
CREATE OR REPLACE VIEW public.public_barber_status AS
SELECT
    p.id,
    p.full_name,
    a.branch_id,
    CASE
        WHEN EXISTS (SELECT 1 FROM public.bookings b WHERE b.barber_id = p.id AND b.status = 'confirmed')
        THEN 'busy'::public.barber_status
        ELSE p.barber_status
    END AS barber_status
FROM public.profiles p
JOIN public.attendances a ON a.profile_id = p.id AND a.status = 'clocked_in'
WHERE p.role = 'barber' OR p.is_working_barber = true;

GRANT SELECT ON public.public_barber_status TO anon, authenticated;

-- View: public_branch_barbers — ROSTER TETAP per cabang untuk picker "Pilih Kapster" di halaman
-- booking. Beda dari public_barber_status: TIDAK butuh clock-in, jadi customer bisa memilih kapster
-- untuk booking terjadwal walau saat ini belum ada yang absen (mis. booking malam untuk besok).
-- Satu baris per (kapster, cabang yang ditugaskan) — cabang utama (profiles.branch_id) ATAU cabang
-- tambahan (staff_branch_assignments). barber_status hanya berisi status live (free/busy/break)
-- kalau kapster memang sedang clock-in di cabang itu; kalau tidak, NULL (di UI dirender "Offline").
-- 'busy' hanya berlaku saat clock-in DAN punya booking 'confirmed'. Sama seperti view di atas,
-- sengaja view SECURITY DEFINER yang hanya membocorkan 5 kolom aman (tanpa phone/wallet/salary).
CREATE OR REPLACE VIEW public.public_branch_barbers AS
SELECT
    p.id,
    p.full_name,
    br.branch_id,
    CASE
        WHEN EXISTS (SELECT 1 FROM public.attendances a WHERE a.profile_id = p.id AND a.status = 'clocked_in' AND a.branch_id = br.branch_id)
        THEN CASE
            WHEN EXISTS (SELECT 1 FROM public.bookings b WHERE b.barber_id = p.id AND b.status = 'confirmed')
            THEN 'busy'::public.barber_status
            ELSE p.barber_status
        END
        ELSE NULL
    END AS barber_status,
    EXISTS (SELECT 1 FROM public.attendances a WHERE a.profile_id = p.id AND a.status = 'clocked_in' AND a.branch_id = br.branch_id) AS is_clocked_in
FROM public.profiles p
CROSS JOIN LATERAL (
    SELECT p.branch_id AS branch_id WHERE p.branch_id IS NOT NULL
    UNION
    SELECT sba.branch_id FROM public.staff_branch_assignments sba WHERE sba.profile_id = p.id
) br
WHERE p.role = 'barber' OR p.is_working_barber = true;

GRANT SELECT ON public.public_branch_barbers TO anon, authenticated;

-- RPC: does target_barber_id have any active (pending/approved/confirmed) booking whose time
-- window (scheduled_at to scheduled_at + total service duration) overlaps [window_start,
-- window_end)? Used by the public booking form so a barber can't be picked twice for overlapping
-- times, and by customer_try_auto_confirm_booking below. Duration is summed from booking_items ->
-- services since bookings itself has no duration column; a booking with no items yet (mid-insert
-- race) falls back to 30 minutes rather than 0 (never "no conflict"). exclude_booking_id lets a
-- booking that's already in the table check against every OTHER booking without matching itself.
CREATE OR REPLACE FUNCTION public.barber_has_conflict(
    target_barber_id uuid,
    window_start timestamptz,
    window_end timestamptz,
    exclude_booking_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.bookings b
        WHERE b.barber_id = target_barber_id
          AND b.status IN ('pending', 'approved', 'confirmed')
          AND (exclude_booking_id IS NULL OR b.id != exclude_booking_id)
          AND b.scheduled_at < window_end
          AND b.scheduled_at + (
              COALESCE((SELECT SUM(s.duration_minutes) FROM public.booking_items bi
                        JOIN public.services s ON s.id = bi.service_id
                        WHERE bi.booking_id = b.id), 30) * INTERVAL '1 minute'
          ) > window_start
    )
$$;

-- RPC: called right after a customer creates (or reschedules) a booking to auto-confirm it
-- instantly (status 'pending' -> 'approved') instead of making them wait for staff to manually
-- approve. If the preferred barber (if any) is actually free for that window, approve. If a
-- genuine conflict slipped through (race with another booking created in the same instant), the
-- booking is auto-CANCELLED rather than left dangling as 'pending' forever — the client shows the
-- customer a clear "kapster busy, pick another slot" message instead of an ambiguous indefinite
-- wait. Returns the resulting status so the caller doesn't need a second round-trip to know which
-- happened.
CREATE OR REPLACE FUNCTION public.customer_try_auto_confirm_booking(target_booking_id uuid)
RETURNS public.booking_status
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_customer_id uuid;
    v_status public.booking_status;
    v_barber_id uuid;
    v_scheduled_at timestamptz;
    v_duration_minutes int;
BEGIN
    SELECT customer_id, status, barber_id, scheduled_at INTO v_customer_id, v_status, v_barber_id, v_scheduled_at
    FROM public.bookings WHERE id = target_booking_id;

    IF v_customer_id IS NULL OR v_customer_id != auth.uid() THEN
        RAISE EXCEPTION 'not authorized';
    END IF;
    IF v_status != 'pending' THEN
        RETURN v_status;
    END IF;

    IF v_barber_id IS NULL THEN
        UPDATE public.bookings SET status = 'approved' WHERE id = target_booking_id;
        RETURN 'approved';
    END IF;

    SELECT COALESCE(SUM(s.duration_minutes), 30) INTO v_duration_minutes
    FROM public.booking_items bi JOIN public.services s ON s.id = bi.service_id
    WHERE bi.booking_id = target_booking_id;

    IF public.barber_has_conflict(
        v_barber_id,
        v_scheduled_at,
        v_scheduled_at + (v_duration_minutes * INTERVAL '1 minute'),
        target_booking_id
    ) THEN
        UPDATE public.bookings SET status = 'cancelled' WHERE id = target_booking_id;
        RETURN 'cancelled';
    END IF;

    UPDATE public.bookings SET status = 'approved' WHERE id = target_booking_id;
    RETURN 'approved';
END;
$$;

-- RPC: staff clicks "Mark Complete" on an in-progress (confirmed) booking. Bundles payment into
-- the same action instead of leaving it to a separate manual POS step: if the customer has an
-- account with enough Share Wallet balance, redeem it automatically (payment_method 'deposit');
-- otherwise record it as 'cash' (covers walk-ins with no account and insufficient-balance cases
-- alike — staff collects cash physically, this just logs it). Always creates a transactions +
-- transaction_items row linked to the booking so it shows up in POS history, then marks the
-- booking 'completed'. SECURITY DEFINER because barbers can complete their own bookings but the
-- normal transactions/wallet_transactions policies only allow cashier/owner to write directly —
-- this function does its own authorization check instead (same branch-staff-or-owner rule as
-- other booking actions) rather than opening those tables up more broadly.
CREATE OR REPLACE FUNCTION public.complete_booking_with_payment(target_booking_id uuid)
RETURNS public.payment_method
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_branch_id uuid;
    v_customer_id uuid;
    v_status public.booking_status;
    v_total_price numeric;
    v_customer_wallet_balance numeric;
    v_payment_method public.payment_method;
    v_deposit_used numeric;
    v_transaction_id uuid;
BEGIN
    SELECT branch_id, customer_id, status, total_price
    INTO v_branch_id, v_customer_id, v_status, v_total_price
    FROM public.bookings WHERE id = target_booking_id;

    IF v_branch_id IS NULL THEN
        RAISE EXCEPTION 'booking not found';
    END IF;
    IF NOT (
        (public.current_role() IN ('cashier', 'barber') AND public.is_staff_branch(v_branch_id))
        OR public.is_branch_owner(v_branch_id)
    ) THEN
        RAISE EXCEPTION 'not authorized';
    END IF;
    IF v_status != 'confirmed' THEN
        RAISE EXCEPTION 'booking must be in progress to complete';
    END IF;

    -- Shared wallet: cek saldo dompet KELUARGA (kepala keluarga), bukan saldo pribadi customer_id —
    -- konsisten dengan trigger handle_wallet_tx_verified yang juga memotong dari kepala keluarga.
    IF v_customer_id IS NOT NULL THEN
        SELECT wallet_balance INTO v_customer_wallet_balance FROM public.profiles
        WHERE id = public.wallet_head_id(v_customer_id);
    END IF;

    IF v_total_price > 0 AND v_customer_id IS NOT NULL AND v_customer_wallet_balance >= v_total_price THEN
        INSERT INTO public.wallet_transactions (profile_id, branch_id, type, amount, status, verified_by)
        VALUES (v_customer_id, v_branch_id, 'redeem', v_total_price, 'verified', auth.uid());
        v_payment_method := 'deposit';
        v_deposit_used := v_total_price;
    ELSE
        v_payment_method := 'cash';
        v_deposit_used := 0;
    END IF;

    INSERT INTO public.transactions (branch_id, booking_id, cashier_id, customer_id, subtotal, discount, deposit_used, total, payment_method, status)
    VALUES (v_branch_id, target_booking_id, auth.uid(), v_customer_id, v_total_price, 0, v_deposit_used, v_total_price, v_payment_method, 'paid')
    RETURNING id INTO v_transaction_id;

    INSERT INTO public.transaction_items (transaction_id, service_id, name, price, quantity)
    SELECT v_transaction_id, bi.service_id, bi.service_name, bi.price, 1
    FROM public.booking_items bi WHERE bi.booking_id = target_booking_id;

    UPDATE public.bookings SET status = 'completed', completed_at = now() WHERE id = target_booking_id;

    RETURN v_payment_method;
END;
$$;

-- Policy: cash_advances (karyawan ajukan, owner cabang menyetujui)
CREATE POLICY "Staff manages own cash advance" ON public.cash_advances FOR ALL
    USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
CREATE POLICY "Owner manages branch cash advances" ON public.cash_advances FOR ALL
    USING (public.is_branch_owner(branch_id)) WITH CHECK (public.is_branch_owner(branch_id));

-- Policy: payroll_payments (owner cabang membayar & melihat riwayat, kapster lihat riwayat sendiri)
CREATE POLICY "Owner manages branch payroll" ON public.payroll_payments FOR ALL
    USING (public.is_branch_owner(branch_id)) WITH CHECK (public.is_branch_owner(branch_id));
CREATE POLICY "Staff views own payroll history" ON public.payroll_payments FOR SELECT
    USING (profile_id = auth.uid());

-- Policy: audit_logs (staff cabang bisa insert, hanya owner yang bisa baca)
CREATE POLICY "Staff can log own actions" ON public.audit_logs FOR INSERT
    WITH CHECK (actor_id = auth.uid());
CREATE POLICY "Owner reads branch audit logs" ON public.audit_logs FOR SELECT
    USING (public.is_branch_owner(branch_id));

-- ============================================================================
-- Superadmin platform-wide access. RLS bersifat OR (permissif): tanpa policy-policy ini seorang
-- superadmin (yang tidak memiliki cabang/tenant sendiri) tidak bisa membaca data operasional
-- tenant mana pun, sehingga semua halaman owner (laporan, payroll, dashboard) tampil kosong saat
-- superadmin membantu men-setup barbershop klien. Superadmin adalah operator platform tepercaya,
-- jadi diberi akses penuh (FOR ALL) ke tabel operasional & konfigurasi tiap tenant.
-- ============================================================================
DROP POLICY IF EXISTS "Superadmin manages all bookings" ON public.bookings;
CREATE POLICY "Superadmin manages all bookings" ON public.bookings FOR ALL
    USING (public.current_role() = 'superadmin') WITH CHECK (public.current_role() = 'superadmin');

DROP POLICY IF EXISTS "Superadmin manages all booking_items" ON public.booking_items;
CREATE POLICY "Superadmin manages all booking_items" ON public.booking_items FOR ALL
    USING (public.current_role() = 'superadmin') WITH CHECK (public.current_role() = 'superadmin');

DROP POLICY IF EXISTS "Superadmin manages all transactions" ON public.transactions;
CREATE POLICY "Superadmin manages all transactions" ON public.transactions FOR ALL
    USING (public.current_role() = 'superadmin') WITH CHECK (public.current_role() = 'superadmin');

DROP POLICY IF EXISTS "Superadmin manages all transaction_items" ON public.transaction_items;
CREATE POLICY "Superadmin manages all transaction_items" ON public.transaction_items FOR ALL
    USING (public.current_role() = 'superadmin') WITH CHECK (public.current_role() = 'superadmin');

DROP POLICY IF EXISTS "Superadmin manages all shifts" ON public.shifts;
CREATE POLICY "Superadmin manages all shifts" ON public.shifts FOR ALL
    USING (public.current_role() = 'superadmin') WITH CHECK (public.current_role() = 'superadmin');

DROP POLICY IF EXISTS "Superadmin manages all petty_cash_entries" ON public.petty_cash_entries;
CREATE POLICY "Superadmin manages all petty_cash_entries" ON public.petty_cash_entries FOR ALL
    USING (public.current_role() = 'superadmin') WITH CHECK (public.current_role() = 'superadmin');

DROP POLICY IF EXISTS "Superadmin manages all attendances" ON public.attendances;
CREATE POLICY "Superadmin manages all attendances" ON public.attendances FOR ALL
    USING (public.current_role() = 'superadmin') WITH CHECK (public.current_role() = 'superadmin');

DROP POLICY IF EXISTS "Superadmin manages all services" ON public.services;
CREATE POLICY "Superadmin manages all services" ON public.services FOR ALL
    USING (public.current_role() = 'superadmin') WITH CHECK (public.current_role() = 'superadmin');

DROP POLICY IF EXISTS "Superadmin manages all commission_tiers" ON public.commission_tiers;
CREATE POLICY "Superadmin manages all commission_tiers" ON public.commission_tiers FOR ALL
    USING (public.current_role() = 'superadmin') WITH CHECK (public.current_role() = 'superadmin');

DROP POLICY IF EXISTS "Superadmin manages all payroll_payments" ON public.payroll_payments;
CREATE POLICY "Superadmin manages all payroll_payments" ON public.payroll_payments FOR ALL
    USING (public.current_role() = 'superadmin') WITH CHECK (public.current_role() = 'superadmin');

DROP POLICY IF EXISTS "Superadmin manages all cash_advances" ON public.cash_advances;
CREATE POLICY "Superadmin manages all cash_advances" ON public.cash_advances FOR ALL
    USING (public.current_role() = 'superadmin') WITH CHECK (public.current_role() = 'superadmin');

DROP POLICY IF EXISTS "Superadmin manages all staff_branch_assignments" ON public.staff_branch_assignments;
CREATE POLICY "Superadmin manages all staff_branch_assignments" ON public.staff_branch_assignments FOR ALL
    USING (public.current_role() = 'superadmin') WITH CHECK (public.current_role() = 'superadmin');

DROP POLICY IF EXISTS "Superadmin reads all audit_logs" ON public.audit_logs;
CREATE POLICY "Superadmin reads all audit_logs" ON public.audit_logs FOR SELECT
    USING (public.current_role() = 'superadmin');
