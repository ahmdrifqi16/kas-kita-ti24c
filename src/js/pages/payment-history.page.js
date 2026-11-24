import { mountAppShell } from "../layouts/app-shell.js";
import { requireAuth } from "../guards/auth.guard.js";
import { fetchPayments } from "../services/receipts.service.js";
import { cancelPendingPayment, getPaymentProofSignedUrl } from "../services/payments.service.js";
import { escapeHTML, formatDateTimeID, formatRupiah, getPaymentStatusMeta } from "../utils/formatters.js";
import { renderEmptyState, renderErrorState, renderLoadingState, showToast } from "../components/ui-states.js";
import { openConfirmModal, openModal } from "../components/modal.js";

let contentContainer = null;
let payments = [];
let statusFilter = "all";

function openProofModal(proofPath) {
  const modal = openModal({
    title: "Bukti Pembayaran Transfer",
    badge: "DOKUMEN PRIVAT",
    maxWidthClass: "max-w-xl",
    bodyHtml: renderLoadingState("Memuat bukti transfer..."),
    footerHtml: `<button type="button" data-close-modal class="varsity-btn-secondary">Tutup</button>`,
  });

  const body = modal.querySelector(".overflow-y-auto");
  getPaymentProofSignedUrl(proofPath)
    .then((url) => {
      const isPdf = proofPath.toLowerCase().endsWith(".pdf");
      body.innerHTML = isPdf
        ? `<iframe src="${url}" class="w-full h-96 border-2 border-ink rounded"></iframe>`
        : `<img src="${url}" alt="Bukti transfer" class="max-h-[65vh] mx-auto border-2 border-ink rounded object-contain" />`;
    })
    .catch((err) => {
      body.innerHTML = renderErrorState({ title: "Gagal Membuka Bukti", message: err.message });
    });
}

function renderPage() {
  const filtered = statusFilter === "all" ? payments : payments.filter((p) => p.status === statusFilter);

  const itemsHtml = filtered
    .map((p) => {
      const st = getPaymentStatusMeta(p.status);
      return `
        <article class="varsity-card-light p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="varsity-badge ${st.className}">${st.label}</span>
              <span class="text-xs text-brown">${p.method === "cash" ? "Tunai" : "Transfer"} • ${formatDateTimeID(p.created_at)}</span>
            </div>
            <h3 class="font-bold text-base text-ink">${escapeHTML(p.cash_bills?.cash_periods?.name || "Iuran Kas")}</h3>
            <p class="font-display font-bold text-lg tabular-money text-olive">${formatRupiah(p.amount)}</p>
            ${
              p.status === "rejected" && p.rejection_reason
                ? `<p class="text-xs font-semibold text-champion-red">Alasan Ditolak: ${escapeHTML(p.rejection_reason)}</p>`
                : ""
            }
          </div>
          <div class="flex flex-wrap gap-2 shrink-0">
            ${
              p.proof_path
                ? `<button type="button" data-proof="${escapeHTML(p.proof_path)}" class="varsity-btn-neutral py-1.5 px-3 text-xs">Bukti</button>`
                : ""
            }
            ${p.status === "verified" ? `<a href="/src/pages/receipts.html" class="varsity-btn-secondary py-1.5 px-3 text-xs">Kuitansi</a>` : ""}
            ${
              p.status === "pending"
                ? `<button type="button" data-cancel="${p.id}" class="varsity-btn-primary py-1.5 px-3 text-xs">Batalkan</button>`
                : ""
            }
          </div>
        </article>
      `;
    })
    .join("");

  contentContainer.innerHTML = `
    <section class="varsity-card-light p-4 flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-lg font-bold uppercase text-ink">Riwayat Pembayaran Saya (${filtered.length})</h2>
      <div class="flex flex-wrap gap-1.5">
        <button type="button" data-st="all" class="varsity-btn-neutral py-1 px-2.5 text-xs ${statusFilter === "all" ? "bg-gold" : ""}">Semua</button>
        <button type="button" data-st="pending" class="varsity-btn-neutral py-1 px-2.5 text-xs ${statusFilter === "pending" ? "bg-gold" : ""}">Pending</button>
        <button type="button" data-st="verified" class="varsity-btn-neutral py-1 px-2.5 text-xs ${statusFilter === "verified" ? "bg-gold" : ""}">Terverifikasi</button>
        <button type="button" data-st="rejected" class="varsity-btn-neutral py-1 px-2.5 text-xs ${statusFilter === "rejected" ? "bg-gold" : ""}">Ditolak</button>
      </div>
    </section>

    ${
      filtered.length === 0
        ? renderEmptyState({ title: "Belum Ada Riwayat", description: "Tidak ada catatan pembayaran yang sesuai filter." })
        : `<section class="space-y-3">${itemsHtml}</section>`
    }
  `;

  contentContainer.querySelectorAll("[data-st]").forEach((btn) => {
    btn.addEventListener("click", () => {
      statusFilter = btn.dataset.st;
      renderPage();
    });
  });

  contentContainer.querySelectorAll("[data-proof]").forEach((btn) => {
    btn.addEventListener("click", () => openProofModal(btn.dataset.proof));
  });

  contentContainer.querySelectorAll("[data-cancel]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const ok = await openConfirmModal({
        title: "Batalkan Pengajuan",
        message: "Batalkan pengajuan transfer yang masih menunggu verifikasi ini?",
        confirmLabel: "Ya, Batalkan",
      });
      if (!ok) return;
      try {
        await cancelPendingPayment(btn.dataset.cancel);
        showToast("Pengajuan transfer dibatalkan.", "success");
        await loadData();
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  });
}

async function loadData() {
  contentContainer.innerHTML = renderLoadingState("Memuat riwayat pembayaran...");
  try {
    payments = await fetchPayments();
    renderPage();
  } catch (err) {
    contentContainer.innerHTML = renderErrorState({ title: "Gagal Memuat Riwayat", message: err.message });
  }
}

async function init() {
  const auth = await requireAuth(["anggota"]);
  if (!auth) return;
  contentContainer = mountAppShell({
    profile: auth.profile,
    activeMenuId: "payment-history",
    pageTitle: "Riwayat Pembayaran",
    pageSubtitle: "Status pengajuan transfer & pencatatan tunai pribadi",
  });
  await loadData();
}

init();
