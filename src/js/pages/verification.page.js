import { mountAppShell } from "../layouts/app-shell.js";
import { requireAuth } from "../guards/auth.guard.js";
import { fetchPayments } from "../services/receipts.service.js";
import { getPaymentProofSignedUrl, verifyTransferPayment } from "../services/payments.service.js";
import { escapeHTML, formatDateTimeID, formatRupiah, getPaymentStatusMeta } from "../utils/formatters.js";
import { setButtonLoading } from "../utils/dom.js";
import { renderEmptyState, renderErrorState, renderLoadingState, showToast } from "../components/ui-states.js";
import { closeModal, openConfirmModal, openModal } from "../components/modal.js";

let currentProfile = null;
let contentContainer = null;
let allPayments = [];

let filterState = {
  status: "pending",
  search: "",
};

function getFilteredPayments() {
  return allPayments.filter((p) => {
    if (filterState.status !== "all" && p.status !== filterState.status) {
      return false;
    }
    if (filterState.search.trim()) {
      const q = filterState.search.trim().toLowerCase();
      const name = (p.members?.full_name || "").toLowerCase();
      const nim = (p.members?.nim || "").toLowerCase();
      const period = (p.cash_bills?.cash_periods?.name || "").toLowerCase();
      if (!name.includes(q) && !nim.includes(q) && !period.includes(q)) {
        return false;
      }
    }
    return true;
  });
}

function openProofInspectorModal(payment) {
  const memberName = payment.members?.full_name || "Anggota";
  const periodName = payment.cash_bills?.cash_periods?.name || "Periode Kas";
  const destText = payment.payment_destinations
    ? `${payment.payment_destinations.provider_name} (${payment.payment_destinations.account_number})`
    : "Tidak tercatat";

  const modal = openModal({
    title: `Bukti Transfer — ${memberName}`,
    badge: "PEMERIKSAAN BENDAHARA",
    maxWidthClass: "max-w-2xl",
    bodyHtml: `
      <div class="p-3.5 bg-parchment border-2 border-ink rounded-md grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div>
          <span class="text-brown font-semibold">Periode Tagihan:</span>
          <p class="font-bold text-ink">${escapeHTML(periodName)}</p>
        </div>
        <div>
          <span class="text-brown font-semibold">Nominal Diajukan:</span>
          <p class="font-display font-bold text-base tabular-money text-olive">${formatRupiah(payment.amount)}</p>
        </div>
        <div>
          <span class="text-brown font-semibold">Tujuan Transfer:</span>
          <p class="font-semibold text-ink">${escapeHTML(destText)}</p>
        </div>
        <div>
          <span class="text-brown font-semibold">Waktu Pengajuan:</span>
          <p class="font-semibold text-ink">${formatDateTimeID(payment.created_at)}</p>
        </div>
        ${
          payment.notes
            ? `<div class="sm:col-span-2 pt-1 border-t border-ink/20">
                <span class="text-brown font-semibold">Catatan Anggota:</span>
                <p class="text-ink">${escapeHTML(payment.notes)}</p>
              </div>`
            : ""
        }
      </div>
      <div id="inspector-proof-slot">
        ${renderLoadingState("Mengambil bukti transfer dari penyimpanan privat...")}
      </div>
    `,
    footerHtml: `<button type="button" data-close-modal class="varsity-btn-secondary">Tutup Pemeriksaan</button>`,
  });

  const proofSlot = modal.querySelector("#inspector-proof-slot");

  getPaymentProofSignedUrl(payment.proof_path)
    .then((signedUrl) => {
      const isPdf = payment.proof_path.toLowerCase().endsWith(".pdf");
      proofSlot.innerHTML = isPdf
        ? `
          <div class="space-y-3">
            <iframe src="${signedUrl}" class="w-full h-96 border-2 border-ink rounded" title="Bukti Transfer PDF"></iframe>
            <a href="${signedUrl}" target="_blank" rel="noopener noreferrer" class="varsity-btn-neutral w-full">
              Buka PDF di Tab Baru
            </a>
          </div>
        `
        : `
          <div class="space-y-3 text-center">
            <img src="${signedUrl}" alt="Bukti transfer anggota" class="max-h-[60vh] mx-auto border-2 border-ink rounded object-contain bg-parchment" />
            <a href="${signedUrl}" target="_blank" rel="noopener noreferrer" class="varsity-btn-neutral text-xs">
              Buka Gambar Resolusi Penuh
            </a>
          </div>
        `;
    })
    .catch((err) => {
      proofSlot.innerHTML = renderErrorState({
        title: "Gagal Membuka File Bukti",
        message: err.message,
      });
    });
}

function openRejectReasonModal(payment) {
  const memberName = payment.members?.full_name || "Anggota";
  const periodName = payment.cash_bills?.cash_periods?.name || "Periode Kas";

  const modal = openModal({
    title: "Tolak Pengajuan Transfer",
    badge: "WAJIB ALASAN",
    maxWidthClass: "max-w-md",
    bodyHtml: `
      <div class="p-3 bg-parchment border-2 border-ink rounded-md text-xs space-y-1">
        <p><span class="text-brown font-semibold">Anggota:</span> <strong>${escapeHTML(memberName)}</strong></p>
        <p><span class="text-brown font-semibold">Periode:</span> <strong>${escapeHTML(periodName)}</strong></p>
        <p><span class="text-brown font-semibold">Nominal:</span> <strong class="tabular-money">${formatRupiah(payment.amount)}</strong></p>
      </div>

      <form id="reject-payment-form" novalidate class="space-y-3">
        <div>
          <label for="rejection-reason-input" class="block font-display uppercase text-xs font-bold tracking-wider text-ink mb-1">
            Alasan Penolakan *
          </label>
          <textarea
            id="rejection-reason-input"
            rows="3"
            placeholder="Contoh: Nominal pada bukti transfer tidak sesuai dengan jumlah yang diajukan, atau gambar buram."
            class="varsity-input"
            required
          ></textarea>
          <p id="err-rejection-reason" class="hidden text-xs font-semibold text-champion-red mt-1"></p>
        </div>
      </form>
    `,
    footerHtml: `
      <button type="button" data-close-modal class="varsity-btn-neutral">Batal</button>
      <button type="submit" form="reject-payment-form" id="confirm-reject-btn" class="varsity-btn-primary">
        Tolak Pengajuan
      </button>
    `,
  });

  const form = modal.querySelector("#reject-payment-form");
  const reasonInput = modal.querySelector("#rejection-reason-input");
  const errEl = modal.querySelector("#err-rejection-reason");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const reason = reasonInput.value.trim();
    if (!reason) {
      errEl.textContent = "Alasan penolakan wajib diisi agar anggota dapat memperbaikinya.";
      errEl.classList.remove("hidden");
      return;
    }
    errEl.classList.add("hidden");

    const submitBtn = modal.querySelector("#confirm-reject-btn");
    setButtonLoading(submitBtn, true, "Menolak...");

    try {
      await verifyTransferPayment({
        paymentId: payment.id,
        decision: "rejected",
        rejectionReason: reason,
      });

      closeModal();
      showToast(`Pengajuan transfer dari ${memberName} telah ditolak.`, "warning");
      await loadVerificationData();
    } catch (err) {
      showToast(err.message || "Gagal menolak pengajuan transfer.", "error");
      setButtonLoading(submitBtn, false);
    }
  });
}

async function handleApprovePayment(payment) {
  const memberName = payment.members?.full_name || "Anggota";
  const periodName = payment.cash_bills?.cash_periods?.name || "Periode Kas";

  const confirmed = await openConfirmModal({
    title: "Setujui Pembayaran Transfer",
    message: `Sahkan pembayaran transfer sebesar ${formatRupiah(payment.amount)} dari ${memberName} (${periodName})? Sistem akan otomatis menambah saldo kas dan menerbitkan kuitansi digital.`,
    confirmLabel: "Ya, Sahkan & Terbitkan Kuitansi",
    variant: "primary",
  });

  if (!confirmed) return;

  try {
    await verifyTransferPayment({
      paymentId: payment.id,
      decision: "verified",
    });

    showToast(`Transfer ${formatRupiah(payment.amount)} dari ${memberName} terverifikasi! Kuitansi digital telah diterbitkan.`, "success");
    await loadVerificationData();
  } catch (err) {
    showToast(err.message || "Gagal memverifikasi pembayaran transfer.", "error");
  }
}

function renderPage() {
  if (!contentContainer) return;

  const counts = {
    pending: allPayments.filter((p) => p.status === "pending").length,
    verified: allPayments.filter((p) => p.status === "verified").length,
    rejected: allPayments.filter((p) => p.status === "rejected").length,
    all: allPayments.length,
  };

  const filtered = getFilteredPayments();

  const tabs = [
    { id: "pending", label: `Menunggu (${counts.pending})` },
    { id: "verified", label: `Terverifikasi (${counts.verified})` },
    { id: "rejected", label: `Ditolak (${counts.rejected})` },
    { id: "all", label: `Semua (${counts.all})` },
  ];

  const tabsHtml = tabs
    .map((tab) => {
      const active = filterState.status === tab.id;
      return `
        <button
          type="button"
          data-status-tab="${tab.id}"
          class="px-3.5 py-2 font-display uppercase text-xs font-bold tracking-wider border-2 border-ink rounded-md transition-colors ${
            active ? "bg-gold text-ink shadow-varsity-sm" : "bg-cream text-ink hover:bg-parchment"
          }"
        >
          ${tab.label}
        </button>
      `;
    })
    .join("");

  const cardsHtml = filtered
    .map((p) => {
      const st = getPaymentStatusMeta(p.status);
      const memberName = p.members?.full_name || "Anggota";
      const memberNim = p.members?.nim || "-";
      const periodName = p.cash_bills?.cash_periods?.name || "Periode Kas";
      const billDue = Number(p.cash_bills?.amount_due || 0);
      const billPaid = Number(p.cash_bills?.amount_paid || 0);
      const remaining = Math.max(0, billDue - billPaid);
      const destName = p.payment_destinations?.provider_name || "Transfer";
      const isPending = p.status === "pending";

      return `
        <article class="varsity-card-light p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div class="space-y-2 min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="varsity-badge ${st.className}">${st.label}</span>
              <span class="varsity-badge bg-parchment text-ink">
                ${p.method === "cash" ? "TUNAI" : `TRANSFER • ${escapeHTML(destName)}`}
              </span>
              <span class="text-xs text-brown">${formatDateTimeID(p.created_at)}</span>
            </div>

            <div>
              <h3 class="text-lg font-bold text-ink">
                ${escapeHTML(memberName)}
                <span class="font-mono text-xs font-normal text-brown ml-1">(${escapeHTML(memberNim)})</span>
              </h3>
              <p class="text-xs font-semibold text-olive">
                Tagihan: ${escapeHTML(periodName)} • Sisa kewajiban saat ini: <span class="tabular-money font-bold">${formatRupiah(remaining)}</span> dari ${formatRupiah(billDue)}
              </p>
            </div>

            ${
              p.notes
                ? `<p class="text-xs text-ink/80 bg-parchment/60 px-3 py-1.5 rounded border border-ink/20">
                    Catatan: ${escapeHTML(p.notes)}
                  </p>`
                : ""
            }

            ${
              p.status === "rejected" && p.rejection_reason
                ? `<p class="text-xs font-semibold text-champion-red bg-champion-red/10 px-3 py-1.5 rounded border border-champion-red">
                    Alasan Penolakan: ${escapeHTML(p.rejection_reason)}
                  </p>`
                : ""
            }
          </div>

          <div class="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-ink/20 shrink-0">
            <div class="lg:text-right">
              <p class="text-[11px] font-display uppercase font-bold text-brown">Nominal Pembayaran</p>
              <p class="font-display font-bold text-2xl tabular-money text-ink">${formatRupiah(p.amount)}</p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              ${
                p.proof_path
                  ? `<button type="button" data-inspect-proof="${p.id}" class="varsity-btn-neutral py-1.5 px-3 text-xs">
                      Lihat Bukti
                    </button>`
                  : ""
              }
              ${
                isPending
                  ? `
                    <button type="button" data-reject-id="${p.id}" class="varsity-btn-primary py-1.5 px-3 text-xs">
                      Tolak
                    </button>
                    <button type="button" data-approve-id="${p.id}" class="varsity-btn-secondary py-1.5 px-3 text-xs">
                      ✓ Setujui
                    </button>
                  `
                  : ""
              }
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  contentContainer.innerHTML = `
    <section class="varsity-panel-dark p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 varsity-stitch-light">
      <div class="space-y-1">
        <span class="varsity-badge bg-gold text-ink">OTORITAS BENDAHARA</span>
        <h2 class="text-xl font-bold uppercase text-cream">Verifikasi Pengajuan Transfer Kas</h2>
        <p class="text-xs sm:text-sm text-parchment">
          Periksa kesesuaian nominal dan bukti transfer sebelum menyetujui. Persetujuan akan menerbitkan kuitansi digital secara atomik.
        </p>
      </div>
      <button id="refresh-verification-btn" type="button" class="varsity-btn-secondary shrink-0">
        Muat Ulang
      </button>
    </section>

    <!-- Filter Bar -->
    <section class="varsity-card-light p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div class="flex flex-wrap gap-2">
        ${tabsHtml}
      </div>
      <div class="w-full md:w-72">
        <label for="verify-search" class="sr-only">Cari nama, NIM, atau periode</label>
        <input
          id="verify-search"
          type="search"
          value="${escapeHTML(filterState.search)}"
          placeholder="Cari nama, NIM, atau periode..."
          class="varsity-input py-2 text-xs"
        />
      </div>
    </section>

    <!-- Daftar Pengajuan -->
    <section class="space-y-3">
      ${
        filtered.length === 0
          ? renderEmptyState({
              title: "Tidak Ada Data Pengajuan",
              description:
                filterState.status === "pending"
                  ? "Semua pengajuan transfer dari anggota sudah selesai diverifikasi."
                  : "Tidak ada riwayat pembayaran yang cocok dengan filter saat ini.",
            })
          : cardsHtml
      }
    </section>
  `;

  // Event listeners
  document.getElementById("refresh-verification-btn")?.addEventListener("click", () => {
    loadVerificationData({ showToastSuccess: true });
  });

  contentContainer.querySelectorAll("[data-status-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      filterState.status = btn.dataset.statusTab;
      renderPage();
    });
  });

  document.getElementById("verify-search")?.addEventListener("input", (e) => {
    filterState.search = e.target.value;
    renderPage();
    const input = document.getElementById("verify-search");
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  });

  contentContainer.querySelectorAll("[data-inspect-proof]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const payment = allPayments.find((item) => item.id === btn.dataset.inspectProof);
      if (payment) openProofInspectorModal(payment);
    });
  });

  contentContainer.querySelectorAll("[data-approve-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const payment = allPayments.find((item) => item.id === btn.dataset.approveId);
      if (payment) handleApprovePayment(payment);
    });
  });

  contentContainer.querySelectorAll("[data-reject-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const payment = allPayments.find((item) => item.id === btn.dataset.rejectId);
      if (payment) openRejectReasonModal(payment);
    });
  });
}

async function loadVerificationData({ showToastSuccess = false } = {}) {
  if (!contentContainer) return;
  contentContainer.innerHTML = renderLoadingState("Memuat daftar pengajuan pembayaran...");

  try {
    allPayments = await fetchPayments();
    renderPage();
    if (showToastSuccess) {
      showToast("Daftar pengajuan pembayaran berhasil diperbarui.", "success");
    }
  } catch (err) {
    contentContainer.innerHTML = renderErrorState({
      title: "Gagal Memuat Antrean Verifikasi",
      message: err.message || "Terjadi kesalahan saat mengambil data pembayaran.",
      retryId: "retry-verification-btn",
    });
    document.getElementById("retry-verification-btn")?.addEventListener("click", () => {
      loadVerificationData({ showToastSuccess: true });
    });
  }
}

async function initVerificationPage() {
  const authData = await requireAuth(["bendahara"]);
  if (!authData) return;

  currentProfile = authData.profile;
  contentContainer = mountAppShell({
    profile: currentProfile,
    activeMenuId: "verification",
    pageTitle: "Verifikasi Pembayaran",
    pageSubtitle: "Pemeriksaan bukti transfer & pengesahan pembayaran anggota",
  });

  await loadVerificationData();
}

initVerificationPage();
