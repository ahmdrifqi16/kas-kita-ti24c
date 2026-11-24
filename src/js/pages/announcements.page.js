import { mountAppShell } from "../layouts/app-shell.js";
import { requireAuth } from "../guards/auth.guard.js";
import { createAnnouncement, deleteAnnouncement, fetchAnnouncements, toggleAnnouncementPin } from "../services/operations.service.js";
import { escapeHTML, formatDateTimeID } from "../utils/formatters.js";
import { setButtonLoading } from "../utils/dom.js";
import { renderEmptyState, renderErrorState, renderLoadingState, showToast } from "../components/ui-states.js";
import { closeModal, openConfirmModal, openModal } from "../components/modal.js";

let currentProfile = null;
let contentContainer = null;
let announcements = [];

function openCreateAnnouncementModal() {
  const modal = openModal({
    title: "Terbitkan Pengumuman Kelas",
    badge: "INFO TI24C CHAMPIONS",
    maxWidthClass: "max-w-lg",
    bodyHtml: `
      <form id="ann-form" novalidate class="space-y-4">
        <div>
          <label for="ann-title" class="block font-display uppercase text-xs font-bold text-ink mb-1">Judul Pengumuman *</label>
          <input id="ann-title" type="text" placeholder="Contoh: Batas Akhir Iuran Kas Minggu 2" class="varsity-input" required />
          <p id="err-ann-title" class="hidden text-xs font-semibold text-champion-red mt-1"></p>
        </div>
        <div>
          <label for="ann-content" class="block font-display uppercase text-xs font-bold text-ink mb-1">Isi Pengumuman *</label>
          <textarea id="ann-content" rows="4" placeholder="Tuliskan informasi lengkap untuk seluruh anggota kelas TI24C..." class="varsity-input" required></textarea>
          <p id="err-ann-content" class="hidden text-xs font-semibold text-champion-red mt-1"></p>
        </div>
        <label class="inline-flex items-center gap-2 text-xs font-semibold text-ink cursor-pointer">
          <input id="ann-pinned" type="checkbox" checked class="accent-olive" />
          <span>Sematkan di bagian atas papan pengumuman & dashboard</span>
        </label>
      </form>
    `,
    footerHtml: `
      <button type="button" data-close-modal class="varsity-btn-neutral">Batal</button>
      <button type="submit" form="ann-form" id="save-ann-btn" class="varsity-btn-primary">Terbitkan</button>
    `,
  });

  modal.querySelector("#ann-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = modal.querySelector("#ann-title").value.trim();
    const content = modal.querySelector("#ann-content").value.trim();
    const isPinned = modal.querySelector("#ann-pinned").checked;

    modal.querySelector("#err-ann-title").classList.toggle("hidden", Boolean(title));
    if (!title) modal.querySelector("#err-ann-title").textContent = "Judul pengumuman wajib diisi.";

    modal.querySelector("#err-ann-content").classList.toggle("hidden", Boolean(content));
    if (!content) modal.querySelector("#err-ann-content").textContent = "Isi pengumuman wajib diisi.";

    if (!title || !content) return;

    const btn = modal.querySelector("#save-ann-btn");
    setButtonLoading(btn, true, "Menerbitkan...");

    try {
      await createAnnouncement({
        title,
        content,
        isPinned,
        createdBy: currentProfile.id,
      });
      closeModal();
      showToast("Pengumuman berhasil diterbitkan.", "success");
      await loadAnnouncementsData();
    } catch (err) {
      showToast(err.message, "error");
      setButtonLoading(btn, false);
    }
  });
}

function renderPage() {
  const isBendahara = currentProfile.role === "bendahara";

  const listHtml = announcements
    .map(
      (a) => `
      <article class="varsity-card-light p-5 space-y-2.5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="varsity-badge ${a.is_pinned ? "bg-gold text-ink" : "bg-parchment text-ink"}">
              ${a.is_pinned ? "DISEMATKAN" : "PENGUMUMAN"}
            </span>
            <span class="text-xs text-brown">${formatDateTimeID(a.created_at)}</span>
          </div>
          ${
            isBendahara
              ? `<div class="flex gap-1.5">
                  <button type="button" data-pin-ann="${a.id}" data-pinned="${a.is_pinned ? "1" : "0"}" class="varsity-btn-neutral py-1 px-2.5 text-xs">
                    ${a.is_pinned ? "Lepas Sematan" : "Sematkan"}
                  </button>
                  <button type="button" data-del-ann="${a.id}" class="varsity-btn-primary py-1 px-2.5 text-xs">Hapus</button>
                </div>`
              : ""
          }
        </div>
        <h3 class="text-xl font-bold uppercase text-ink">${escapeHTML(a.title)}</h3>
        <p class="text-sm text-ink/90 whitespace-pre-line leading-relaxed">${escapeHTML(a.content)}</p>
      </article>
    `,
    )
    .join("");

  contentContainer.innerHTML = `
    <section class="varsity-panel-dark p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 varsity-stitch-light">
      <div class="space-y-1">
        <span class="varsity-badge bg-gold text-ink">PAPAN INFORMASI TI24C</span>
        <h2 class="text-xl font-bold uppercase text-cream">Pengumuman Kas & Kegiatan Kelas</h2>
        <p class="text-xs sm:text-sm text-parchment">Informasi resmi terkait jadwal iuran kas, batas waktu, dan laporan keuangan kelas.</p>
      </div>
      ${isBendahara ? `<button id="new-ann-btn" type="button" class="varsity-btn-primary shrink-0">+ Buat Pengumuman</button>` : ""}
    </section>

    ${
      announcements.length === 0
        ? renderEmptyState({ title: "Belum Ada Pengumuman", description: "Pengumuman resmi dari pengurus kelas akan ditampilkan di sini." })
        : `<section class="space-y-4">${listHtml}</section>`
    }
  `;

  document.getElementById("new-ann-btn")?.addEventListener("click", openCreateAnnouncementModal);

  contentContainer.querySelectorAll("[data-pin-ann]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const nextPin = btn.dataset.pinned !== "1";
      try {
        await toggleAnnouncementPin(btn.dataset.pinAnn, nextPin);
        showToast(nextPin ? "Pengumuman disematkan." : "Sematan pengumuman dilepas.", "success");
        await loadAnnouncementsData();
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  });

  contentContainer.querySelectorAll("[data-del-ann]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const ok = await openConfirmModal({
        title: "Hapus Pengumuman",
        message: "Pengumuman ini akan dihapus secara permanen dari papan informasi. Lanjutkan?",
        confirmLabel: "Ya, Hapus",
      });
      if (!ok) return;
      try {
        await deleteAnnouncement(btn.dataset.delAnn);
        showToast("Pengumuman berhasil dihapus.", "success");
        await loadAnnouncementsData();
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  });
}

async function loadAnnouncementsData() {
  contentContainer.innerHTML = renderLoadingState("Memuat pengumuman kelas...");
  try {
    announcements = await fetchAnnouncements();
    renderPage();
  } catch (err) {
    contentContainer.innerHTML = renderErrorState({ title: "Gagal Memuat Pengumuman", message: err.message });
  }
}

async function init() {
  const auth = await requireAuth(["bendahara", "ketua", "anggota"]);
  if (!auth) return;
  currentProfile = auth.profile;
  contentContainer = mountAppShell({
    profile: currentProfile,
    activeMenuId: "announcements",
    pageTitle: "Pengumuman Kelas",
    pageSubtitle: "Informasi resmi & pengingat kas TI24C Champions",
  });
  await loadAnnouncementsData();
}

init();
