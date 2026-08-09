-- Skema Database Awal untuk Supabase SQL Editor

-- Custom Types
CREATE TYPE public.user_role AS ENUM ('superadmin', 'owner', 'cashier', 'barber', 'customer');
CREATE TYPE public.booking_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');
CREATE TYPE public.barber_status AS ENUM ('free', 'busy', 'break');

-- Table: branches
CREATE TABLE public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: services
CREATE TABLE public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.branches(id),
    name TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    duration_minutes INT NOT NULL,
    is_addon BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Mengaktifkan RLS
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Contoh Policy (Kebijakan Akses)
-- Semua orang bisa melihat cabang
CREATE POLICY "Branches viewable by everyone" ON public.branches FOR SELECT USING (true);

-- Pengguna bisa melihat profilnya sendiri
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
