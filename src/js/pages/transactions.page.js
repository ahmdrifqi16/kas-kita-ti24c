import { mountAppShell } from "../layouts/app-shell.js";
import { requireAuth } from "../guards/auth.guard.js";
import {
  fetchCashSummary,
  fetchFullTransactions,
  getExpenseAttachmentSignedUrl,
  recordExpense,
  recordOtherIncome,
  reverseManualTransaction,
} from "../services/transactions.service.js";
import { fetchTransactionCategories } from "../services/reports.service.js";
import { escapeHTML, formatDateID, formatRupiah } from "../utils/formatters.js";
import { validateNominalRupiah, validateProofFile } from "../utils/validators.js";
import { setButtonLoading } from "../utils/dom.js";
import { renderEmptyState, renderErrorState, renderLoadingState, showToast } from "../components/ui-states.js";
import { closeModal, openConfirmModal, openModal } from "../components/modal.js";

let currentProfile = null;
let contentContainer = null;

let summaryState = { totalIncome: 0, totalExpense: 0, currentBalance: 0 };
let allTransactions = [];
let categories = [];

let filterState = {
  type: "all",
  categoryId: "all",
  showReversed: false,
  search: "",
};

function getFilteredTransactions() {
  return allTransactions.filter((trx) => {
    if (!filterState.showReversed && trx.is_reversed) {
      return false;
    }
    if (filterState.type !== "all" && trx.type !== filterState.type) {
      return false;
    }
    if (filterState.categoryId !== "all" && trx.category_id !== filterState.categoryId) {
      return false;
    }
    if (filterState.search.trim()) {
      const q = filterState.search.trim().toLowerCase();
      const num = (trx.trx_number || "").toLowerCase();
      const desc = (trx.description || "").toLowerCase();
      const pubDesc = (trx.public_description || "").toLowerCase();
      if (!num.includes(q) && !desc.includes(q) && !pubDesc.includes(q)) {
        return false;
      }
    }
    return true;
  });
}

function openRecordExpenseModal() {
  const expenseCategories = categories.filter((c) => c.type === "expense");
  const today = new Date().toISOString().split("T")[0];

  const catOptionsHtml = expenseCategories.map((c) => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join("");

  const modal = openModal({
    title: "Catat Pengeluaran Kas",
    badge: "PENGELUARAN BENDAHARA",
    maxWidthClass: "max-w-lg",
    bodyHtml: `
      <div class="p-3 bg-parchment border-2 border-ink rounded-md flex items-center justify-between">
        <span class="text-xs font-display uppercase font-bold text-brown">Saldo Kas Tersedia:</span>
        <span class="font-display font-bold text-lg tabular-money text-olive">${formatRupiah(summaryState.currentBalance)}</span>
      </div>

      <form id="record-expense-form" novalidate class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label for="exp-category" class="block font-display uppercase text-xs font-bold tracking-wider text-ink mb-1">
              Kategori Pengeluaran *
            </label>
            <select id="exp-category" class="varsity-input" required>
              ${catOptionsHtml}
            </select>
            <p id="err-exp-category" class="hidden text-xs font-semibold text-champion-red mt-1"></p>
          </div>

          <div>
            <label for="exp-date" class="block font-display uppercase text-xs font-bold tracking-wider text-ink mb-1">
              Tanggal Transaksi *
            </label>
            <input id="exp-date" type="date" value="${today}" class="varsity-input" required />
            <p id="err-exp-date" class="hidden text-xs font-semibold text-champion-red mt-1"></p>
          </div>
        </div>

        <div>
          <label for="exp-amount" class="block font-display uppercase text-xs font-bold tracking-wider text-ink mb-1">
            Nominal Pengeluaran (Rp) *
          </label>
          <input
            id="exp-amount"
            type="number"
            min="1000"
            max="${summaryState.currentBalance}"
            step="500"
            placeholder="Contoh: 25000"
            class="varsity-input tabular-money font-bold text-base"
            required
          />
          <p id="err-exp-amount" class="hidden text-xs font-semibold text-champion-red mt-1"></p>
        </div>

        <div>
          <label for="exp-description" class="block font-display uppercase text-xs font-bold tracking-wider text-ink mb-1">
            Deskripsi Lengkap (Catatan Internal) *
          </label>
          <textarea
            id="exp-description"
            rows="2"
            placeholder="Contoh: Pembelian 2 spidol whiteboard & penghapus di Toko ATK Kampus"
            class="varsity-input"
            required
          ></textarea>
          <p id="err-exp-description" class="hidden text-xs font-semibold text-champion-red mt-1"></p>
        </div>

        <div>
          <label for="exp-public-desc" class="block font-display uppercase text-xs font-bold tracking-wider text-ink mb-1">
            Keterangan Transparansi Publik (Opsional)
          </label>
          <input
            id="exp-public-desc"
            type="text"
            placeholder="Kosongkan jika sama dengan deskripsi di atas"
            class="varsity-input"
          />
        </div>

        <div>
          <label for="exp-attachment" class="block font-display uppercase text-xs font-bold tracking-wider text-ink mb-1">
            Nota / Bukti Pengeluaran (Opsional • JPG, PNG, WEBP, PDF maks 5 MB)
          </label>
          <input
            id="exp-attachment"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            class="varsity-input file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-2 file:border-ink file:bg-gold file:font-display file:uppercase file:text-xs file:font-bold file:text-ink cursor-pointer"
          />
          <p id="err-exp-attachment" class="hidden text-xs font-semibold text-champion-red mt-1"></p>
        </div>
      </form>
    `,
    footerHtml: `
      <button type="button" data-close-modal class="varsity-btn-neutral">Batal</button>
      <button type="submit" form="record-expense-form" id="submit-expense-btn" class="varsity-btn-primary">
        Simpan Pengeluaran
      </button>
    `,
  });

  const form = modal.querySelector("#record-expense-form");
  const showErr = (id, msg) => {
    const el = modal.querySelector(`#${id}`);
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

    const categoryId = modal.querySelector("#exp-category").value;
    const trxDate = modal.querySelector("#exp-date").value;
    const rawAmount = modal.querySelector("#exp-amount").value;
    const description = modal.querySelector("#exp-description").value.trim();
    const publicDescription = modal.querySelector("#exp-public-desc").value.trim();
    const attachmentFile = modal.querySelector("#exp-attachment").files?.[0] || null;

    let hasError = false;

    if (!categoryId) {
      showErr("err-exp-category", "Kategori pengeluaran wajib dipilih.");
      hasError = true;
    } else {
      showErr("err-exp-category", "");
    }

    if (!trxDate) {
      showErr("err-exp-date", "Tanggal transaksi wajib diisi.");
      hasError = true;
    } else {
      showErr("err-exp-date", "");
    }

    const amountCheck = validateNominalRupiah(rawAmount, {
      min: 1000,
      max: summaryState.currentBalance,
    });
    if (!amountCheck.valid) {
      showErr("err-exp-amount", amountCheck.message);
      hasError = true;
    } else {
      showErr("err-exp-amount", "");
    }

    if (!description) {
      showErr("err-exp-description", "Deskripsi pengeluaran wajib diisi.");
      hasError = true;
    } else {
      showErr("err-exp-description", "");
    }

    if (attachmentFile) {
      const fileCheck = validateProofFile(attachmentFile, 5);
      if (!fileCheck.valid) {
        showErr("err-exp-attachment", fileCheck.message);
        hasError = true;
      } else {
        showErr("err-exp-attachment", "");
      }
    } else {
      showErr("err-exp-attachment", "");
    }

    if (hasError) return;

    const submitBtn = modal.querySelector("#submit-expense-btn");
    setButtonLoading(submitBtn, true, "Menyimpan...");

    try {
      await recordExpense({
        categoryId,
        amount: amountCheck.value,
        trxDate,
        description,
        publicDescription,
        attachmentFile,
      });

      closeModal();
      showToast(`Pengeluaran ${formatRupiah(amountCheck.value)} berhasil dicatat ke buku besar.`, "success");
      await loadTransactionsData();
    } catch (err) {
      showToast(err.message || "Gagal mencatat pengeluaran.", "error");
      setButtonLoading(submitBtn, false);
    }
  });
}

function openRecordOtherIncomeModal() {
  const incomeCategories = categories.filter((c) => c.type === "income" && c.code !== "INC_KAS");
  const today = new Date().toISOString().split("T")[0];

  const catOptionsHtml = incomeCategories.map((c) => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join("");

  const modal = openModal({
    title: "Catat Pemasukan Non-Tagihan",
    badge: "DONASI / PEMASUKAN LAIN",
    maxWidthClass: "max-w-lg",
    bodyHtml: `
      <p class="text-xs text-brown bg-parchment border border-ink rounded p-3">
        Gunakan form ini hanya untuk pemasukan di luar iuran periodik anggota (misalnya donasi acara atau sisa dana kegiatan). Untuk iuran anggota, gunakan menu <strong>Periode & Tagihan</strong> atau <strong>Verifikasi Bayar</strong>.
      </p>

      <form id="record-income-form" novalidate class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label for="inc-category" class="block font-display uppercase text-xs font-bold tracking-wider text-ink mb-1">
              Kategori Pemasukan *
            </label>
            <select id="inc-category" class="varsity-input" required>
              ${catOptionsHtml}
            </select>
          </div>

          <div>
            <label for="inc-date" class="block font-display uppercase text-xs font-bold tracking-wider text-ink mb-1">
              Tanggal Masuk *
            </label>
            <input id="inc-date" type="date" value="${today}" class="varsity-input" required />
          </div>
        </div>

        <div>
          <label for="inc-amount" class="block font-display uppercase text-xs font-bold tracking-wider text-ink mb-1">
            Nominal Pemasukan (Rp) *
          </label>
          <input
            id="inc-amount"
            type="number"
            min="1000"
            step="500"
            placeholder="Contoh: 50000"
            class="varsity-input tabular-money font-bold text-base"
            required
          />
          <p id="err-inc-amount" class="hidden text-xs font-semibold text-champion-red mt-1"></p>
        </div>

        <div>
          <label for="inc-description" class="block font-display uppercase text-xs font-bold tracking-wider text-ink mb-1">
            Keterangan Pemasukan *
          </label>
          <textarea
            id="inc-description"
            rows="2"
            placeholder="Contoh: Donasi tambahan kas untuk kegiatan makrab TI24C"
            class="varsity-input"
            required
          ></textarea>
          <p id="err-inc-description" class="hidden text-xs font-semibold text-champion-red mt-1"></p>
        </div>
      </form>
    `,
    footerHtml: `
      <button type="button" data-close-modal class="varsity-btn-neutral">Batal</button>
      <button type="submit" form="record-income-form" id="submit-income-btn" class="varsity-btn-secondary">
        Simpan Pemasukan
      </button>
    `,
  });

  const form = modal.querySelector("#record-income-form");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const categoryId = modal.querySelector("#inc-category").value;
    const trxDate = modal.querySelector("#inc-date").value;
    const rawAmount = modal.querySelector("#inc-amount").value;
    const description = modal.querySelector("#inc-description").value.trim();

    const errAmt = modal.querySelector("#err-inc-amount");
    const errDesc = modal.querySelector("#err-inc-description");

    const amtCheck = validateNominalRupiah(rawAmount, { min: 1000 });
    errAmt.classList.toggle("hidden", amtCheck.valid);
    if (!amtCheck.valid) errAmt.textContent = amtCheck.message;

    errDesc.classList.toggle("hidden", Boolean(description));
    if (!description) errDesc.textContent = "Keterangan pemasukan wajib diisi.";

    if (!amtCheck.valid || !description) return;

    const submitBtn = modal.querySelector("#submit-income-btn");
    setButtonLoading(submitBtn, true, "Menyimpan...");

    try {
      await recordOtherIncome({
        categoryId,
        amount: amtCheck.value,
        trxDate,
        description,
        createdBy: currentProfile.id,
      });

      closeModal();
      showToast(`Pemasukan tambahan ${formatRupiah(amtCheck.value)} berhasil dicatat.`, "success");
      await loadTransactionsData();
    } catch (err) {
      showToast(err.message || "Gagal mencatat pemasukan.", "error");
      setButtonLoading(submitBtn, false);
    }
  });
}

function openAttachmentModal(trx) {
  const modal = openModal({
    title: `Nota Pendukung — ${trx.trx_number}`,
    badge: "BUKTI TRANSAKSI",
    maxWidthClass: "max-w-xl",
    bodyHtml: renderLoadingState("Membuka nota pengeluaran dari penyimpanan privat..."),
    footerHtml: `<button type="button" data-close-modal class="varsity-btn-secondary">Tutup</button>`,
  });

  const bodyEl = modal.querySelector(".overflow-y-auto");

  getExpenseAttachmentSignedUrl(trx.attachment_path)
    .then((signedUrl) => {
      const isPdf = trx.attachment_path.toLowerCase().endsWith(".pdf");
      bodyEl.innerHTML = isPdf
        ? `
          <div class="space-y-3">
            <iframe src="${signedUrl}" class="w-full h-96 border-2 border-ink rounded" title="Nota PDF"></iframe>
            <a href="${signedUrl}" target="_blank" rel="noopener noreferrer" class="varsity-btn-neutral w-full">
              Buka PDF di Tab Baru
            </a>
          </div>
        `
        : `
          <div class="space-y-3 text-center">
            <img src="${signedUrl}" alt="Nota pengeluaran" class="max-h-[60vh] mx-auto border-2 border-ink rounded object-contain bg-parchment" />
            <a href="${signedUrl}" target="_blank" rel="noopener noreferrer" class="varsity-btn-neutral text-xs">
              Buka Gambar Ukuran Penuh
            </a>
          </div>
        `;
    })
    .catch((err) => {
      bodyEl.innerHTML = renderErrorState({
        title: "Gagal Membuka Nota",
        message: err.message,
      });
    });
}

function openReversalModal(trx) {
  const modal = openModal({
    title: `Pembatalan Tercatat (Reversal)`,
    badge: trx.trx_number,
    maxWidthClass: "max-w-md",
    bodyHtml: `
      <div class="p-3 bg-parchment border-2 border-ink rounded-md text-xs space-y-1">
        <p><span class="text-brown font-semibold">Referensi:</span> <strong>${escapeHTML(trx.trx_number)}</strong></p>
        <p><span class="text-brown font-semibold">Nominal:</span> <strong class="tabular-money">${formatRupiah(trx.amount)}</strong></p>
        <p><span class="text-brown font-semibold">Keterangan:</span> ${escapeHTML(trx.description)}</p>
      </div>
      <p class="text-xs text-ink/85">
        Sesuai aturan audit keuangan, transaksi tidak dihapus fisik melainkan ditandai sebagai <strong>Dibatalkan (Reversed)</strong> dan dikeluarkan dari perhitungan saldo aktif.
      </p>
      <form id="reversal-form" novalidate class="space-y-3">
        <div>
          <label for="reversal-reason-input" class="block font-display uppercase text-xs font-bold tracking-wider text-ink mb-1">
            Alasan Pembatalan / Koreksi *
          </label>
          <textarea
            id="reversal-reason-input"
            rows="3"
            placeholder="Contoh: Salah input nominal nota pembelian konsumsi rapat"
            class="varsity-input"
            required
          ></textarea>
          <p id="err-reversal-reason" class="hidden text-xs font-semibold text-champion-red mt-1"></p>
        </div>
      </form>
    `,
    footerHtml: `
      <button type="button" data-close-modal class="varsity-btn-neutral">Batal</button>
      <button type="submit" form="reversal-form" id="confirm-reversal-btn" class="varsity-btn-primary">
        Sahkan Pembatalan
      </button>
    `,
  });

  const form = modal.querySelector("#reversal-form");
  const reasonInput = modal.querySelector("#reversal-reason-input");
  const errEl = modal.querySelector("#err-reversal-reason");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const reason = reasonInput.value.trim();
    if (!reason) {
      errEl.textContent = "Alasan pembatalan transaksi wajib diisi untuk audit log.";
      errEl.classList.remove("hidden");
      return;
    }
    errEl.classList.add("hidden");

    const submitBtn = modal.querySelector("#confirm-reversal-btn");
    setButtonLoading(submitBtn, true, "Memproses...");

    try {
      await reverseManualTransaction({
        trxId: trx.id,
        reason,
        reversedBy: currentProfile.id,
      });

      closeModal();
      showToast(`Transaksi ${trx.trx_number} ditandai batal dan saldo diperbarui.`, "warning");
      await loadTransactionsData();
    } catch (err) {
      showToast(err.message || "Gagal membatalkan transaksi.", "error");
      setButtonLoading(submitBtn, false);
    }
  });
}

function renderPage() {
  if (!contentContainer) return;

  const filtered = getFilteredTransactions();
  const catOptionsHtml = categories
    .map((c) => `<option value="${c.id}" ${filterState.categoryId === c.id ? "selected" : ""}>${escapeHTML(c.name)}</option>`)
    .join("");

  const rowsHtml = filtered
    .map((trx) => {
      const isIncome = trx.type === "income";
      const isReversed = Boolean(trx.is_reversed);
      const isFromPayment = Boolean(trx.payment_id);
      const catName = trx.transaction_categories?.name || "-";

      return `
        <tr class="${isReversed ? "bg-champion-red/10 opacity-75" : "hover:bg-parchment/40"}">
          <td class="py-3 px-4 font-mono text-xs font-bold text-ink">
            ${escapeHTML(trx.trx_number)}
            ${isReversed ? `<span class="block mt-1 varsity-badge bg-champion-red text-cream text-[10px]">DIBATALKAN</span>` : ""}
          </td>
          <td class="py-3 px-4 text-xs text-brown whitespace-nowrap">
            ${formatDateID(trx.trx_date)}
          </td>
          <td class="py-3 px-4">
            <span class="varsity-badge ${isIncome ? "bg-gold text-ink" : "bg-orange text-ink"}">
              ${escapeHTML(catName)}
            </span>
          </td>
          <td class="py-3 px-4 text-sm text-ink">
            <p class="${isReversed ? "line-through" : ""}">${escapeHTML(trx.description)}</p>
            ${
              isReversed && trx.reversal_reason
                ? `<p class="text-xs text-champion-red font-semibold mt-0.5">Alasan batal: ${escapeHTML(trx.reversal_reason)}</p>`
                : ""
            }
          </td>
          <td class="py-3 px-4 text-right font-bold tabular-money whitespace-nowrap ${
            isReversed ? "line-through text-brown" : isIncome ? "text-olive" : "text-champion-red"
          }">
            ${isIncome ? "+" : "-"} ${formatRupiah(trx.amount)}
          </td>
          <td class="py-3 px-4 text-right whitespace-nowrap space-x-1">
            ${
              trx.attachment_path
                ? `<button type="button" data-view-nota="${trx.id}" class="varsity-btn-neutral py-1 px-2.5 text-xs">
                    Nota
                  </button>`
                : ""
            }
            ${
              !isReversed && !isFromPayment
                ? `<button type="button" data-reverse-trx="${trx.id}" class="varsity-btn-primary py-1 px-2.5 text-xs">
                    Batal
                  </button>`
                : isFromPayment
                  ? `<span class="text-[11px] font-semibold text-brown">Otomatis Kas</span>`
                  : ""
            }
          </td>
        </tr>
      `;
    })
    .join("");

  contentContainer.innerHTML = `
    <!-- Action Bar -->
    <section class="varsity-panel-dark p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 varsity-stitch-light">
      <div class="space-y-1">
        <span class="varsity-badge bg-gold text-ink">BUKU BESAR RESMI</span>
        <h2 class="text-xl font-bold uppercase text-cream">Pemasukan & Pengeluaran Kas TI24C</h2>
        <p class="text-xs sm:text-sm text-parchment">
          Catat pengeluaran operasional beserta nota bukti atau tambahkan pemasukan donasi kelas.
        </p>
      </div>
      <div class="flex flex-wrap gap-2 shrink-0">
        <button id="open-income-modal-btn" type="button" class="varsity-btn-secondary">
          + Pemasukan Lain
        </button>
        <button id="open-expense-modal-btn" type="button" class="varsity-btn-primary">
          - Catat Pengeluaran
        </button>
      </div>
    </section>

    <!-- Ringkasan Saldo -->
    <section class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <article class="bg-gold border-2 border-ink rounded-md shadow-varsity p-4 sm:p-5">
        <p class="font-display uppercase text-xs font-bold text-brown">Saldo Kas Resmi</p>
        <p class="font-display font-bold text-2xl sm:text-3xl text-ink tabular-money mt-1">
          ${formatRupiah(summaryState.currentBalance)}
        </p>
      </article>
      <article class="bg-parchment border-2 border-ink rounded-md shadow-varsity p-4 sm:p-5">
        <p class="font-display uppercase text-xs font-bold text-brown">Total Pemasukan Sah</p>
        <p class="font-display font-bold text-2xl sm:text-3xl text-olive tabular-money mt-1">
          ${formatRupiah(summaryState.totalIncome)}
        </p>
      </article>
      <article class="bg-cream border-2 border-ink rounded-md shadow-varsity p-4 sm:p-5">
        <p class="font-display uppercase text-xs font-bold text-brown">Total Pengeluaran Sah</p>
        <p class="font-display font-bold text-2xl sm:text-3xl text-champion-red tabular-money mt-1">
          ${formatRupiah(summaryState.totalExpense)}
        </p>
      </article>
    </section>

    <!-- Tabel Ledger & Filter -->
    <section class="varsity-card-light overflow-hidden">
      <div class="p-4 sm:p-5 bg-parchment border-b-2 border-ink space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-lg font-bold uppercase text-ink">Riwayat Mutasi Buku Besar</h3>
          <label class="inline-flex items-center gap-2 text-xs font-semibold text-ink cursor-pointer">
            <input id="toggle-reversed" type="checkbox" ${filterState.showReversed ? "checked" : ""} class="accent-olive" />
            <span>Tampilkan transaksi dibatalkan (reversal)</span>
          </label>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label for="filter-trx-type" class="block font-display uppercase text-[11px] font-bold text-ink mb-1">Jenis Mutasi</label>
            <select id="filter-trx-type" class="varsity-input py-2 text-xs font-semibold">
              <option value="all" ${filterState.type === "all" ? "selected" : ""}>Semua Jenis</option>
              <option value="income" ${filterState.type === "income" ? "selected" : ""}>Pemasukan (+)</option>
              <option value="expense" ${filterState.type === "expense" ? "selected" : ""}>Pengeluaran (-)</option>
            </select>
          </div>
          <div>
            <label for="filter-trx-cat" class="block font-display uppercase text-[11px] font-bold text-ink mb-1">Kategori</label>
            <select id="filter-trx-cat" class="varsity-input py-2 text-xs font-semibold">
              <option value="all" ${filterState.categoryId === "all" ? "selected" : ""}>Semua Kategori</option>
              ${catOptionsHtml}
            </select>
          </div>
          <div>
            <label for="filter-trx-search" class="block font-display uppercase text-[11px] font-bold text-ink mb-1">Cari Referensi / Keterangan</label>
            <input
              id="filter-trx-search"
              type="search"
              value="${escapeHTML(filterState.search)}"
              placeholder="Ketik TRX-... atau keterangan..."
              class="varsity-input py-2 text-xs"
            />
          </div>
        </div>
      </div>

      ${
        filtered.length === 0
          ? `<div class="p-6">${renderEmptyState({
              title: "Belum Ada Transaksi Ditemukan",
              description: "Tidak ada catatan transaksi yang sesuai dengan filter saat ini.",
            })}</div>`
          : `
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-olive text-cream font-display uppercase text-xs tracking-wider border-b-2 border-ink">
                  <th class="py-3 px-4">No. Referensi</th>
                  <th class="py-3 px-4">Tanggal</th>
                  <th class="py-3 px-4">Kategori</th>
                  <th class="py-3 px-4">Keterangan</th>
                  <th class="py-3 px-4 text-right">Nominal</th>
                  <th class="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y-2 divide-ink/15 text-sm">
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        `
      }
    </section>
  `;

  document.getElementById("open-expense-modal-btn")?.addEventListener("click", openRecordExpenseModal);
  document.getElementById("open-income-modal-btn")?.addEventListener("click", openRecordOtherIncomeModal);

  document.getElementById("toggle-reversed")?.addEventListener("change", (e) => {
    filterState.showReversed = e.target.checked;
    renderPage();
  });

  document.getElementById("filter-trx-type")?.addEventListener("change", (e) => {
    filterState.type = e.target.value;
    renderPage();
  });

  document.getElementById("filter-trx-cat")?.addEventListener("change", (e) => {
    filterState.categoryId = e.target.value;
    renderPage();
  });

  document.getElementById("filter-trx-search")?.addEventListener("input", (e) => {
    filterState.search = e.target.value;
    renderPage();
    const input = document.getElementById("filter-trx-search");
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  });

  contentContainer.querySelectorAll("[data-view-nota]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const trx = allTransactions.find((item) => item.id === btn.dataset.viewNota);
      if (trx) openAttachmentModal(trx);
    });
  });

  contentContainer.querySelectorAll("[data-reverse-trx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const trx = allTransactions.find((item) => item.id === btn.dataset.reverseTrx);
      if (trx) openReversalModal(trx);
    });
  });
}

async function loadTransactionsData() {
  if (!contentContainer) return;
  contentContainer.innerHTML = renderLoadingState("Memuat buku besar transaksi TI24C...");

  try {
    const [summary, trxs, cats] = await Promise.all([fetchCashSummary(), fetchFullTransactions(), fetchTransactionCategories()]);

    summaryState = summary;
    allTransactions = trxs;
    categories = cats;
    renderPage();
  } catch (err) {
    contentContainer.innerHTML = renderErrorState({
      title: "Gagal Memuat Buku Besar Transaksi",
      message: err.message || "Terjadi kesalahan saat mengambil data transaksi.",
      retryId: "retry-trx-btn",
    });
    document.getElementById("retry-trx-btn")?.addEventListener("click", loadTransactionsData);
  }
}

async function initTransactionsPage() {
  const authData = await requireAuth(["bendahara"]);
  if (!authData) return;

  currentProfile = authData.profile;
  contentContainer = mountAppShell({
    profile: currentProfile,
    activeMenuId: "transactions",
    pageTitle: "Buku Besar Transaksi",
    pageSubtitle: "Pencatatan pengeluaran kas, pemasukan tambahan, & audit ledger",
  });

  await loadTransactionsData();
}

initTransactionsPage();
