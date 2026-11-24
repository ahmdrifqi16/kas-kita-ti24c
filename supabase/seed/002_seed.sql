-- ============================================================================
-- KAS KITA — TI24C CHAMPIONS
-- File: supabase/seed/002_seed.sql
-- Urutan Eksekusi: 3 (Jalankan setelah 002_rls_policies.sql)
-- Deskripsi: Kategori transaksi standar, tujuan transfer, anggota dummy, & periode awal
-- ============================================================================

-- 1. Kategori Transaksi Standar (Pemasukan & Pengeluaran)
INSERT INTO public.transaction_categories (code, name, type, is_system)
VALUES
  ('INC_KAS', 'Pembayaran Kas Periodik', 'income', true),
  ('INC_DONATION', 'Donasi / Sumbangan Kelas', 'income', false),
  ('INC_OTHER', 'Pemasukan Lain-lain', 'income', false),
  ('EXP_EVENT', 'Kegiatan Kelas', 'expense', false),
  ('EXP_CONSUMPTION', 'Konsumsi', 'expense', false),
  ('EXP_SUPPLIES', 'Perlengkapan Kelas', 'expense', false),
  ('EXP_OTHER', 'Pengeluaran Lain-lain', 'expense', false)
ON CONFLICT (code) DO NOTHING;

-- 2. Contoh Rekening / E-Wallet Resmi Tujuan Transfer Kelas
INSERT INTO public.payment_destinations (id, provider_name, account_number, account_holder, instructions, is_active)
VALUES
  (
    '11111111-1111-1111-1111-111111111101',
    'Bank BCA (Contoh)',
    '1234567890',
    'Bendahara Kas TI24C',
    'Cantumkan nama lengkap & periode kas pada berita transfer.',
    true
  ),
  (
    '11111111-1111-1111-1111-111111111102',
    'DANA / E-Wallet (Contoh)',
    '081200002424',
    'Bendahara Kas TI24C',
    'Unggah tangkapan layar bukti transaksi berhasil yang menampilkan nominal dan tanggal.',
    true
  )
ON CONFLICT (id) DO NOTHING;

-- 3. Data Anggota Dummy Kelas TI24C untuk Pengujian Awal
INSERT INTO public.members (id, nim, full_name, nickname, is_active)
VALUES
  ('22222222-2222-2222-2222-222222222201', '240101001', 'Alya Putri Maharani', 'Alya', true),
  ('22222222-2222-2222-2222-222222222202', '240101002', 'Bagas Pratama Wijaya', 'Bagas', true),
  ('22222222-2222-2222-2222-222222222203', '240101003', 'Citra Kusuma Dewi', 'Citra', true),
  ('22222222-2222-2222-2222-222222222204', '240101004', 'Dimas Aditya Saputra', 'Dimas', true),
  ('22222222-2222-2222-2222-222222222205', '240101005', 'Eka Nurul Hidayah', 'Eka', true)
ON CONFLICT (nim) DO NOTHING;

-- 4. Periode Kas Awal (Nominal Default Rp10.000 sesuai spesifikasi)
INSERT INTO public.cash_periods (id, name, start_date, due_date, default_amount, status, notes)
VALUES (
  '33333333-3333-3333-3333-333333333301',
  'Kas Minggu 1 — TI24C Champions',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '7 days',
  10000,
  'active',
  'Iuran kas awal pembukaan semester TI24C Champions.'
)
ON CONFLICT (id) DO NOTHING;

-- 5. Terbitkan Tagihan Snapshot Rp10.000 untuk Seluruh Anggota Dummy Aktif
INSERT INTO public.cash_bills (period_id, member_id, amount_due, due_date)
SELECT
  '33333333-3333-3333-3333-333333333301',
  m.id,
  10000,
  CURRENT_DATE + INTERVAL '7 days'
FROM public.members m
WHERE m.is_active = true
ON CONFLICT (period_id, member_id) DO NOTHING;

-- 6. Pengumuman Awal Selamat Datang
INSERT INTO public.announcements (id, title, content, is_pinned)
VALUES (
  '44444444-4444-4444-4444-444444444401',
  'Selamat Datang di Kas Kita — TI24C Champions',
  'Sistem pencatatan kas kelas resmi aktif. Seluruh pembayaran transfer maupun tunai akan tercatat transparan dan dilengkapi kuitansi digital otomatis.',
  true
)
ON CONFLICT (id) DO NOTHING;