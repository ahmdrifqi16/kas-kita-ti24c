-- ============================================================================
-- KAS KITA — TI24C CHAMPIONS
-- File: supabase/migrations/001_schema.sql
-- Urutan Eksekusi: 1 (Jalankan pertama kali pada project Supabase baru)
-- Deskripsi: Enum, 12 Tabel Utama, Index, Trigger, View Tersanitasi, & RPC Atomik
-- ============================================================================

-- Aktifkan ekstensi UUID jika belum aktif
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. ENUM TYPES
-- ----------------------------------------------------------------------------
CREATE TYPE public.user_role AS ENUM ('bendahara', 'ketua', 'anggota');
CREATE TYPE public.period_status AS ENUM ('active', 'closed');
CREATE TYPE public.bill_status AS ENUM ('unpaid', 'partial', 'paid', 'overdue', 'closed');
CREATE TYPE public.payment_method AS ENUM ('cash', 'transfer');
CREATE TYPE public.payment_status AS ENUM ('pending', 'verified', 'rejected', 'cancelled');
CREATE TYPE public.transaction_type AS ENUM ('income', 'expense');

-- ----------------------------------------------------------------------------
-- 2. SEQUENCES UNTUK NOMOR REFERENSI UNIK
-- ----------------------------------------------------------------------------
CREATE SEQUENCE public.trx_number_seq START 1;
CREATE SEQUENCE public.receipt_number_seq START 1;

-- ----------------------------------------------------------------------------
-- 3. TABEL MASTER & PROFIL
-- ----------------------------------------------------------------------------

-- 3.1 Master Anggota Kelas TI24C
CREATE TABLE public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nim VARCHAR(20) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  nickname VARCHAR(50),
  phone VARCHAR(25),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.2 Profil Pengguna Terhubung ke Supabase Auth
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id UUID UNIQUE REFERENCES public.members(id) ON DELETE SET NULL,
  full_name VARCHAR(120) NOT NULL,
  role public.user_role NOT NULL DEFAULT 'anggota',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 4. TABEL PERIODE KAS, TAGIHAN & TUJUAN TRANSFER
-- ----------------------------------------------------------------------------

-- 4.1 Periode Kas Fleksibel
CREATE TABLE public.cash_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  due_date DATE NOT NULL,
  default_amount BIGINT NOT NULL DEFAULT 10000,
  status public.period_status NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_period_dates CHECK (due_date >= start_date),
  CONSTRAINT chk_period_default_amount CHECK (default_amount > 0)
);

-- 4.2 Tagihan Per Anggota Per Periode (Snapshot Nominal)
CREATE TABLE public.cash_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES public.cash_periods(id) ON DELETE RESTRICT,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  amount_due BIGINT NOT NULL,
  amount_paid BIGINT NOT NULL DEFAULT 0,
  status public.bill_status NOT NULL DEFAULT 'unpaid',
  due_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_bill_period_member UNIQUE (period_id, member_id),
  CONSTRAINT chk_bill_amount_due CHECK (amount_due > 0),
  CONSTRAINT chk_bill_amount_paid CHECK (amount_paid >= 0 AND amount_paid <= amount_due)
);

-- 4.3 Rekening / E-Wallet Resmi Tujuan Transfer Kelas
CREATE TABLE public.payment_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name VARCHAR(60) NOT NULL,
  account_number VARCHAR(50) NOT NULL,
  account_holder VARCHAR(120) NOT NULL,
  instructions TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 5. TABEL PEMBAYARAN, BUKU BESAR TRANSAKSI & KUITANSI
-- ----------------------------------------------------------------------------

-- 5.1 Pembayaran Tunai / Transfer & Cicilan
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.cash_bills(id) ON DELETE RESTRICT,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  destination_id UUID REFERENCES public.payment_destinations(id) ON DELETE SET NULL,
  amount BIGINT NOT NULL,
  method public.payment_method NOT NULL,
  proof_path TEXT,
  notes TEXT,
  status public.payment_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_payment_amount CHECK (amount > 0),
  CONSTRAINT chk_transfer_requires_proof CHECK (
    method = 'cash' OR (method = 'transfer' AND proof_path IS NOT NULL AND length(trim(proof_path)) > 0)
  ),
  CONSTRAINT chk_rejection_requires_reason CHECK (
    status <> 'rejected' OR (rejection_reason IS NOT NULL AND length(trim(rejection_reason)) > 0)
  )
);

-- 5.2 Kategori Transaksi Keuangan
CREATE TABLE public.transaction_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL,
  type public.transaction_type NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5.3 Buku Besar Pemasukan & Pengeluaran (Ledger Resmi)
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trx_number VARCHAR(40) NOT NULL UNIQUE,
  payment_id UUID UNIQUE REFERENCES public.payments(id) ON DELETE RESTRICT,
  category_id UUID NOT NULL REFERENCES public.transaction_categories(id) ON DELETE RESTRICT,
  type public.transaction_type NOT NULL,
  amount BIGINT NOT NULL,
  trx_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  public_description TEXT NOT NULL,
  attachment_path TEXT,
  is_reversed BOOLEAN NOT NULL DEFAULT false,
  reversed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reversal_reason TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_transaction_amount CHECK (amount > 0)
);

-- 5.4 Kuitansi Digital Resmi
CREATE TABLE public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number VARCHAR(40) NOT NULL UNIQUE,
  payment_id UUID NOT NULL UNIQUE REFERENCES public.payments(id) ON DELETE RESTRICT,
  transaction_id UUID NOT NULL UNIQUE REFERENCES public.transactions(id) ON DELETE RESTRICT,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  issued_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  snapshot_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 6. TABEL OPERASIONAL: PENGUMUMAN, NOTIFIKASI & AUDIT LOG
-- ----------------------------------------------------------------------------

-- 6.1 Pengumuman Kelas
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(160) NOT NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6.2 Notifikasi Internal Pengguna
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title VARCHAR(140) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(40) NOT NULL DEFAULT 'info',
  reference_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6.3 Audit Log Aktivitas Penting
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role VARCHAR(30),
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 7. INDEXES UNTUK PENCARIAN, FILTER & RELASI
-- ----------------------------------------------------------------------------
CREATE INDEX idx_members_active_name ON public.members (is_active, full_name);
CREATE INDEX idx_profiles_role ON public.profiles (role);
CREATE INDEX idx_cash_bills_member_status ON public.cash_bills (member_id, status);
CREATE INDEX idx_cash_bills_period_status ON public.cash_bills (period_id, status);
CREATE INDEX idx_payments_status_created ON public.payments (status, created_at DESC);
CREATE INDEX idx_payments_bill_id ON public.payments (bill_id);
CREATE INDEX idx_payments_member_id ON public.payments (member_id, created_at DESC);
CREATE INDEX idx_transactions_date_type ON public.transactions (trx_date DESC, type);
CREATE INDEX idx_transactions_category ON public.transactions (category_id);
CREATE INDEX idx_receipts_member_issued ON public.receipts (member_id, issued_at DESC);
CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, is_read, created_at DESC);
CREATE INDEX idx_activity_logs_created ON public.activity_logs (created_at DESC);

-- ----------------------------------------------------------------------------
-- 8. TRIGGER UPDATED_AT OTOMATIS & KEAMANAN PROFIL
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_members_updated_at BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_cash_periods_updated_at BEFORE UPDATE ON public.cash_periods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_cash_bills_updated_at BEFORE UPDATE ON public.cash_bills
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_payment_destinations_updated_at BEFORE UPDATE ON public.payment_destinations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_transaction_categories_updated_at BEFORE UPDATE ON public.transaction_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_transactions_updated_at BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_announcements_updated_at BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Mencegah pengguna non-bendahara menaikkan role sendiri atau mengubah member_id
CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role public.user_role;
BEGIN
  -- Izinkan jika dijalankan dari SQL Editor / service_role (auth.uid() IS NULL)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();

  IF v_caller_role IS DISTINCT FROM 'bendahara' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Akses ditolak: Hanya Bendahara yang dapat mengubah role pengguna.';
    END IF;
    IF NEW.member_id IS DISTINCT FROM OLD.member_id THEN
      RAISE EXCEPTION 'Akses ditolak: Penautan anggota hanya dapat dilakukan oleh Bendahara.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_profile_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_sensitive_columns();

-- Otomatis membuat profil saat user baru dibuat di Supabase Auth (default: anggota)
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1)),
    'anggota'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ----------------------------------------------------------------------------
-- 9. HELPER FUNCTIONS UNTUK RLS & RINGKASAN SALDO
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_member_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT member_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Ringkasan saldo resmi dari ledger transactions
CREATE OR REPLACE FUNCTION public.get_official_cash_summary()
RETURNS TABLE (
  total_income BIGINT,
  total_expense BIGINT,
  current_balance BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(CASE WHEN type = 'income' AND is_reversed = false THEN amount ELSE 0 END), 0)::BIGINT AS total_income,
    COALESCE(SUM(CASE WHEN type = 'expense' AND is_reversed = false THEN amount ELSE 0 END), 0)::BIGINT AS total_expense,
    (
      COALESCE(SUM(CASE WHEN type = 'income' AND is_reversed = false THEN amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN type = 'expense' AND is_reversed = false THEN amount ELSE 0 END), 0)
    )::BIGINT AS current_balance
  FROM public.transactions;
$$;

-- ----------------------------------------------------------------------------
-- 10. VIEW TRANSPARANSI TRANSAKSI TERSANITASI (UNTUK ANGGOTA & KETUA)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.view_public_transactions AS
SELECT
  t.id,
  t.trx_number,
  t.type,
  tc.name AS category_name,
  t.amount,
  t.trx_date,
  t.public_description AS description,
  t.is_reversed,
  t.created_at
FROM public.transactions t
JOIN public.transaction_categories tc ON tc.id = t.category_id
WHERE t.is_reversed = false;

GRANT SELECT ON public.view_public_transactions TO authenticated;

-- ----------------------------------------------------------------------------
-- 11. DATABASE FUNCTIONS (RPC) ATOMIK UNTUK OPERASI KEUANGAN
-- ----------------------------------------------------------------------------

-- 11.1 Buat Periode Kas & Terbitkan Tagihan Snapshot
CREATE OR REPLACE FUNCTION public.rpc_create_period_with_bills(
  p_name VARCHAR,
  p_start_date DATE,
  p_due_date DATE,
  p_default_amount BIGINT DEFAULT 10000,
  p_notes TEXT DEFAULT NULL,
  p_member_ids UUID[] DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_period_id UUID;
  v_bill_count INT := 0;
BEGIN
  IF public.get_my_role() IS DISTINCT FROM 'bendahara' THEN
    RAISE EXCEPTION 'Hanya Bendahara yang dapat membuat periode kas.';
  END IF;

  IF p_default_amount <= 0 THEN
    RAISE EXCEPTION 'Nominal kas harus lebih besar dari Rp0.';
  END IF;

  INSERT INTO public.cash_periods (name, start_date, due_date, default_amount, notes, created_by)
  VALUES (trim(p_name), p_start_date, p_due_date, p_default_amount, p_notes, v_actor_id)
  RETURNING id INTO v_period_id;

  INSERT INTO public.cash_bills (period_id, member_id, amount_due, due_date)
  SELECT v_period_id, m.id, p_default_amount, p_due_date
  FROM public.members m
  WHERE m.is_active = true
    AND (p_member_ids IS NULL OR m.id = ANY(p_member_ids));

  GET DIAGNOSTICS v_bill_count = ROW_COUNT;

  -- Kirim notifikasi ke anggota yang memiliki akun terhubung
  INSERT INTO public.notifications (user_id, title, message, type, reference_id)
  SELECT
    p.id,
    'Tagihan Kas Baru: ' || trim(p_name),
    'Tagihan sebesar Rp' || to_char(p_default_amount, 'FM999,999,999') || ' jatuh tempo pada ' || to_char(p_due_date, 'DD Mon YYYY') || '.',
    'bill_new',
    v_period_id
  FROM public.profiles p
  JOIN public.cash_bills cb ON cb.member_id = p.member_id
  WHERE cb.period_id = v_period_id;

  INSERT INTO public.activity_logs (actor_id, actor_role, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor_id,
    'bendahara',
    'CREATE_PERIOD_AND_BILLS',
    'cash_periods',
    v_period_id,
    jsonb_build_object('name', trim(p_name), 'amount', p_default_amount, 'bills_created', v_bill_count)
  );

  RETURN v_period_id;
END;
$$;

-- 11.2 Catat Pembayaran Tunai oleh Bendahara (Atomik: Payment + Bill + Ledger + Receipt)
CREATE OR REPLACE FUNCTION public.rpc_record_cash_payment(
  p_bill_id UUID,
  p_amount BIGINT,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_verifier_name VARCHAR(120);
  v_bill RECORD;
  v_member_name VARCHAR(120);
  v_period_name VARCHAR(100);
  v_remaining BIGINT;
  v_new_paid BIGINT;
  v_new_status public.bill_status;
  v_payment_id UUID;
  v_trx_id UUID;
  v_receipt_id UUID;
  v_category_id UUID;
  v_trx_number VARCHAR(40);
  v_receipt_number VARCHAR(40);
BEGIN
  IF public.get_my_role() IS DISTINCT FROM 'bendahara' THEN
    RAISE EXCEPTION 'Hanya Bendahara yang berwenang mencatat pembayaran tunai.';
  END IF;

  SELECT full_name INTO v_verifier_name FROM public.profiles WHERE id = v_actor_id;

  -- Kunci baris tagihan agar tidak terjadi race condition cicilan
  SELECT * INTO v_bill FROM public.cash_bills WHERE id = p_bill_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Data tagihan tidak ditemukan.';
  END IF;

  IF v_bill.status IN ('paid', 'closed') THEN
    RAISE EXCEPTION 'Tagihan ini sudah lunas atau telah ditutup.';
  END IF;

  v_remaining := v_bill.amount_due - v_bill.amount_paid;
  IF p_amount <= 0 OR p_amount > v_remaining THEN
    RAISE EXCEPTION 'Nominal tidak valid. Sisa tagihan saat ini adalah Rp%.', v_remaining;
  END IF;

  SELECT full_name INTO v_member_name FROM public.members WHERE id = v_bill.member_id;
  SELECT name INTO v_period_name FROM public.cash_periods WHERE id = v_bill.period_id;
  SELECT id INTO v_category_id FROM public.transaction_categories WHERE code = 'INC_KAS' LIMIT 1;

  IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'Kategori sistem INC_KAS belum tersedia. Jalankan 002_seed.sql terlebih dahulu.';
  END IF;

  -- 1. Simpan pembayaran tunai langsung berstatus verified
  INSERT INTO public.payments (
    bill_id, member_id, amount, method, notes, status,
    submitted_by, verified_by, verified_at
  )
  VALUES (
    p_bill_id, v_bill.member_id, p_amount, 'cash', p_notes, 'verified',
    v_actor_id, v_actor_id, now()
  )
  RETURNING id INTO v_payment_id;

  -- 2. Perbarui status dan akumulasi tagihan
  v_new_paid := v_bill.amount_paid + p_amount;
  v_new_status := CASE WHEN v_new_paid >= v_bill.amount_due THEN 'paid' ELSE 'partial' END;

  UPDATE public.cash_bills
  SET amount_paid = v_new_paid, status = v_new_status
  WHERE id = p_bill_id;

  -- 3. Buat 1 transaksi pemasukan pada ledger
  v_trx_number := 'TRX-' || to_char(now(), 'YYYYMM') || '-' || lpad(nextval('public.trx_number_seq')::text, 4, '0');

  INSERT INTO public.transactions (
    trx_number, payment_id, category_id, type, amount, trx_date,
    description, public_description, created_by
  )
  VALUES (
    v_trx_number,
    v_payment_id,
    v_category_id,
    'income',
    p_amount,
    CURRENT_DATE,
    'Pembayaran tunai kas (' || v_period_name || ') dari ' || v_member_name,
    'Pemasukan iuran kas periode ' || v_period_name || ' (Tunai Terverifikasi)',
    v_actor_id
  )
  RETURNING id INTO v_trx_id;

  -- 4. Terbitkan kuitansi digital
  v_receipt_number := 'KWT-TI24C-' || to_char(now(), 'YYYYMM') || '-' || lpad(nextval('public.receipt_number_seq')::text, 4, '0');

  INSERT INTO public.receipts (
    receipt_number, payment_id, transaction_id, member_id, issued_by, snapshot_data
  )
  VALUES (
    v_receipt_number,
    v_payment_id,
    v_trx_id,
    v_bill.member_id,
    v_actor_id,
    jsonb_build_object(
      'app_name', 'KAS KITA — TI24C CHAMPIONS',
      'receipt_number', v_receipt_number,
      'transaction_number', v_trx_number,
      'payer_name', v_member_name,
      'period_name', v_period_name,
      'amount', p_amount,
      'method', 'Tunai',
      'status', 'TERVERIFIKASI',
      'paid_at', now(),
      'verified_by', COALESCE(v_verifier_name, 'Bendahara TI24C')
    )
  )
  RETURNING id INTO v_receipt_id;

  -- 5. Notifikasi & Activity Log
  INSERT INTO public.notifications (user_id, title, message, type, reference_id)
  SELECT
    p.id,
    'Pembayaran Tunai Diterima',
    'Pembayaran tunai Rp' || to_char(p_amount, 'FM999,999,999') || ' untuk ' || v_period_name || ' telah diverifikasi. Kuitansi: ' || v_receipt_number,
    'receipt_issued',
    v_receipt_id
  FROM public.profiles p
  WHERE p.member_id = v_bill.member_id;

  INSERT INTO public.activity_logs (actor_id, actor_role, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor_id,
    'bendahara',
    'RECORD_CASH_PAYMENT',
    'payments',
    v_payment_id,
    jsonb_build_object('bill_id', p_bill_id, 'amount', p_amount, 'receipt_number', v_receipt_number)
  );

  RETURN v_receipt_id;
END;
$$;

-- 11.3 Verifikasi Pengajuan Transfer oleh Bendahara (Setujui / Tolak dengan Alasan)
CREATE OR REPLACE FUNCTION public.rpc_verify_transfer_payment(
  p_payment_id UUID,
  p_decision VARCHAR,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_verifier_name VARCHAR(120);
  v_payment RECORD;
  v_bill RECORD;
  v_member_name VARCHAR(120);
  v_period_name VARCHAR(100);
  v_remaining BIGINT;
  v_new_paid BIGINT;
  v_new_status public.bill_status;
  v_category_id UUID;
  v_trx_id UUID;
  v_receipt_id UUID := NULL;
  v_trx_number VARCHAR(40);
  v_receipt_number VARCHAR(40);
BEGIN
  IF public.get_my_role() IS DISTINCT FROM 'bendahara' THEN
    RAISE EXCEPTION 'Hanya Bendahara yang dapat memverifikasi pembayaran transfer.';
  END IF;

  IF p_decision NOT IN ('verified', 'rejected') THEN
    RAISE EXCEPTION 'Keputusan verifikasi harus berupa verified atau rejected.';
  END IF;

  -- Kunci baris pembayaran agar tidak terjadi verifikasi ganda
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Data pengajuan pembayaran tidak ditemukan.';
  END IF;

  IF v_payment.status <> 'pending' THEN
    RAISE EXCEPTION 'Pengajuan ini sudah diproses sebelumnya (status: %).', v_payment.status;
  END IF;

  SELECT full_name INTO v_verifier_name FROM public.profiles WHERE id = v_actor_id;
  SELECT * INTO v_bill FROM public.cash_bills WHERE id = v_payment.bill_id FOR UPDATE;
  SELECT full_name INTO v_member_name FROM public.members WHERE id = v_payment.member_id;
  SELECT name INTO v_period_name FROM public.cash_periods WHERE id = v_bill.period_id;

  -- Jika DITOLAK
  IF p_decision = 'rejected' THEN
    IF p_rejection_reason IS NULL OR length(trim(p_rejection_reason)) = 0 THEN
      RAISE EXCEPTION 'Alasan penolakan wajib diisi oleh Bendahara.';
    END IF;

    UPDATE public.payments
    SET
      status = 'rejected',
      rejection_reason = trim(p_rejection_reason),
      verified_by = v_actor_id,
      verified_at = now()
    WHERE id = p_payment_id;

    INSERT INTO public.notifications (user_id, title, message, type, reference_id)
    SELECT
      p.id,
      'Pengajuan Transfer Ditolak',
      'Pengajuan transfer untuk ' || v_period_name || ' ditolak. Alasan: ' || trim(p_rejection_reason),
      'payment_rejected',
      p_payment_id
    FROM public.profiles p
    WHERE p.member_id = v_payment.member_id;

    INSERT INTO public.activity_logs (actor_id, actor_role, action, entity_type, entity_id, metadata)
    VALUES (
      v_actor_id,
      'bendahara',
      'REJECT_TRANSFER_PAYMENT',
      'payments',
      p_payment_id,
      jsonb_build_object('reason', trim(p_rejection_reason))
    );

    RETURN p_payment_id;
  END IF;

  -- Jika DISETUJUI (verified)
  v_remaining := v_bill.amount_due - v_bill.amount_paid;
  IF v_payment.amount > v_remaining THEN
    RAISE EXCEPTION 'Nominal pengajuan (Rp%) melebihi sisa tagihan saat ini (Rp%).', v_payment.amount, v_remaining;
  END IF;

  SELECT id INTO v_category_id FROM public.transaction_categories WHERE code = 'INC_KAS' LIMIT 1;

  UPDATE public.payments
  SET status = 'verified', verified_by = v_actor_id, verified_at = now()
  WHERE id = p_payment_id;

  v_new_paid := v_bill.amount_paid + v_payment.amount;
  v_new_status := CASE WHEN v_new_paid >= v_bill.amount_due THEN 'paid' ELSE 'partial' END;

  UPDATE public.cash_bills
  SET amount_paid = v_new_paid, status = v_new_status
  WHERE id = v_bill.id;

  v_trx_number := 'TRX-' || to_char(now(), 'YYYYMM') || '-' || lpad(nextval('public.trx_number_seq')::text, 4, '0');

  INSERT INTO public.transactions (
    trx_number, payment_id, category_id, type, amount, trx_date,
    description, public_description, created_by
  )
  VALUES (
    v_trx_number,
    p_payment_id,
    v_category_id,
    'income',
    v_payment.amount,
    CURRENT_DATE,
    'Pembayaran transfer kas (' || v_period_name || ') dari ' || v_member_name,
    'Pemasukan iuran kas periode ' || v_period_name || ' (Transfer Terverifikasi)',
    v_actor_id
  )
  RETURNING id INTO v_trx_id;

  v_receipt_number := 'KWT-TI24C-' || to_char(now(), 'YYYYMM') || '-' || lpad(nextval('public.receipt_number_seq')::text, 4, '0');

  INSERT INTO public.receipts (
    receipt_number, payment_id, transaction_id, member_id, issued_by, snapshot_data
  )
  VALUES (
    v_receipt_number,
    p_payment_id,
    v_trx_id,
    v_payment.member_id,
    v_actor_id,
    jsonb_build_object(
      'app_name', 'KAS KITA — TI24C CHAMPIONS',
      'receipt_number', v_receipt_number,
      'transaction_number', v_trx_number,
      'payer_name', v_member_name,
      'period_name', v_period_name,
      'amount', v_payment.amount,
      'method', 'Transfer',
      'status', 'TERVERIFIKASI',
      'paid_at', now(),
      'verified_by', COALESCE(v_verifier_name, 'Bendahara TI24C')
    )
  )
  RETURNING id INTO v_receipt_id;

  INSERT INTO public.notifications (user_id, title, message, type, reference_id)
  SELECT
    p.id,
    'Transfer Terverifikasi & Kuitansi Terbit',
    'Pembayaran Rp' || to_char(v_payment.amount, 'FM999,999,999') || ' untuk ' || v_period_name || ' sah. Kuitansi: ' || v_receipt_number,
    'receipt_issued',
    v_receipt_id
  FROM public.profiles p
  WHERE p.member_id = v_payment.member_id;

  INSERT INTO public.activity_logs (actor_id, actor_role, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor_id,
    'bendahara',
    'APPROVE_TRANSFER_PAYMENT',
    'payments',
    p_payment_id,
    jsonb_build_object('amount', v_payment.amount, 'trx_number', v_trx_number, 'receipt_number', v_receipt_number)
  );

  RETURN v_receipt_id;
END;
$$;

-- 11.4 Catat Pengeluaran Kas oleh Bendahara
CREATE OR REPLACE FUNCTION public.rpc_record_expense(
  p_category_id UUID,
  p_amount BIGINT,
  p_trx_date DATE,
  p_description TEXT,
  p_public_description TEXT DEFAULT NULL,
  p_attachment_path TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_balance BIGINT;
  v_trx_id UUID;
  v_trx_number VARCHAR(40);
  v_cat_type public.transaction_type;
BEGIN
  IF public.get_my_role() IS DISTINCT FROM 'bendahara' THEN
    RAISE EXCEPTION 'Hanya Bendahara yang dapat mencatat pengeluaran kas.';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Nominal pengeluaran harus lebih besar dari Rp0.';
  END IF;

  SELECT type INTO v_cat_type FROM public.transaction_categories WHERE id = p_category_id;
  IF v_cat_type IS DISTINCT FROM 'expense' THEN
    RAISE EXCEPTION 'Kategori yang dipilih bukan kategori pengeluaran.';
  END IF;

  SELECT current_balance INTO v_balance FROM public.get_official_cash_summary();
  IF p_amount > v_balance THEN
    RAISE EXCEPTION 'Saldo kas tidak mencukupi (Saldo saat ini: Rp%).', v_balance;
  END IF;

  v_trx_number := 'TRX-' || to_char(now(), 'YYYYMM') || '-' || lpad(nextval('public.trx_number_seq')::text, 4, '0');

  INSERT INTO public.transactions (
    trx_number, category_id, type, amount, trx_date,
    description, public_description, attachment_path, created_by
  )
  VALUES (
    v_trx_number,
    p_category_id,
    'expense',
    p_amount,
    COALESCE(p_trx_date, CURRENT_DATE),
    trim(p_description),
    COALESCE(NULLIF(trim(p_public_description), ''), trim(p_description)),
    p_attachment_path,
    v_actor_id
  )
  RETURNING id INTO v_trx_id;

  INSERT INTO public.activity_logs (actor_id, actor_role, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor_id,
    'bendahara',
    'RECORD_EXPENSE',
    'transactions',
    v_trx_id,
    jsonb_build_object('trx_number', v_trx_number, 'amount', p_amount)
  );

  RETURN v_trx_id;
END;
$$;