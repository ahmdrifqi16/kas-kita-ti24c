# Setup Database Supabase — Kas Kita TI24C Champions

Folder ini berisi skema PostgreSQL, kebijakan Row Level Security (RLS), Private Storage, Database Functions (RPC), dan data awal untuk aplikasi **Kas Kita — TI24C Champions**.

## Urutan Eksekusi SQL

Jalankan file-file berikut secara berurutan melalui **SQL Editor** di dashboard Supabase:

1. **`migrations/001_schema.sql`**
   - Membuat tipe `ENUM` (`user_role`, `period_status`, `bill_status`, `payment_method`, `payment_status`, `transaction_type`).
   - Membuat 12 tabel utama beserta `PRIMARY KEY`, `FOREIGN KEY`, dan `CHECK` constraint.
   - Membuat index pencarian, trigger `updated_at`, trigger perlindungan kolom `role`, `view_public_transactions`, serta fungsi RPC atomik (`rpc_create_period_with_bills`, `rpc_record_cash_payment`, `rpc_verify_transfer_payment`, `rpc_record_expense`).
2. **`migrations/002_rls_policies.sql`**
   - Mengaktifkan RLS pada seluruh 12 tabel.
   - Menerapkan aturan _least privilege_ untuk role `bendahara`, `ketua`, dan `anggota`.
   - Membuat bucket Storage privat (`payment-proofs` dan `expense-attachments`).
3. **`seed/002_seed.sql`**
   - Mengisi kategori transaksi standar, contoh rekening tujuan transfer, 5 anggota dummy, serta periode kas awal senilai **Rp10.000**.

## Penetapan Role Pengguna

Secara default, akun baru yang dibuat melalui Supabase Auth mendapatkan role `anggota`. Untuk menetapkan role `bendahara` atau `ketua` serta menautkan akun ke data `members`, jalankan query berikut di SQL Editor:

```sql
UPDATE public.profiles
SET role = 'bendahara', full_name = 'Bendahara TI24C'
WHERE id = (SELECT id FROM auth.users WHERE email = 'email_bendahara@example.com');
```

### B. `README.md`
```markdown
# Kas Kita — TI24C Champions

Aplikasi manajemen keuangan kas kelas berbasis web untuk **TI24C — Champions** dengan tema visual *retro varsity / collegiate*.

## Fitur Utama

- **Periode Kas Fleksibel**: Bendahara dapat membuat periode penagihan mingguan, bulanan, atau kegiatan dengan nominal awal Rp10.000 (dapat diubah tanpa mengubah tagihan historis).
- **Dukungan Cicilan**: Anggota dapat membayar bertahap; status tagihan (`unpaid`, `partial`, `paid`) dihitung otomatis dari pembayaran yang berstatus `verified`.
- **Pembayaran Transfer & Tunai**: Pengajuan transfer dilengkapi unggah bukti ke Storage privat dan diverifikasi oleh Bendahara; pembayaran tunai dicatat langsung oleh Bendahara secara atomik.
- **Kuitansi Digital Otomatis**: Setiap pembayaran terverifikasi menghasilkan nomor kuitansi unik tanpa membocorkan nomor rekening pribadi.
- **Transparansi & Keamanan RLS**: Anggota dan Ketua Kelas dapat memantau buku besar transaksi yang telah disanitasi, dikawal penuh oleh PostgreSQL Row Level Security.

## Stack Teknologi

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES Modules), Tailwind CSS
- **Build Tool**: Vite + PostCSS
- **Backend & Database**: Supabase (PostgreSQL, Auth, Storage, RLS, RPC)

## Instalasi & Menjalankan di Lokal

1. **Instal dependensi**:
   ```bash
   npm install