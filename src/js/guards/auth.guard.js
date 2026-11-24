import { getCurrentSessionAndProfile, subscribeAuthState } from "../services/auth.service.js";

export const ROLE_MENUS = {
  bendahara: [
    { id: "dashboard", label: "Dashboard", href: "/src/pages/dashboard.html", ready: true },
    { id: "bills", label: "Periode & Tagihan", href: "/src/pages/bills.html", ready: true },
    { id: "verification", label: "Verifikasi Bayar", href: "/src/pages/verification.html", ready: true },
    { id: "transactions", label: "Transaksi Kas", href: "/src/pages/transactions.html", ready: true },
    { id: "receipts", label: "Kuitansi Digital", href: "/src/pages/receipts.html", ready: true },
    { id: "members", label: "Anggota Kelas", href: "/src/pages/members.html", ready: true },
    { id: "reports", label: "Laporan", href: "/src/pages/reports.html", ready: true },
    { id: "announcements", label: "Pengumuman", href: "/src/pages/announcements.html", ready: true },
    { id: "notifications", label: "Notifikasi", href: "/src/pages/notifications.html", ready: true },
    { id: "activity-logs", label: "Activity Log", href: "/src/pages/activity-logs.html", ready: true },
    { id: "settings", label: "Pengaturan", href: "/src/pages/settings.html", ready: true },
  ],
  ketua: [
    { id: "dashboard", label: "Dashboard", href: "/src/pages/dashboard.html", ready: true },
    { id: "monitoring", label: "Monitoring Kas", href: "/src/pages/monitoring.html", ready: true },
    { id: "transparency", label: "Transparansi Kas", href: "/src/pages/transparency.html", ready: true },
    { id: "reports", label: "Laporan", href: "/src/pages/reports.html", ready: true },
    { id: "announcements", label: "Pengumuman", href: "/src/pages/announcements.html", ready: true },
    { id: "notifications", label: "Notifikasi", href: "/src/pages/notifications.html", ready: true },
  ],
  anggota: [
    { id: "dashboard", label: "Dashboard", href: "/src/pages/dashboard.html", ready: true },
    { id: "my-bills", label: "Tagihan Saya", href: "/src/pages/my-bills.html", ready: true },
    { id: "pay", label: "Bayar Kas", href: "/src/pages/pay.html", ready: true },
    { id: "payment-history", label: "Riwayat Bayar", href: "/src/pages/payment-history.html", ready: true },
    { id: "receipts", label: "Kuitansi Saya", href: "/src/pages/receipts.html", ready: true },
    { id: "transparency", label: "Transparansi Kas", href: "/src/pages/transparency.html", ready: true },
    { id: "announcements", label: "Pengumuman", href: "/src/pages/announcements.html", ready: true },
    { id: "notifications", label: "Notifikasi", href: "/src/pages/notifications.html", ready: true },
    { id: "profile", label: "Profil", href: "/src/pages/profile.html", ready: true },
  ],
};

export function getMenuByRole(role) {
  return ROLE_MENUS[role] || ROLE_MENUS.anggota;
}

export async function redirectIfAuthenticated() {
  const { session, profile } = await getCurrentSessionAndProfile();
  if (session && profile) {
    window.location.replace("/src/pages/dashboard.html");
  }
}

let sessionWatcherAttached = false;

/**
 * Mengawal halaman internal: cek sesi, cek role, dan pantau jika sesi habis tiba-tiba
 */
export async function requireAuth(allowedRoles = []) {
  const result = await getCurrentSessionAndProfile();

  if (!result.session) {
    window.location.replace("/src/pages/login.html?reason=unauthenticated");
    return null;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(result.profile?.role)) {
    window.location.replace("/src/pages/dashboard.html?reason=forbidden");
    return null;
  }

  if (!sessionWatcherAttached) {
    sessionWatcherAttached = true;
    subscribeAuthState((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        window.location.replace("/src/pages/login.html?reason=session_expired");
      }
    });
  }

  return result;
}
