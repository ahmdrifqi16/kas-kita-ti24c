import { mountAppShell } from "../layouts/app-shell.js";
import { requireAuth } from "../guards/auth.guard.js";
import { fetchMyNotifications, markAllNotificationsAsRead, markNotificationAsRead } from "../services/operations.service.js";
import { escapeHTML, formatDateTimeID } from "../utils/formatters.js";
import { renderEmptyState, renderErrorState, renderLoadingState, showToast } from "../components/ui-states.js";

let currentProfile = null;
let contentContainer = null;
let notifications = [];

function renderPage() {
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const listHtml = notifications
    .map(
      (n) => `
      <article class="${
        n.is_read ? "bg-cream" : "bg-gold/30"
      } border-2 border-ink rounded-md shadow-varsity-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="varsity-badge ${n.is_read ? "bg-parchment text-ink" : "bg-orange text-ink"}">
              ${n.is_read ? "DIBACA" : "BARU"}
            </span>
            <span class="text-xs text-brown">${formatDateTimeID(n.created_at)}</span>
          </div>
          <h3 class="font-bold text-base text-ink">${escapeHTML(n.title || "Notifikasi Sistem")}</h3>
          <p class="text-sm text-ink/85">${escapeHTML(n.message || n.body || "")}</p>
        </div>
        ${
          !n.is_read
            ? `<button type="button" data-read-notif="${n.id}" class="varsity-btn-secondary py-1.5 px-3 text-xs shrink-0">
                Tandai Dibaca
              </button>`
            : ""
        }
      </article>
    `,
    )
    .join("");

  contentContainer.innerHTML = `
    <section class="varsity-panel-dark p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 varsity-stitch-light">
      <div class="space-y-1">
        <span class="varsity-badge bg-gold text-ink">${unreadCount} BELUM DIBACA</span>
        <h2 class="text-xl font-bold uppercase text-cream">Pusat Notifikasi Internal</h2>
        <p class="text-xs sm:text-sm text-parchment">Pembaruan status tagihan, pengajuan transfer, dan verifikasi pembayaran Anda.</p>
      </div>
      ${unreadCount > 0 ? `<button id="read-all-notif-btn" type="button" class="varsity-btn-secondary shrink-0">Tandai Semua Dibaca</button>` : ""}
    </section>

    ${
      notifications.length === 0
        ? renderEmptyState({ title: "Belum Ada Notifikasi", description: "Notifikasi aktivitas terkait akun Anda akan muncul di sini." })
        : `<section class="space-y-3">${listHtml}</section>`
    }
  `;

  document.getElementById("read-all-notif-btn")?.addEventListener("click", async () => {
    try {
      await markAllNotificationsAsRead(currentProfile.id);
      showToast("Semua notifikasi ditandai sudah dibaca.", "success");
      await loadNotifications();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  contentContainer.querySelectorAll("[data-read-notif]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await markNotificationAsRead(btn.dataset.readNotif);
        await loadNotifications();
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  });
}

async function loadNotifications() {
  contentContainer.innerHTML = renderLoadingState("Memuat notifikasi...");
  try {
    notifications = await fetchMyNotifications();
    renderPage();
  } catch (err) {
    contentContainer.innerHTML = renderErrorState({ title: "Gagal Memuat Notifikasi", message: err.message });
  }
}

async function init() {
  const auth = await requireAuth(["bendahara", "ketua", "anggota"]);
  if (!auth) return;
  currentProfile = auth.profile;
  contentContainer = mountAppShell({
    profile: currentProfile,
    activeMenuId: "notifications",
    pageTitle: "Notifikasi",
    pageSubtitle: "Pemberitahuan aktivitas & status pembayaran kas",
  });
  await loadNotifications();
}

init();
