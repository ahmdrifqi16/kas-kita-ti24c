-- ============================================================================
-- KAS KITA — TI24C CHAMPIONS
-- File: supabase/migrations/002_rls_policies.sql
-- Urutan Eksekusi: 2 (Jalankan setelah 001_schema.sql)
-- Deskripsi: Aktivasi RLS pada 12 tabel, Policy Least-Privilege, & Private Storage
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. AKTIFKAN RLS PADA SELURUH TABEL
-- ----------------------------------------------------------------------------
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. POLICIES: MEMBERS
-- ----------------------------------------------------------------------------
-- Bendahara & Ketua dapat melihat daftar anggota; Anggota hanya melihat profil anggotanya sendiri
CREATE POLICY "members_select_policy" ON public.members
  FOR SELECT TO authenticated
  USING (
    public.get_my_role() IN ('bendahara', 'ketua')
    OR id = public.get_my_member_id()
  );

-- Hanya Bendahara yang dapat menambah, mengubah, atau menonaktifkan anggota
CREATE POLICY "members_insert_bendahara" ON public.members
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() = 'bendahara');

CREATE POLICY "members_update_bendahara" ON public.members
  FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'bendahara')
  WITH CHECK (public.get_my_role() = 'bendahara');

-- ----------------------------------------------------------------------------
-- 3. POLICIES: PROFILES
-- ----------------------------------------------------------------------------
-- Pengguna melihat profil sendiri; Bendahara melihat seluruh profil untuk penautan akun
CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.get_my_role() = 'bendahara'
  );

-- Pengguna dapat memperbarui nama/avatar miliknya (kolom role & member_id dilindungi trigger)
CREATE POLICY "profiles_update_policy" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.get_my_role() = 'bendahara')
  WITH CHECK (id = auth.uid() OR public.get_my_role() = 'bendahara');

-- ----------------------------------------------------------------------------
-- 4. POLICIES: CASH_PERIODS
-- ----------------------------------------------------------------------------
-- Seluruh pengguna terautentikasi dapat melihat informasi periode kas
CREATE POLICY "periods_select_authenticated" ON public.cash_periods
  FOR SELECT TO authenticated
  USING (true);

-- Hanya Bendahara yang dapat membuat dan mengubah periode kas
CREATE POLICY "periods_insert_bendahara" ON public.cash_periods
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() = 'bendahara');

CREATE POLICY "periods_update_bendahara" ON public.cash_periods
  FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'bendahara')
  WITH CHECK (public.get_my_role() = 'bendahara');

-- ----------------------------------------------------------------------------
-- 5. POLICIES: CASH_BILLS
-- ----------------------------------------------------------------------------
-- Bendahara & Ketua memantau rekap tagihan; Anggota hanya melihat tagihan miliknya
CREATE POLICY "bills_select_policy" ON public.cash_bills
  FOR SELECT TO authenticated
  USING (
    public.get_my_role() IN ('bendahara', 'ketua')
    OR member_id = public.get_my_member_id()
  );

-- Hanya Bendahara yang dapat menerbitkan/menutup tagihan
CREATE POLICY "bills_insert_bendahara" ON public.cash_bills
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() = 'bendahara');

CREATE POLICY "bills_update_bendahara" ON public.cash_bills
  FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'bendahara')
  WITH CHECK (public.get_my_role() = 'bendahara');

-- ----------------------------------------------------------------------------
-- 6. POLICIES: PAYMENT_DESTINATIONS
-- ----------------------------------------------------------------------------
-- Anggota & Ketua hanya melihat rekening tujuan yang aktif; Bendahara melihat semua
CREATE POLICY "destinations_select_policy" ON public.payment_destinations
  FOR SELECT TO authenticated
  USING (
    is_active = true
    OR public.get_my_role() = 'bendahara'
  );

CREATE POLICY "destinations_manage_bendahara" ON public.payment_destinations
  FOR ALL TO authenticated
  USING (public.get_my_role() = 'bendahara')
  WITH CHECK (public.get_my_role() = 'bendahara');

-- ----------------------------------------------------------------------------
-- 7. POLICIES: PAYMENTS
-- ----------------------------------------------------------------------------
-- Bendahara melihat semua pengajuan; Anggota hanya melihat riwayat pembayarannya sendiri
CREATE POLICY "payments_select_policy" ON public.payments
  FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'bendahara'
    OR member_id = public.get_my_member_id()
  );

-- Anggota hanya boleh mengajukan transfer (status wajib 'pending') atas nama member_id miliknya
CREATE POLICY "payments_insert_member_transfer" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_my_role() = 'bendahara'
    OR (
      member_id = public.get_my_member_id()
      AND method = 'transfer'
      AND status = 'pending'
      AND verified_by IS NULL
      AND verified_at IS NULL
    )
  );

-- Hanya Bendahara yang dapat mengubah status pembayaran (anggota dapat membatalkan miliknya yang masih pending)
CREATE POLICY "payments_update_policy" ON public.payments
  FOR UPDATE TO authenticated
  USING (
    public.get_my_role() = 'bendahara'
    OR (member_id = public.get_my_member_id() AND status = 'pending')
  )
  WITH CHECK (
    public.get_my_role() = 'bendahara'
    OR (member_id = public.get_my_member_id() AND status = 'cancelled')
  );

-- ----------------------------------------------------------------------------
-- 8. POLICIES: TRANSACTION_CATEGORIES & TRANSACTIONS
-- ----------------------------------------------------------------------------
CREATE POLICY "categories_select_authenticated" ON public.transaction_categories
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "categories_manage_bendahara" ON public.transaction_categories
  FOR ALL TO authenticated
  USING (public.get_my_role() = 'bendahara')
  WITH CHECK (public.get_my_role() = 'bendahara');

-- Tabel transactions mentah hanya dibaca langsung oleh Bendahara;
-- Anggota & Ketua membaca melalui view_public_transactions yang telah disanitasi.
CREATE POLICY "transactions_select_bendahara" ON public.transactions
  FOR SELECT TO authenticated
  USING (public.get_my_role() = 'bendahara');

CREATE POLICY "transactions_insert_bendahara" ON public.transactions
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() = 'bendahara');

CREATE POLICY "transactions_update_bendahara" ON public.transactions
  FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'bendahara')
  WITH CHECK (public.get_my_role() = 'bendahara');

-- ----------------------------------------------------------------------------
-- 9. POLICIES: RECEIPTS (KUITANSI DIGITAL)
-- ----------------------------------------------------------------------------
-- Kuitansi hanya dapat dilihat oleh Bendahara dan pemilik pembayaran sah
CREATE POLICY "receipts_select_owner_or_bendahara" ON public.receipts
  FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'bendahara'
    OR member_id = public.get_my_member_id()
  );

-- ----------------------------------------------------------------------------
-- 10. POLICIES: ANNOUNCEMENTS, NOTIFICATIONS & ACTIVITY_LOGS
-- ----------------------------------------------------------------------------
CREATE POLICY "announcements_select_authenticated" ON public.announcements
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "announcements_manage_bendahara" ON public.announcements
  FOR ALL TO authenticated
  USING (public.get_my_role() = 'bendahara')
  WITH CHECK (public.get_my_role() = 'bendahara');

-- Pengguna hanya membaca dan menandai baca notifikasi miliknya sendiri
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Activity Log bersifat audit: hanya dapat dibaca oleh Bendahara dan tidak dapat diubah/dihapus dari client
CREATE POLICY "activity_logs_select_bendahara" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (public.get_my_role() = 'bendahara');

-- ----------------------------------------------------------------------------
-- 11. SUPABASE STORAGE BUCKETS & POLICIES (PRIVASI BUKTI TRANSFER)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('payment-proofs', 'payment-proofs', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('expense-attachments', 'expense-attachments', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Anggota mengunggah bukti transfer ke folder dengan nama auth.uid() miliknya
CREATE POLICY "storage_proofs_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Bukti transfer hanya dapat diakses oleh pemilik folder atau Bendahara
CREATE POLICY "storage_proofs_select_owner_or_bendahara" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.get_my_role() = 'bendahara'
    )
  );

-- Nota pengeluaran dikelola dan dilihat oleh Bendahara
CREATE POLICY "storage_expenses_bendahara" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'expense-attachments'
    AND public.get_my_role() = 'bendahara'
  )
  WITH CHECK (
    bucket_id = 'expense-attachments'
    AND public.get_my_role() = 'bendahara'
  );