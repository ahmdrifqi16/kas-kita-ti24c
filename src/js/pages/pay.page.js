import { mountAppShell } from "../layouts/app-shell.js";
import { requireAuth } from "../guards/auth.guard.js";
import { fetchCashBills } from "../services/bills.service.js";
import { fetchPayments } from "../services/receipts.service.js";
import { cancelPendingPayment, fetchActiveDestinations, getPaymentProofSignedUrl, submitTransferPayment } from "../services/payments.service.js";
import { escapeHTML, formatDateID, formatDateTimeID, formatRupiah, getPaymentStatusMeta } from "../utils/formatters.js";
import { validateNominalRupiah, validateProofFile } from "../utils/validators.js";
import { setButtonLoading } from "../utils/dom.js";
import { renderEmptyState, renderErrorState, renderLoadingState, showToast } from "../components/ui-states.js";
import { openConfirmModal, openModal } from "../components/modal.js";

let currentSession = null;
let currentProfile = null;
let contentContainer = null;

let payableBills = [];
let destinations = [];
let memberPayments = [];

function getRemainingForBill(bill) {
  return Math.max(0, Number(bill.amount_due || 0) - Number(bill.amount_paid || 0));
}

function getPendingTotalForBill(billId) {
  return memberPayments.filter((p) => p.bill_id === billId && p.status === "pending").reduce((sum, p) => sum + Number(p.amount || 0), 0);
}

function openProofPreviewModal(proofPath, title = "Bukti Transfer Saya") {
  const modal = openModal({
    title,
    badge: "DOKUMEN PRIVAT",
    maxWidthClass: "max-w-xl",
    bodyHtml: renderLoadingState("Membuka tautan aman bukti transfer..."),
    footerHtml: `<button type="button" data-close-modal class="varsity-btn-secondary">Tutup</button>`,
  });

  const bodyEl = modal.querySelector(".overflow-y-auto");

  getPaymentProofSignedUrl(proofPath)
    .then((signedUrl) => {
      const isPdf = proofPath.toLowerCase().endsWith(".pdf");
      bodyEl.innerHTML = isPdf
        ? `
          <div class="space-y-3">
            <iframe src="${signedUrl}" class="w-full h-96 border-2 border-ink rounded" title="Bukti PDF"></iframe>
            <a href="${signedUrl}" target="_blank" rel="noopener noreferrer" class="varsity-btn-neutral w-full">
              Buka File PDF di Tab Baru
            </a>
          </div>
        `
        : `
          <div class="space-y-3 text-center">
            <img src="${signedUrl}" alt="Bukti transfer" class="max-h-[65vh] mx-auto border-2 border-ink rounded object-contain bg-parchment" />
            <a href="${signedUrl}" target="_blank" rel="noopener noreferrer" class="varsity-btn-neutral text-xs">
              Lihat Ukuran Penuh
            </a>
          </div>
        `;
    })
    .catch((err) => {
      bodyEl.innerHTML = renderErrorState({
        title: "Gagal Memuat Bukti",
        message: err.message,
      });
    });
}

function renderDestinationsCard() {
  if (destinations.length === 0) {
    return `
      <div class="varsity-card-light p-5">
        ${renderEmptyState({
          title: "Tujuan Transfer Belum Tersedia",
          description: "Bendahara belum mengaktifkan rekening bank atau e-wallet tujuan transfer.",
        })}
      </div>
    `;
  }

  const itemsHtml = destinations
    .map(
      (dest) => `
      <div class="p-3.5 bg-cream border-2 border-ink rounded-md space-y-1.5">
        <div class="flex items-center justify-between gap-2">
          <span class="varsity-badge bg-gold text-ink">${escapeHTML(dest.provider_name)}</span>
          <button
            type="button"
            data-copy-account="${escapeHTML(dest.account_number)}"
            class="varsity-btn-neutral py-1 px-2.5 text-[11px]"
          >
            Salin No. Rek
          </button>
        </div>
        <p class="font-mono text-lg font-bold tracking-wide text-ink select-all">
          ${escapeHTML(dest.account_number)}
        </p>
        <p class="text-xs font-semibold text-olive">
          a.n. ${escapeHTML(dest.account_holder)}
        </p>
        ${dest.instructions ? `<p class="text-xs text-brown pt-1 border-t border-ink/15">${escapeHTML(dest.instructions)}</p>` : ""}
      </div>
    `,
    )
    .join("");

  return `
    <section class="varsity-card-light p-5 space-y-3">
      <div class="border-b-2 border-ink pb-2.5">
        <h2 class="text-lg font-bold uppercase text-ink">Tujuan Transfer Resmi Kelas</h2>
        <p class="text-xs text-brown">Lakukan transfer ke salah satu rekening/e-wallet resmi di bawah ini</p>
      </div>
      <div class="space-y-3">
        ${itemsHtml}
      </div>
    </section>
  `;
}

function renderSubmissionFormSection() {
  if (!currentProfile.member_id) {
    return `
      <section class="bg-orange/25 border-2 border-ink rounded-md shadow-varsity p-6 space-y-2">
        <span class="varsity-badge bg-champion-red text-cream">AKUN BELUM DITAUTKAN</span>
        <h2 class="text-xl font-bold uppercase text-ink">Profil Belum Terhubung ke Data Anggota</h2>
        <p class="text-sm text-ink/90">
          Anda belum dapat mengirim pengajuan pembayaran sebelum Bendahara menautkan akun ini ke data anggota kelas TI24C Anda.
        </p>
      </section>
    `;
  }

  if (payableBills.length === 0) {
    return `
      <section class="varsity-card-light p-6">
        ${renderEmptyState({
          title: "Tidak Ada Tagihan Aktif",
          description: "Seluruh tagihan kas Anda sudah lunas atau belum ada periode penagihan aktif saat ini.",
        })}
      </section>
    `;
  }

  const billOptionsHtml = payableBills
    .map((bill) => {
      const remaining = getRemainingForBill(bill);
      const periodName = bill.cash_periods?.name || "Periode Kas";
      return `
        <option value="${bill.id}">
          ${escapeHTML(periodName)} — Sisa ${formatRupiah(remaining)} (Jatuh Tempo: ${formatDateID(bill.due_date)})
        </option>
      `;
    })
    .join("");

  const destOptionsHtml = destinations
    .map(
      (d) =>
        `<option value="${d.id}">${escapeHTML(d.provider_name)} — ${escapeHTML(d.account_number)} (a.n. ${escapeHTML(d.account_holder)})</option>`,
    )
    .join("");

  const firstBill = payableBills[0];
  const initialRemaining = getRemainingForBill(firstBill);

  return `
    <section class="varsity-card-light p-5 sm:p-6 space-y-5">
      <div class="border-b-2 border-ink pb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 class="text-xl font-bold uppercase text-ink">Form Pengajuan Pembayaran Transfer</h2>
          <p class="text-xs text-brown">Mendukung pembayaran penuh maupun cicilan bertahap</p>
        </div>
        <span class="varsity-badge bg-orange text-ink">VERIFIKASI BENDAHARA</span>
      </div>

      <form id="transfer-payment-form" novalidate class="space-y-4">
        <div>
          <label for="pay-bill-select" class="block font-display uppercase text-xs font-bold tracking-wider text-ink mb-1">
            Pilih Tagihan Kas *
          </label>
          <select id="pay-bill-select" class="varsity-input font-semibold" required>
            ${billOptionsHtml}
          </select>
          <p id="err-pay-bill" class="hidden text-xs font-semibold text-champion-red mt-1"></p>
        </div>

        <!-- Ringkasan Tagihan Terpilih -->
        <div id="selected-bill-summary" class="p-3.5 bg-parchment border-2 border-ink rounded-md grid grid-cols-3 gap-2 text-center">
          <div>
            <p class="text-[11px] font-display uppercase text-brown">Total Tagihan</p>
            <p id="sum-due" class="font-display font-bold text-base tabular-money text-ink">${formatRupiah(firstBill.amount_due)}</p>
          </div>
          <div>
            <p class="text-[11px] font-display uppercase text-brown">Sudah Sah</p>
            <p id="sum-paid" class="font-display font-bold text-base tabular-money text-olive">${formatRupiah(firstBill.amount_paid)}</p>
          </div>
          <div>
            <p class="text-[11px] font-display uppercase text-brown">Sisa Wajib</p>
            <p id="sum-remaining" class="font-display font-bold text-base tabular-money text-champion-red">${formatRupiah(initialRemaining)}</p>
          </div>
        </div>

        <div id="pending-bill-warning" class="hidden p-3 bg-orange/30 border-2 border-ink rounded-md text-xs text-ink font-medium"></div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label for="pay-destination-select" class="block font-display uppercase text-xs font-bold tracking-wider text-ink mb-1">
              Tujuan Transfer *
            </label>
            <select id="pay-destination-select" class="varsity-input" required>
              ${destOptionsHtml || '<option value="">Belum ada tujuan aktif</option>'}
            </select>
            <p id="err-pay-destination" class="hidden text-xs font-semibold text-champion-red mt-1"></p>
          </div>

          <div>
            <label for="pay-amount-input" class="block font-display uppercase text-xs font-bold tracking-wider text-ink mb-1">
              Nominal Transfer / Cicilan (Rp) *
            </label>
            <input
              id="pay-amount-input"
              type="number"
              min="1000"
              max="${initialRemaining}"
              step="500"
              value="${initialRemaining}"
              class="varsity-input tabular-money font-bold text-base"
              required
            />
            <p class="text-[11px] text-brown mt-1">Ubah nominal jika ingin membayar cicilan sebagian.</p>
            <p id="err-pay-amount" class="hidden text-xs font-semibold text-champion-red mt-1"></p>
          </div>
        </div>

        <div>
          <label for="pay-proof-file" class="block font-display uppercase text-xs font-bold tracking-wider text-ink mb-1">
            Unggah Bukti Transfer (JPG, PNG, WEBP, PDF • Maks 5 MB) *
          </label>
          <input
            id="pay-proof-file"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            class="varsity-input file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-2 file:border-ink file:bg-gold file:font-display file:uppercase file:text-xs file:font-bold file:text-ink cursor-pointer"
            required
          />
          <p id="err-pay-proof" class="hidden text-xs font-semibold text-champion-red mt-1"></p>
          <div id="proof-preview-box" class="hidden mt-3 p-3 bg-parchment border-2 border-ink rounded-md"></div>
        </div>

        <div>
          <label for="pay-notes-input" class="block font-display uppercase text-xs font-bold tracking-wider text-ink mb-1">
            Catatan Tambahan (Opsional)
          </label>
          <input
            id="pay-notes-input"
            type="text"
            placeholder="Contoh: Transfer dari rekening a.n. Alya P. jam 14:20"
            class="varsity-input"
          />
        </div>

        <button
          id="submit-transfer-btn"
          type="submit"
          ${destinations.length === 0 ? "disabled" : ""}
          class="varsity-btn-primary w-full py-3 text-base"
        >
          Kirim Pengajuan Pembayaran
        </button>
      </form>
    </section>
  `;
}

function renderRecentSubmissionsSection() {
  const recent = memberPayments.slice(0, 6);

  const itemsHtml = recent
    .map((p) => {
      const st = getPaymentStatusMeta(p.status);
      const periodName = p.cash_bills?.cash_periods?.name || "Periode Kas";
      const isPending = p.status === "pending";

      return `
        <article class="p-4 bg-cream border-2 border-ink rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="space-y-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="varsity-badge ${st.className}">${st.label}</span>
              <span class="text-xs font-semibold text-brown">
                ${p.method === "cash" ? "Tunai" : "Transfer"} • ${formatDateTimeID(p.created_at)}
              </span>
            </div>
            <h3 class="font-bold text-base text-ink">${escapeHTML(periodName)}</h3>
            <p class="font-display font-bold text-lg tabular-money text-olive">${formatRupiah(p.amount)}</p>
            ${
              p.status === "rejected" && p.rejection_reason
                ? `<p class="text-xs font-semibold text-champion-red bg-champion-red/10 border border-champion-red px-2.5 py-1.5 rounded">
                    Alasan Penolakan: ${escapeHTML(p.rejection_reason)}
                  </p>`
                : ""
            }
          </div>

          <div class="flex flex-wrap items-center gap-2 shrink-0">
            ${
              p.proof_path
                ? `<button type="button" data-view-proof="${escapeHTML(p.proof_path)}" class="varsity-btn-neutral py-1.5 px-3 text-xs">
                    Lihat Bukti
                  </button>`
                : ""
            }
            ${
              isPending
                ? `<button type="button" data-cancel-payment="${p.id}" class="varsity-btn-primary py-1.5 px-3 text-xs">
                    Batalkan
                  </button>`
                : ""
            }
          </div>
        </article>
      `;
    })
    .join("");

  return `
    <section class="varsity-card-light p-5 space-y-4">
      <div class="flex items-center justify-between border-b-2 border-ink pb-2.5">
        <div>
          <h2 class="text-lg font-bold uppercase text-ink">Status Pengajuan & Pembayaran Saya</h2>
          <p class="text-xs text-brown">Pengajuan berstatus Menunggu Verifikasi belum menambah saldo kas hingga disahkan Bendahara</p>
        </div>
        <span class="varsity-badge bg-parchment text-ink">${memberPayments.length} CATATAN</span>
      </div>

      ${
        recent.length === 0
          ? renderEmptyState({
              title: "Belum Ada Riwayat Pembayaran",
              description: "Pengajuan pembayaran transfer Anda akan tampil di bagian ini.",
            })
          : `<div class="space-y-3">${itemsHtml}</div>`
      }
    </section>
  `;
}

function bindPageEvents() {
  // Salin nomor rekening
  contentContainer.querySelectorAll("[data-copy-account]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const acc = btn.dataset.copyAccount;
      try {
        await navigator.clipboard.writeText(acc);
        showToast(`Nomor rekening ${acc} berhasil disalin.`, "success");
      } catch {
        showToast(`Salin manual nomor rekening: ${acc}`, "info");
      }
    });
  });

  // Lihat bukti transfer milik sendiri
  contentContainer.querySelectorAll("[data-view-proof]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openProofPreviewModal(btn.dataset.viewProof);
    });
  });

  // Batalkan pengajuan pending
  contentContainer.querySelectorAll("[data-cancel-payment]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const paymentId = btn.dataset.cancelPayment;
      const confirmed = await openConfirmModal({
        title: "Batalkan Pengajuan Transfer",
        message: "Pengajuan transfer yang masih menunggu verifikasi ini akan dibatalkan. Lanjutkan?",
        confirmLabel: "Ya, Batalkan",
        variant: "danger",
      });

      if (!confirmed) return;

      try {
        await cancelPendingPayment(paymentId);
        showToast("Pengajuan transfer berhasil dibatalkan.", "success");
        await loadPayPageData();
      } catch (err) {
        showToast(err.message || "Gagal membatalkan pengajuan.", "error");
      }
    });
  });

  // Form Pengajuan Transfer
  const form = document.getElementById("transfer-payment-form");
  if (!form) return;

  const billSelect = document.getElementById("pay-bill-select");
  const destSelect = document.getElementById("pay-destination-select");
  const amountInput = document.getElementById("pay-amount-input");
  const proofInput = document.getElementById("pay-proof-file");
  const notesInput = document.getElementById("pay-notes-input");
  const previewBox = document.getElementById("proof-preview-box");
  const pendingWarningEl = document.getElementById("pending-bill-warning");

  const updateSelectedBillSummary = () => {
    const selectedBill = payableBills.find((b) => b.id === billSelect.value);
    if (!selectedBill) return;

    const remaining = getRemainingForBill(selectedBill);
    const pendingSum = getPendingTotalForBill(selectedBill.id);

    document.getElementById("sum-due").textContent = formatRupiah(selectedBill.amount_due);
    document.getElementById("sum-paid").textContent = formatRupiah(selectedBill.amount_paid);
    document.getElementById("sum-remaining").textContent = formatRupiah(remaining);

    amountInput.max = String(remaining);
    amountInput.value = String(Math.max(1000, remaining - pendingSum));

    if (pendingSum > 0) {
      pendingWarningEl.textContent = `Perhatian: Anda sudah memiliki pengajuan pending sebesar ${formatRupiah(
        pendingSum,
      )} pada tagihan ini yang sedang diperiksa Bendahara.`;
      pendingWarningEl.classList.remove("hidden");
    } else {
      pendingWarningEl.classList.add("hidden");
    }
  };

  updateSelectedBillSummary();
  billSelect.addEventListener("change", updateSelectedBillSummary);

  // Pratinjau file lokal sebelum unggah
  proofInput.addEventListener("change", () => {
    const file = proofInput.files?.[0];
    const check = validateProofFile(file);
    const errEl = document.getElementById("err-pay-proof");

    if (!file || !check.valid) {
      previewBox.classList.add("hidden");
      previewBox.innerHTML = "";
      if (file && !check.valid) {
        errEl.textContent = check.message;
        errEl.classList.remove("hidden");
      }
      return;
    }

    errEl.classList.add("hidden");
    if (file.type.startsWith("image/")) {
      const objectUrl = URL.createObjectURL(file);
      previewBox.innerHTML = `
        <p class="text-xs font-display uppercase font-bold text-ink mb-2">Pratinjau Bukti Transfer:</p>
        <img src="${objectUrl}" alt="Pratinjau bukti" class="max-h-48 rounded border border-ink object-contain bg-cream" />
      `;
    } else {
      previewBox.innerHTML = `
        <p class="text-xs font-semibold text-ink">File PDF dipilih: <strong>${escapeHTML(file.name)}</strong> (${(file.size / 1024 / 1024).toFixed(
          2,
        )} MB)</p>
      `;
    }
    previewBox.classList.remove("hidden");
  });

  const setFieldError = (id, msg) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.classList.remove("hidden");
    } else {
      el.textContent = "";
      el.classList.add("hidden");
    }
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const selectedBill = payableBills.find((b) => b.id === billSelect.value);
    const destinationId = destSelect.value;
    const rawAmount = amountInput.value;
    const proofFile = proofInput.files?.[0];
    const notes = notesInput.value.trim();

    let hasError = false;

    if (!selectedBill) {
      setFieldError("err-pay-bill", "Pilih tagihan kas terlebih dahulu.");
      hasError = true;
    } else {
      setFieldError("err-pay-bill", "");
    }

    if (!destinationId) {
      setFieldError("err-pay-destination", "Pilih tujuan transfer resmi.");
      hasError = true;
    } else {
      setFieldError("err-pay-destination", "");
    }

    const maxAllowed = selectedBill ? getRemainingForBill(selectedBill) : 0;
    const amountCheck = validateNominalRupiah(rawAmount, { min: 1000, max: maxAllowed });
    if (!amountCheck.valid) {
      setFieldError("err-pay-amount", amountCheck.message);
      hasError = true;
    } else {
      setFieldError("err-pay-amount", "");
    }

    const fileCheck = validateProofFile(proofFile, 5);
    if (!fileCheck.valid) {
      setFieldError("err-pay-proof", fileCheck.message);
      hasError = true;
    } else {
      setFieldError("err-pay-proof", "");
    }

    if (hasError) return;

    const confirmed = await openConfirmModal({
      title: "Kirim Pengajuan Transfer",
      message: `Ajukan pembayaran transfer sebesar ${formatRupiah(amountCheck.value)} untuk ${
        selectedBill.cash_periods?.name || "tagihan kas"
      }? Pastikan nominal dan bukti transfer sudah benar.`,
      confirmLabel: "Ya, Kirim Pengajuan",
      variant: "primary",
    });

    if (!confirmed) return;

    const submitBtn = document.getElementById("submit-transfer-btn");
    setButtonLoading(submitBtn, true, "Mengunggah Bukti...");

    try {
      await submitTransferPayment({
        userId: currentSession.user.id,
        memberId: currentProfile.member_id,
        billId: selectedBill.id,
        destinationId,
        amount: amountCheck.value,
        proofFile: fileCheck.value,
        notes,
      });

      showToast("Pengajuan transfer berhasil dikirim! Menunggu verifikasi Bendahara.", "success");
      await loadPayPageData();
    } catch (err) {
      showToast(err.message || "Gagal mengirim pengajuan pembayaran.", "error");
      setButtonLoading(submitBtn, false);
    }
  });
}

async function loadPayPageData() {
  if (!contentContainer) return;
  contentContainer.innerHTML = renderLoadingState("Memuat tagihan & rekening tujuan resmi...");

  try {
    const [bills, activeDests, payments] = await Promise.all([fetchCashBills(), fetchActiveDestinations(), fetchPayments()]);

    payableBills = bills.filter((b) => ["unpaid", "partial", "overdue"].includes(b.status));
    destinations = activeDests;
    memberPayments = payments;

    contentContainer.innerHTML = `
      <section class="varsity-panel-dark p-5 varsity-stitch-light">
        <span class="varsity-badge bg-gold text-ink">PEMBAYARAN ANGGOTA</span>
        <h2 class="text-xl font-bold uppercase text-cream mt-2">Ajukan Pembayaran Kas via Transfer</h2>
        <p class="text-xs sm:text-sm text-parchment mt-1">
          Transfer sesuai nominal kewajiban atau cicilan, lalu unggah bukti agar dapat diverifikasi oleh Bendahara kelas.
        </p>
      </section>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div class="lg:col-span-7">
          ${renderSubmissionFormSection()}
        </div>
        <div class="lg:col-span-5">
          ${renderDestinationsCard()}
        </div>
      </div>

      ${renderRecentSubmissionsSection()}
    `;

    bindPageEvents();
  } catch (err) {
    contentContainer.innerHTML = renderErrorState({
      title: "Gagal Memuat Halaman Pembayaran",
      message: err.message || "Terjadi kesalahan saat mengambil data tagihan.",
      retryId: "retry-pay-btn",
    });
    document.getElementById("retry-pay-btn")?.addEventListener("click", loadPayPageData);
  }
}

async function initPayPage() {
  const authData = await requireAuth(["anggota"]);
  if (!authData) return;

  currentSession = authData.session;
  currentProfile = authData.profile;

  contentContainer = mountAppShell({
    profile: currentProfile,
    activeMenuId: "pay",
    pageTitle: "Bayar Kas Kelas",
    pageSubtitle: "Pengajuan pembayaran transfer & unggah bukti pembayaran",
  });

  await loadPayPageData();
}

initPayPage();
