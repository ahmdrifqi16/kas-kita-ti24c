/**
 * Menyaring pesan error teknis dari Supabase/PostgreSQL menjadi pesan aman bagi pengguna
 */
export function toSafeUserError(error, fallbackMessage = "Terjadi kesalahan saat memproses permintaan.") {
  if (!error) return new Error(fallbackMessage);

  const rawMsg = String(error.message || error || "").toLowerCase();
  const code = String(error.code || "");

  // Pelanggaran Row Level Security / hak akses ditolak
  if (rawMsg.includes("row-level security") || rawMsg.includes("permission denied") || code === "42501") {
    return new Error("Akses ditolak. Akun Anda tidak memiliki izin untuk melakukan tindakan ini.");
  }

  // Sesi habis / token tidak valid
  if (rawMsg.includes("jwt expired") || rawMsg.includes("invalid jwt") || rawMsg.includes("not authenticated")) {
    return new Error("Sesi login Anda telah berakhir. Silakan masuk kembali.");
  }

  // Duplikasi data (unique constraint)
  if (code === "23505" || rawMsg.includes("duplicate key")) {
    if (rawMsg.includes("nim")) {
      return new Error("NIM tersebut sudah terdaftar pada data anggota.");
    }
    if (rawMsg.includes("cash_bills")) {
      return new Error("Tagihan untuk anggota pada periode ini sudah pernah diterbitkan.");
    }
    return new Error("Data yang sama sudah tercatat di sistem.");
  }

  // Pelanggaran relasi / foreign key
  if (code === "23503" || rawMsg.includes("foreign key")) {
    return new Error("Data terkait tidak ditemukan atau masih digunakan oleh catatan lain.");
  }

  // Pelanggaran check constraint / validasi bisnis dari RPC
  if (code === "23514" || code === "P0001") {
    // Pesan RAISE EXCEPTION eksplisit yang ditulis aman di dalam RPC PostgreSQL
    if (error.message && !rawMsg.includes("constraint") && !rawMsg.includes("relation")) {
      return new Error(error.message);
    }
    return new Error("Nominal atau data yang dimasukkan tidak memenuhi ketentuan transaksi.");
  }

  // Auth errors umum
  if (rawMsg.includes("invalid login credentials")) {
    return new Error("Email atau kata sandi tidak sesuai.");
  }
  if (rawMsg.includes("email not confirmed")) {
    return new Error("Email belum dikonfirmasi. Silakan periksa kotak masuk email Anda.");
  }
  if (rawMsg.includes("user already registered")) {
    return new Error("Email ini sudah terdaftar. Silakan masuk menggunakan kata sandi Anda.");
  }
  if (rawMsg.includes("rate limit") || rawMsg.includes("too many requests")) {
    return new Error("Terlalu banyak percobaan. Tunggu beberapa saat sebelum mencoba lagi.");
  }

  // Gangguan jaringan
  if (rawMsg.includes("failed to fetch") || rawMsg.includes("networkerror")) {
    return new Error("Koneksi ke server terputus. Periksa jaringan internet Anda dan coba lagi.");
  }

  return new Error(fallbackMessage);
}
