import { mountAppShell } from "../layouts/app-shell.js";
import { requireAuth } from "../guards/auth.guard.js";
import { fetchAllDestinations, savePaymentDestination } from "../services/members.service.js";
import { escapeHTML } from "../utils/formatters.js";
import { setButtonLoading } from "../utils/dom.js";
import { renderEmptyState, renderErrorState, renderLoadingState, showToast } from "../components/ui-states.js";
import { closeModal, openModal } from "../components/modal.js";

let contentContainer = null;
let destinations = [];

function openDestinationModal(dest = null) {
  const isEdit = Boolean(dest);
  const modal = openModal({
    title: isEdit ? "Ubah Tujuan Transfer" : "Tambah Rekening / E-Wallet Resmi",
    badge: "TUJUAN PEMBAYARAN",
    maxWidthClass: "max-w-md",
    bodyHtml: `
      <form id="dest-form" novalidate class="space-y-4">
        <div>
          <label for="d-provider" class="block font-display uppercase text-xs font-bold text-ink mb-1">Bank / E-Wallet *</label>
          <input id="d-provider" type="text" value="${escapeHTML(dest?.provider_name || "")}" placeholder="Contoh: BCA, BRI, DANA, SeaBank, QRIS" class="varsity-input" required />
          <p id="err-d-provider" class="hidden text-xs font-semibold text-champion-red mt-1"></p>
        </div>
        <div>
          <label for="d-number" class="block font-display uppercase text-xs font-bold text-ink mb-1">Nomor Rekening / Nomor HP *</label>
          <input id="d-number" type="text" value="${escapeHTML(dest?.account_number || "")}" placeholder="Nomor tujuan transfer" class="varsity-input font-mono" required />
          <p id="err-d-number" class="hidden text-xs font-semibold text-champion-red mt-1"></p>
        </div>
        <div>
          <label for="d-holder" class="block font-display uppercase text-xs font-bold text-ink mb-1">Nama Pemilik Rekening (a.n.) *</label>
          <input id="d-holder" type="text" value="${escapeHTML(dest?.account_holder || "")}" placeholder="Nama Bendahara pemegang kas" class="varsity-input" required />
          <p id="err-d-holder" class="hidden text-xs font-semibold text-champion-red mt-1"></p>
        </div>
        <div>
          <label for="d-instructions" class="block font-display uppercase text-xs font-bold text-ink mb-1">Instruksi Tambahan (Opsional)</label>
          <textarea id="d-instructions" rows="2" placeholder="Contoh: Cantumkan NIM pada berita transfer" class="varsity-input">${escapeHTML(dest?.instructions || "")}</textarea>
        </div>
        <label class="inline-flex items-center gap-2 text-xs font-semibold text-ink cursor-pointer">
          <input id="d-active" type="checkbox" ${dest ? (dest.is_active ? "checked" : "") : "checked"} class="accent-olive" />
          <span>Tampilkan sebagai tujuan transfer aktif bagi anggota</span>
        </label>
      </form>
    `,
    footerHtml: `
      <button type="button" data-close-modal class="varsity-btn-neutral">Batal</button>
      <button type="submit" form="dest-form" id="save-dest-btn" class="varsity-btn-primary">Simpan Tujuan</button>
    `,
  });

  modal.querySelector("#dest-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const providerName = modal.querySelector("#d-provider").value.trim();
    const accountNumber = modal.querySelector("#d-number").value.trim();
    const accountHolder = modal.querySelector("#d-holder").value.trim();
    const instructions = modal.querySelector("#d-instructions").value.trim();
    const isActive = modal.querySelector("#d-active").checked;

    modal.querySelector("#err-d-provider").classList.toggle("hidden", Boolean(providerName));
    if (!providerName) modal.querySelector("#err-d-provider").textContent = "Nama bank/e-wallet wajib diisi.";

    modal.querySelector("#err-d-number").classList.toggle("hidden", Boolean(accountNumber));
    if (!accountNumber) modal.querySelector("#err-d-number").textContent = "Nomor rekening/e-wallet wajib diisi.";

    modal.querySelector("#err-d-holder").classList.toggle("hidden", Boolean(accountHolder));
    if (!accountHolder) modal.querySelector("#err-d-holder").textContent = "Nama pemilik rekening wajib diisi.";

    if (!providerName || !accountNumber || !accountHolder) return;

    const btn = modal.querySelector("#save-dest-btn");
    setButtonLoading(btn, true, "Menyimpan...");

    try {
      await savePaymentDestination({
        id: dest?.id || null,
        providerName,
        accountNumber,
        accountHolder,
        instructions,
        isActive,
      });
      closeModal();
      showToast("Tujuan transfer resmi berhasil disimpan.", "success");
      await loadDestinationsData();
    } catch (err) {
      showToast(err.message, "error");
      setButtonLoading(btn, false);
    }
  });
}

function renderPage() {
  const cardsHtml = destinations
    .map(
      (d) => `
      <article class="varsity-card-light p-5 flex flex-col justify-between gap-4">
        <div class="space-y-2">
          <div class="flex items-center justify-between gap-2">
            <span class="varsity-badge bg-gold text-ink">${escapeHTML(d.provider_name)}</span>
            <span class="varsity-badge ${d.is_active ? "bg-olive text-cream" : "bg-brown text-cream"}">
              ${d.is_active ? "AKTIF" : "NONAKTIF"}
            </span>
          </div>
          <p class="font-mono text-xl font-bold text-ink">${escapeHTML(d.account_number)}</p>
          <p class="text-xs font-semibold text-olive">a.n. ${escapeHTML(d.account_holder)}</p>
          ${d.instructions ? `<p class="text-xs text-brown">${escapeHTML(d.instructions)}</p>` : ""}
        </div>
        <div class="pt-3 border-t border-ink/20 flex justify-end">
          <button type="button" data-edit-dest="${d.id}" class="varsity-btn-secondary py-1.5 px-3 text-xs">
            Ubah Pengaturan
          </button>
        </div>
      </article>
    `,
    )
    .join("");

  contentContainer.innerHTML = `
    <section class="varsity-panel-dark p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 varsity-stitch-light">
      <div class="space-y-1">
        <span class="varsity-badge bg-gold text-ink">PENGATURAN KAS</span>
        <h2 class="text-xl font-bold uppercase text-cream">Rekening & E-Wallet Tujuan Transfer</h2>
        <p class="text-xs sm:text-sm text-parchment">
          Hanya rekening/e-wallet yang berstatus Aktif yang akan muncul pada halaman Bayar Kas Anggota.
        </p>
      </div>
      <button id="add-dest-btn" type="button" class="varsity-btn-primary shrink-0">+ Tambah Tujuan Transfer</button>
    </section>

    ${
      destinations.length === 0
        ? renderEmptyState({
            title: "Belum Ada Rekening Tujuan",
            description: "Tambahkan rekening bank atau e-wallet resmi kelas agar anggota dapat mengirim pembayaran transfer.",
          })
        : `<section class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">${cardsHtml}</section>`
    }
  `;

  document.getElementById("add-dest-btn")?.addEventListener("click", () => openDestinationModal());
  contentContainer.querySelectorAll("[data-edit-dest]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const d = destinations.find((item) => item.id === btn.dataset.editDest);
      if (d) openDestinationModal(d);
    });
  });
}

async function loadDestinationsData() {
  contentContainer.innerHTML = renderLoadingState("Memuat pengaturan rekening tujuan...");
  try {
    destinations = await fetchAllDestinations();
    renderPage();
  } catch (err) {
    contentContainer.innerHTML = renderErrorState({
      title: "Gagal Memuat Pengaturan",
      message: err.message,
      retryId: "retry-dest-btn",
    });
    document.getElementById("retry-dest-btn")?.addEventListener("click", loadDestinationsData);
  }
}

async function init() {
  const auth = await requireAuth(["bendahara"]);
  if (!auth) return;
  contentContainer = mountAppShell({
    profile: auth.profile,
    activeMenuId: "settings",
    pageTitle: "Pengaturan Kas",
    pageSubtitle: "Kelola rekening bank & e-wallet tujuan transfer resmi TI24C",
  });
  await loadDestinationsData();
}

init();
