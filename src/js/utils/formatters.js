/**
 * Memformat angka bulat menjadi mata uang Rupiah (Rp10.000)
 */
export function formatRupiah(amount) {
  const numeric = Number(amount) || 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numeric);
}

/**
 * Memformat tanggal ISO menjadi format Indonesia (17 Nov 2026)
 */
export function formatDateID(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * Memformat tanggal dan waktu Indonesia
 */
export function formatDateTimeID(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Sanitasi teks untuk mencegah XSS saat render HTML dinamis
 */
export function escapeHTML(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

/**
 * Pemetaan tampilan status tagihan sesuai spesifikasi bisnis
 */
export function getBillStatusMeta(status) {
  const map = {
    paid: {
      label: "Lunas",
      className: "bg-gold text-ink",
    },
    partial: {
      label: "Dicicil",
      className: "bg-orange text-ink",
    },
    unpaid: {
      label: "Belum Bayar",
      className: "bg-cream text-ink",
    },
    overdue: {
      label: "Jatuh Tempo",
      className: "bg-champion-red text-cream",
    },
    closed: {
      label: "Ditutup",
      className: "bg-brown text-cream",
    },
  };
  return map[status] || { label: status || "-", className: "bg-cream text-ink" };
}

/**
 * Pemetaan tampilan status pengajuan pembayaran
 */
export function getPaymentStatusMeta(status) {
  const map = {
    verified: {
      label: "Terverifikasi",
      className: "bg-gold text-ink",
    },
    pending: {
      label: "Menunggu Verifikasi",
      className: "bg-orange text-ink",
    },
    rejected: {
      label: "Ditolak",
      className: "bg-champion-red text-cream",
    },
    cancelled: {
      label: "Dibatalkan",
      className: "bg-brown text-cream",
    },
  };
  return map[status] || { label: status || "-", className: "bg-cream text-ink" };
}

/**
 * Label bahasa Indonesia untuk role resmi
 */
export function getRoleLabel(role) {
  const roles = {
    bendahara: "Bendahara",
    ketua: "Ketua Kelas",
    anggota: "Anggota",
  };
  return roles[role] || "Anggota";
}
