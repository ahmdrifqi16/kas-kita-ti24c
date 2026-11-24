# Kas Kita — TI24C Champions

Aplikasi manajemen keuangan kas kelas berbasis web untuk **TI24C — Champions** dengan tema visual *retro varsity / collegiate*. Aplikasi ini dirancang untuk mempermudah pencatatan iuran kas kelas secara transparan, akurat, dan teraudit bagi seluruh mahasiswa **TI24C**.

## Anggota Kelompok

Disusun oleh kelompok **TI24C — Champions**:

| No. | Nama Lengkap | NIM |
| :-: | :--- | :--- |
| 1 | Ahmad Rifqi | `240511057` |
| 2 | Bima Wahyu Alfarezi | `240511101` |
| 3 | Dimas Herdiansyah Romadoni | `240511138` |
| 4 | Vanessa Tiara Aprillyan | `240511155` |
| 5 | Zahra Sofa Mutya | `240511120` |

---

## Daftar Isi

1. [Deskripsi & Fitur Utama](#1-deskripsi--fitur-utama)
2. [Teknologi yang Digunakan](#2-teknologi-yang-digunakan)
3. [Struktur Direktori Proyek](#3-struktur-direktori-proyek)
4. [Prasyarat Instalasi](#4-prasyarat-instalasi)
5. [Cara Clone & Instalasi Dependensi](#5-cara-clone--instalasi-dependensi)
6. [Konfigurasi Proyek Supabase](#6-konfigurasi-proyek-supabase)
7. [Menjalankan Skrip Migration SQL](#7-menjalankan-skrip-migration-sql)
8. [Mengisi Environment Lokal](#8-mengisi-environment-lokal)
9. [Menjalankan Aplikasi Secara Lokal](#9-menjalankan-aplikasi-secara-lokal)
10. [Build & Deploy ke Produksi](#10-build--deploy-ke-produksi)
11. [Catatan Keamanan & Troubleshooting](#11-catatan-keamanan--troubleshooting)

---

## 1. Deskripsi & Fitur Utama

**Kas Kita — TI24C Champions** membagi hak akses ke dalam **3 peran (role)** dengan tampilan dashboard dan menu yang menyesuaikan kebutuhan masing-masing:

### A. Bendahara
* **Periode & Tagihan Fleksibel**: Membuat periode iuran kas dengan nominal dan tenggat waktu dinamis yang otomatis menerbitkan *snapshot* tagihan bagi seluruh anggota aktif, serta mendukung pembayaran **lunas** maupun **cicilan**.
* **Verifikasi Pembayaran Transfer**: Memeriksa bukti transfer (gambar/PDF) dari bucket privat, lalu menyetujui atau menolak pengajuan pembayaran beserta catatan alasan.
* **Pencatatan Pembayaran Tunai**: Mencatat setoran tunai langsung di kelas yang otomatis memperbarui saldo kas dan menerbitkan kuitansi digital.
* **Buku Besar, Pengeluaran & Reversal**: Mencatat pemasukan tambahan dan pengeluaran kas beserta unggahan foto nota, dilengkapi mekanisme *reversal* (pembatalan koreksi tercatat) tanpa menghapus jejak audit.
* **Kuitansi Digital Resmi**: Penerbitan nomor kuitansi otomatis setiap kali pembayaran diverifikasi atau dicatat tunai, siap cetak atau simpan ke PDF.
* **Manajemen Anggota & Akun Pengguna (CRUD)**: Mengelola buku induk mahasiswa TI24C, serta membuat, mengubah role, menautkan NIM, mereset kata sandi, dan menghapus akun pengguna terdaftar.
* **Pengaturan Rekening, Pengumuman & Activity Log**: Mengatur daftar rekening bank / e-wallet tujuan transfer kelas, memublikasikan pengumuman, dan memantau riwayat aktivitas sistem.

### B. Ketua Kelas
* **Monitoring Kas & Pelunasan (Read-Only)**: Memantau progres pelunasan tiap periode, daftar tunggakan anggota, serta ringkasan kas masuk dan kas keluar secara *real-time*.
* **Transparansi Kas & Laporan Keuangan**: Mengakses buku besar kas tersanitasi dan mengekspor laporan keuangan ke format **CSV/Excel** maupun **PDF**.

### C. Anggota Kelas
* **Tagihan & Pembayaran Mandiri**: Melihat rincian tagihan pribadi (belum bayar, dicicil, lunas), memilih rekening tujuan transfer kelas, dan mengunggah bukti transfer.
* **Riwayat Bayar & Kuitansi Digital**: Memantau status verifikasi pengajuan pembayaran serta mengunduh/mencetak kuitansi digital resmi atas pembayaran yang telah disetujui.
* **Transparansi Kas Publik**: Memantau mutasi pemasukan dan pengeluaran kas kelas secara terbuka tanpa mengekspos data sensitif pribadi anggota lain.

---

## 2. Teknologi yang Digunakan

* **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES Modules), Tailwind CSS
* **Build Tool & Bundler**: Vite, PostCSS, Autoprefixer
* **Backend & Database**: Supabase (PostgreSQL, Supabase Auth, Private Storage, Row Level Security, Database Functions / RPC)

---

## 3. Struktur Direktori Proyek

```text
kas-kita-ti24c/
├── index.html                          # Entry point root (auto-redirect login/dashboard)
├── package.json                        # Konfigurasi paket & skrip npm
├── vite.config.js                      # Konfigurasi multi-page Vite
├── tailwind.config.js                  # Token warna & tipografi TI24C Champions
├── postcss.config.js                   # Konfigurasi PostCSS
├── .env                                # Kredensial lokal Supabase (diabaikan Git)
├── .env.example                        # Template variabel environment
├── .gitignore                          # Daftar pengecualian file Git
├── README.md                           # Dokumentasi utama proyek
├── STRUCTURE.md                        # Peta detail struktur folder
├── public/
│   └── favicon.svg                     # Ikon perisai TI24C Champions
├── supabase/
│   ├── migrations/
│   │   ├── 001_schema.sql              # Skema tabel, relasi, trigger, view, & RPC transaksi
│   │   ├── 002_rls_policies.sql        # Kebijakan RLS & bucket Storage privat
│   │   └── 003_bendahara_crud_members_users.sql # Kebijakan hapus anggota & RPC CRUD akun
│   └── seed/
│       └── 002_seed.sql                # Data awal kategori transaksi & konfigurasi dasar
└── src/
    ├── styles/
    │   ├── input.css                   # Direktif Tailwind & komponen varsity
    │   └── custom.css                  # Efek double-stitch & aturan cetak PDF
    ├── pages/                          # Seluruh halaman HTML aplikasi (18 halaman)
    └── js/
        ├── config/supabase.js          # Inisialisasi tunggal Supabase client
        ├── guards/auth.guard.js        # Proteksi rute, menu berbasis role, & deteksi sesi
        ├── layouts/app-shell.js        # Sidebar olive, header, & drawer mobile
        ├── components/                 # Emblem SVG, modal dialog, & state UI
        ├── services/                   # Lapisan komunikasi database & RPC Supabase
        ├── pages/                      # Pengendali logika tiap halaman HTML
        └── utils/                      # Formatter Rupiah/tanggal, validator, & sanitasi error
```

---

## 4. Prasyarat Instalasi

Pastikan perangkat Anda sudah terpasang:

* **Node.js** versi `18.x` atau `20.x` ke atas (`node -v`)
* **npm** versi `9.x` ke atas (`npm -v`)
* **Git** (`git --version`)
* Akun aktif di [Supabase](https://supabase.com)

---

## 5. Cara Clone & Instalasi Dependensi

1. Clone repositori proyek ke komputer Anda:

   ```bash
   git clone https://github.com/USERNAME_ANDA/kas-kita-ti24c.git
   cd kas-kita-ti24c
   ```

2. Instal seluruh paket dependensi yang dibutuhkan:

   ```bash
   npm install
   ```

---

## 6. Konfigurasi Proyek Supabase

1. Masuk ke dashboard [Supabase](https://supabase.com/dashboard) dan buat proyek baru untuk **TI24C Champions**.
2. Atur penyedia autentikasi pada menu **Authentication → Sign In / Providers → Email**:
   * Pastikan **Allow new users to sign up** dalam keadaan **ON**.
   * Untuk penggunaan internal kelas agar anggota baru dapat langsung masuk tanpa terkena batas pengiriman email bawaan Supabase, matikan opsi **Confirm email** (**OFF**), lalu klik **Save changes**.
3. Ambil kunci API publik pada menu **Project Settings → API**:
   * Salin **Project URL** (`https://<project-id>.supabase.co`).
   * Salin kunci publik **anon / publishable**.

---

## 7. Menjalankan Skrip Migration SQL

Buka **SQL Editor** di dashboard Supabase, lalu jalankan skrip migrasi berikut secara berurutan:

1. **`supabase/migrations/001_schema.sql`** — Membuat tipe enum, 12 tabel utama, indeks, trigger pembaruan waktu, trigger proteksi perubahan role, *view* transparansi publik, serta fungsi RPC atomik transaksi kas.
2. **`supabase/migrations/002_rls_policies.sql`** — Mengaktifkan *Row Level Security* (RLS) pada seluruh tabel dan menyiapkan bucket penyimpanan privat (`payment-proofs` dan `expense-attachments`).
3. **`supabase/migrations/003_bendahara_crud_members_users.sql`** — Menambahkan kebijakan penghapusan anggota oleh Bendahara serta fungsi RPC manajemen akun pengguna terdaftar.
4. **Isi Data Master Kategori & Anggota TI24C** — Masukkan kategori transaksi awal serta daftar mahasiswa TI24C ke tabel `public.members`.

### Menetapkan Role Pengurus Kelas

Setelah akun Bendahara dan Ketua Kelas terdaftar, ubah perannya melalui **SQL Editor**:

```sql
UPDATE public.profiles
SET role = 'bendahara', full_name = 'Bendahara TI24C'
WHERE id = (SELECT id FROM auth.users WHERE email = 'email_bendahara@example.com');

UPDATE public.profiles
SET role = 'ketua', full_name = 'Ketua Kelas TI24C'
WHERE id = (SELECT id FROM auth.users WHERE email = 'email_ketua@example.com');
```

---

## 8. Mengisi Environment Lokal

1. Salin file `.env.example` menjadi `.env` di direktori utama proyek:

   ```bash
   cp .env.example .env
   ```

2. Buka file `.env` dan isi kredensial dari proyek Supabase Anda:

   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
   ```

---

## 9. Menjalankan Aplikasi Secara Lokal

Jalankan server pengembangan Vite:

```bash
npm run dev
```

Buka alamat lokal yang tertera di terminal (umumnya `http://localhost:5173`) melalui browser. Halaman utama akan otomatis mengarahkan ke halaman masuk (`login.html`) atau langsung ke `dashboard.html` apabila sesi Anda masih aktif.

---

## 10. Build & Deploy ke Produksi

### Build Paket Produksi

Untuk mengompilasi seluruh halaman dan aset ke folder siap produksi (`dist/`):

```bash
npm run build
```

### Deploy ke Vercel / Netlify

1. Unggah kode proyek ke repositori GitHub (pastikan file `.env` tercantum di `.gitignore` sehingga tidak ikut terunggah).
2. Hubungkan repositori GitHub ke platform hosting pilihan Anda (**Vercel**, **Netlify**, atau **Cloudflare Pages**).
3. Atur konfigurasi build:
   * **Build Command**: `npm run build`
   * **Output Directory**: `dist`
4. Tambahkan variabel `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` pada pengaturan **Environment Variables** di dashboard hosting.
5. Setelah mendapatkan URL domain produksi, buka dashboard **Supabase → Authentication → URL Configuration**, lalu masukkan domain tersebut ke **Site URL** dan **Redirect URLs** agar fitur pemulihan kata sandi berfungsi dengan baik.

---

## 11. Catatan Keamanan & Troubleshooting

### Catatan Keamanan
* **Perlindungan Kunci Rahasia**: Jangan pernah meletakkan `service_role` key pada kode frontend atau file `.env` proyek klien.
* **Otorisasi Berlapis**: Validasi pada antarmuka hanya bertujuan membantu pengalaman pengguna; seluruh perlindungan akses data ditegakkan di sisi server melalui **PostgreSQL RLS** dan fungsi **RPC `SECURITY DEFINER`**.
* **Privasi Bukti & Nota**: Seluruh file bukti transfer dan nota pengeluaran disimpan dalam bucket privat dan hanya diakses sementara melalui *Signed URL*.

### Troubleshooting Umum
* **Halaman terlihat kosong saat dibuka**: Tekan `F12` → buka tab **Console** untuk memeriksa pesan error; pastikan variabel di `.env` sudah diisi dengan benar dan server Vite sudah dimuat ulang.
* **Tagihan pribadi anggota belum muncul setelah mendaftar**: Minta Bendahara membuka menu **Anggota Kelas → Daftar Akun Pengguna Terdaftar → Ubah / Tautkan**, lalu hubungkan akun tersebut ke NIM mahasiswa yang sesuai.
* **Gagal mengunggah bukti transfer**: Pastikan file berformat `JPG`, `PNG`, `WEBP`, atau `PDF` dengan ukuran maksimal `5 MB`.