# Struktur Proyek — Kas Kita TI24C Champions

```text
kas-kita-ti24c/
├── index.html                          # Entry point root (auto-redirect login/dashboard)
├── package.json                        # Dependensi & script npm (dev, build, preview)
├── vite.config.js                      # Konfigurasi multi-page Vite
├── tailwind.config.js                  # Token warna & font TI24C Champions
├── postcss.config.js                   # Konfigurasi PostCSS & Tailwind
├── .env                                # Kredensial publik Supabase (tidak di-commit)
├── .env.example                        # Template variabel environment
├── .gitignore                          # Pengecualian node_modules, dist, dan .env
├── README.md                           # Panduan instalasi, konfigurasi, & deployment
├── STRUCTURE.md                        # Dokumentasi struktur direktori proyek
├── public/
│   └── favicon.svg                     # Ikon perisai TI24C Champions
├── supabase/
│   ├── migrations/
│   │   ├── 001_schema.sql              # Skema 12 tabel, indeks, trigger, view, & RPC
│   │   └── 002_rls_policies.sql        # Kebijakan Row Level Security & Storage privat
│   └── seed/
│       └── 002_seed.sql                # Data awal kategori, rekening, anggota, & periode
└── src/
    ├── styles/
    │   ├── input.css                   # Direktif Tailwind & komponen varsity
    │   └── custom.css                  # Efek jahitan double-stitch & mode cetak PDF
    ├── pages/
    │   ├── login.html                  # Masuk, daftar anggota, & pemulihan kata sandi
    │   ├── dashboard.html              # Ringkasan KPI & pintasan adaptif per role
    │   ├── bills.html                  # Manajemen periode kas & tagihan (Bendahara)
    │   ├── verification.html           # Verifikasi transfer anggota (Bendahara)
    │   ├── transactions.html           # Buku besar, pengeluaran, & reversal (Bendahara)
    │   ├── receipts.html               # Kuitansi digital & cetak PDF (Bendahara & Anggota)
    │   ├── members.html                # Master anggota TI24C & tautan akun (Bendahara)
    │   ├── reports.html                # Laporan keuangan & ekspor CSV/PDF (Bendahara & Ketua)
    │   ├── monitoring.html             # Monitoring pelunasan read-only (Ketua Kelas)
    │   ├── transparency.html           # Buku besar publik tersanitasi (Ketua & Anggota)
    │   ├── my-bills.html               # Daftar tagihan pribadi (Anggota)
    │   ├── pay.html                    # Pengajuan pembayaran transfer + bukti (Anggota)
    │   ├── payment-history.html        # Riwayat bayar pribadi (Anggota)
    │   ├── announcements.html          # Papan pengumuman kelas (Semua Role)
    │   ├── notifications.html          # Pusat notifikasi internal (Semua Role)
    │   ├── activity-logs.html          # Jejak audit sistem (Bendahara)
    │   ├── profile.html                # Identitas akun & ubah kata sandi (Anggota)
    │   └── settings.html               # Pengaturan rekening tujuan transfer (Bendahara)
    └── js/
        ├── config/
        │   └── supabase.js             # Inisialisasi tunggal client Supabase
        ├── guards/
        │   └── auth.guard.js           # Proteksi rute, role menu, & deteksi session habis
        ├── layouts/
        │   └── app-shell.js            # Kerangka sidebar olive, header, & drawer mobile
        ├── components/
        │   ├── emblem.js               # Komponen logo perisai SVG TI24C
        │   ├── modal.js                # Modal dialog & konfirmasi
        │   └── ui-states.js            # Loading spinner, empty state, error state, & toast
        ├── services/
        │   ├── auth.service.js         # Sign in, sign up, sign out, reset password, & profil
        │   ├── bills.service.js        # CRUD periode kas & query tagihan
        │   ├── payments.service.js     # Upload bukti privat, verifikasi, & bayar tunai
        │   ├── transactions.service.js # Ringkasan saldo, buku besar, pengeluaran, & reversal
        │   ├── receipts.service.js     # Pengambilan data kuitansi digital & riwayat bayar
        │   ├── members.service.js      # Master anggota, tautan profil, & rekening tujuan
        │   ├── reports.service.js      # Filter laporan keuangan
        │   └── operations.service.js   # Pengumuman, notifikasi, & activity log
        ├── pages/
        │   └── *.page.js               # Controller UI untuk masing-masing file di src/pages/
        └── utils/
            ├── dom.js                  # Helper manipulasi DOM & state loading tombol
            ├── error-handler.js        # Sanitasi pesan error database/Supabase
            ├── formatters.js           # Format Rupiah, tanggal Indonesia, & badge status
            └── validators.js           # Validasi input form, nominal bulat, & file bukti