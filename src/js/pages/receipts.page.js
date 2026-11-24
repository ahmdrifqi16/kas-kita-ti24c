import { mountAppShell } from "../layouts/app-shell.js";
import { requireAuth } from "../guards/auth.guard.js";
import { fetchReceipts } from "../services/receipts.service.js";
import { renderChampionsEmblem } from "../components/emblem.js";
import { escapeHTML, formatDateTimeID, formatRupiah } from "../utils/formatters.js";
import { renderEmptyState, renderErrorState, renderLoadingState } from "../components/ui-states.js";
import { openModal } from "../components/modal.js";

let currentProfile = null;
let contentContainer = null;
let allReceipts = [];
let searchQuery = "";

function getFilteredReceipts() {
  if (!searchQuery.trim()) return allReceipts;
  const q = searchQuery.trim().toLowerCase();
  return allReceipts.filter((rec) => {
    const snap = rec.snapshot_data || {};
    const num = (rec.receipt_number || "").toLowerCase();
    const payer = (snap.payer_name || "").toLowerCase();
    const period = (snap.period_name || "").toLowerCase();
    const trx = (snap.transaction_number || "").toLowerCase();
    return num.includes(q) || payer.includes(q) || period.includes(q) || trx.includes(q);
  });
}

function openOfficialReceiptModal(receipt) {
  const snap = receipt.snapshot_data || {};
  const receiptNumber = receipt.receipt_number || snap.receipt_number || "-";
  const trxNumber = snap.transaction_number || "-";
  const payerName = snap.payer_name || "Anggota TI24C";
  const periodName = snap.period_name || "Iuran Kas Kelas";
  const amount = Number(snap.amount || 0);
  const method = snap.method || "Transfer";
  const status = snap.status || "TERVERIFIKASI";
  const paidAt = formatDateTimeID(snap.paid_at || receipt.issued_at);
  const verifiedBy = snap.verified_by || "Bendahara TI24C";

  const modal = openModal({
    title: "Kuitansi Pembayaran Resmi",
    badge: receiptNumber,
    maxWidthClass: "max-w-xl",
    bodyHtml: `
      <div id="printable-receipt-area" class="bg-cream border-2 border-ink rounded-md p-5 sm:p-6 space-y-5 varsity-stitch">
        <!-- Kop Kuitansi -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-ink">
          <div class="flex items-center gap-3">
            ${renderChampionsEmblem({ size: "sm" })}
            <div>
              <p class="font-display font-bold text-xl uppercase tracking-wider text-ink leading-none">
                KAS KITA — TI24C <span class="font-script text-champion-red text-lg lowercase">Champions</span>
              </p>
              <p class="text-[11px] font-semibold text-brown mt-1">
                BUKTI PEMBAYARAN KAS KELAS DIGITAL • RESMI & SAH
              </p>
            </div>
          </div>
          <span class="varsity-badge bg-gold text-ink self-start sm:self-center">
            ✓ ${escapeHTML(status)}
          </span>
        </div>

        <!-- Nomor & Referensi -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-parchment border-2 border-ink rounded-md text-xs">
          <div>
            <p class="font-display uppercase text-brown font-bold">Nomor Kuitansi</p>
            <p class="font-mono font-bold text-sm text-ink mt-0.5">${escapeHTML(receiptNumber)}</p>
          </div>
          <div>
            <p class="font-display uppercase text-brown font-bold">Referensi Buku Besar</p>
            <p class="font-mono font-bold text-sm text-ink mt-0.5">${escapeHTML(trxNumber)}</p>
          </div>
        </div>

        <!-- Rincian Pembayaran (Tanpa data sensitif/nomor rekening) -->
        <dl class="divide-y divide-ink/20 text-sm">
          <div class="py-2.5 flex justify-between gap-4">
            <dt class="text-brown font-medium">Telah Diterima Dari</dt>
            <dd class="font-bold text-ink text-right">${escapeHTML(payerName)}</dd>
          </div>
          <div class="py-2.5 flex justify-between gap-4">
            <dt class="text-brown font-medium">Untuk Pembayaran</dt>
            <dd class="font-bold text-ink text-right">${escapeHTML(periodName)}</dd>
          </div>
          <div class="py-2.5 flex justify-between gap-4">
            <dt class="text-brown font-medium">Metode Pembayaran</dt>
            <dd class="font-semibold text-ink text-right">${escapeHTML(method)}</dd>
          </div>
          <div class="py-2.5 flex justify-between gap-4">
            <dt class="text-brown font-medium">Tanggal Pengesahan</dt>
            <dd class="font-semibold text-ink text-right">${escapeHTML(paidAt)}</dd>
          </div>
          <div class="py-2.5 flex justify-between gap-4">
            <dt class="text-brown font-medium">Diverifikasi Oleh</dt>
            <dd class="font-bold text-olive text-right">${escapeHTML(verifiedBy)}</dd>
          </div>
        </dl>

        <!-- Kotak Nominal -->
        <div class="p-4 bg-olive text-cream border-2 border-ink rounded-md flex items-center justify-between gap-4">
          <span class="font-display uppercase text-sm tracking-wider text-parchment">Nominal Sah Diterima</span>
          <span class="font-display font-bold text-2xl sm:text-3xl tabular-money text-gold">
            ${formatRupiah(amount)}
          </span>
        </div>

        <p class="text-[11px] text-brown text-center">
          Dokumen ini diterbitkan secara otomatis oleh sistem Kas Kita TI24C Champions dan sah tanpa tanda tangan basah.
        </p>
      </div>
    `,
    footerHtml: `
      <button type="button" data-close-modal class="varsity-btn-neutral no-print">Tutup</button>
      <button type="button" id="print-receipt-btn" class="varsity-btn-primary no-print">
        Cetak / Simpan PDF
      </button>
    `,
  });

  modal.querySelector("#print-receipt-btn")?.addEventListener("click", () => {
    window.print();
  });
}

function renderPage() {
  if (!contentContainer) return;

  const isBendahara = currentProfile.role === "bendahara";
  const filtered = getFilteredReceipts();

  const cardsHtml = filtered
    .map((rec) => {
      const snap = rec.snapshot_data || {};
      return `
        <article class="varsity-card-light p-5 flex flex-col justify-between gap-4">
          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <span class="varsity-badge bg-gold text-ink">✓ TERVERIFIKASI</span>
              <span class="text-xs font-semibold text-brown">${escapeHTML(snap.method || "Transfer")}</span>
            </div>
            <p class="font-mono text-xs font-bold text-olive">${escapeHTML(rec.receipt_number)}</p>
            <h3 class="text-lg font-bold text-ink leading-snug">
              ${escapeHTML(snap.period_name || "Pembayaran Kas")}
            </h3>
            ${
              isBendahara
                ? `<p class="text-xs font-semibold text-brown">Pembayar: <strong class="text-ink">${escapeHTML(snap.payer_name || "-")}</strong></p>`
                : ""
            }
            <p class="text-xs text-brown">Disahkan: ${formatDateTimeID(snap.paid_at || rec.issued_at)}</p>
          </div>

          <div class="pt-3 border-t-2 border-ink/15 flex items-center justify-between gap-2">
            <span class="font-display font-bold text-xl tabular-money text-ink">
              ${formatRupiah(snap.amount || 0)}
            </span>
            <button
              type="button"
              data-open-receipt="${rec.id}"
              class="varsity-btn-secondary py-1.5 px-3 text-xs"
            >
              Lihat Kuitansi
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  contentContainer.innerHTML = `
    <section class="varsity-panel-dark p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 varsity-stitch-light">
      <div class="space-y-1">
        <span class="varsity-badge bg-gold text-ink">ARSIP BUKTI SAH</span>
        <h2 class="text-xl font-bold uppercase text-cream">
          ${isBendahara ? "Arsip Kuitansi Digital Kelas" : "Kuitansi Digital Saya"}
        </h2>
        <p class="text-xs sm:text-sm text-parchment">
          Setiap pembayaran kas yang telah diverifikasi Bendahara otomatis menghasilkan kuitansi digital bernomor unik.
        </p>
      </div>
      <span class="varsity-badge bg-cream text-ink shrink-0">${allReceipts.length} KUITANSI</span>
    </section>

    <!-- Pencarian -->
    <section class="varsity-card-light p-4">
      <label for="receipt-search" class="block font-display uppercase text-[11px] font-bold text-ink mb-1">
        Cari Nomor Kuitansi, Periode, atau Nama Pembayar
      </label>
      <input
        id="receipt-search"
        type="search"
        value="${escapeHTML(searchQuery)}"
        placeholder="Contoh: KWT-TI24C-... atau Minggu 1..."
        class="varsity-input py-2 text-xs"
      />
    </section>

    <!-- Grid Kuitansi -->
    ${
      filtered.length === 0
        ? renderEmptyState({
            title: "Belum Ada Kuitansi Digital",
            description: "Kuitansi akan muncul secara otomatis setelah pembayaran tunai dicatat atau pengajuan transfer Anda diverifikasi Bendahara.",
          })
        : `<section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">${cardsHtml}</section>`
    }
  `;

  document.getElementById("receipt-search")?.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    renderPage();
    const input = document.getElementById("receipt-search");
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  });

  contentContainer.querySelectorAll("[data-open-receipt]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const rec = allReceipts.find((item) => item.id === btn.dataset.openReceipt);
      if (rec) openOfficialReceiptModal(rec);
    });
  });
}

async function loadReceiptsData() {
  if (!contentContainer) return;
  contentContainer.innerHTML = renderLoadingState("Memuat arsip kuitansi digital...");

  try {
    allReceipts = await fetchReceipts();
    renderPage();
  } catch (err) {
    contentContainer.innerHTML = renderErrorState({
      title: "Gagal Memuat Kuitansi Digital",
      message: err.message || "Terjadi kesalahan saat mengambil data kuitansi.",
      retryId: "retry-receipts-btn",
    });
    document.getElementById("retry-receipts-btn")?.addEventListener("click", loadReceiptsData);
  }
}

async function initReceiptsPage() {
  const authData = await requireAuth(["anggota", "bendahara"]);
  if (!authData) return;

  currentProfile = authData.profile;
  contentContainer = mountAppShell({
    profile: currentProfile,
    activeMenuId: "receipts",
    pageTitle: currentProfile.role === "bendahara" ? "Kuitansi Digital" : "Kuitansi Saya",
    pageSubtitle: "Bukti sah pembayaran kas terverifikasi TI24C Champions",
  });

  await loadReceiptsData();
}

initReceiptsPage();
