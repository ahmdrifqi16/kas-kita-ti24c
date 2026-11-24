import { mountAppShell } from "../layouts/app-shell.js";
import { requireAuth } from "../guards/auth.guard.js";
import { closeCashPeriod, createPeriodWithBills, fetchCashBills, fetchCashPeriods } from "../services/bills.service.js";
import { fetchMembers } from "../services/members.service.js";
import { recordCashPayment } from "../services/payments.service.js";
import { escapeHTML, formatDateID, formatRupiah, getBillStatusMeta } from "../utils/formatters.js";
import { validateNominalRupiah } from "../utils/validators.js";
import { setButtonLoading } from "../utils/dom.js";
import { renderEmptyState, renderErrorState, renderLoadingState, showToast } from "../components/ui-states.js";
import { closeModal, openConfirmModal, openModal } from "../components/modal.js";

let currentProfile = null;
let contentContainer = null;

let allPeriods = [];
let allBills = [];
let activeMembers = [];

let filterState = {
  periodId: "all",
  status: "all",
  search: "",
};

function getFilteredBills() {
  return allBills.filter((bill) => {
    if (filterState.periodId !== "all" && bill.period_id !== filterState.periodId) {
      return false;
    }
    if (filterState.status !== "all" && bill.status !== filterState.status) {
      return false;
    }
    if (filterState.search.trim()) {
      const q = filterState.search.trim().toLowerCase();
      const memberName = (bill.members?.full_name || "").toLowerCase();
      const memberNim = (bill.members?.nim || "").toLowerCase();
      if (!memberName.includes(q) && !memberNim.includes(q)) {
        return false;
      }
    }
    return true;
  });
}

function openCreatePeriodModal() {
  const today = new Date().toISOString().split("T")[0];
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

  const memberCheckboxesHtml = activeMembers
    .map(
      (m) => `
      <label class="flex items-center gap-2.5 p-2 bg-cream border border-ink/40 rounded cursor-pointer hover:bg-parchment/60">
        <input type="checkbox" name="selected_members" value="${m.id}" checked class="w-4 h-4 accent-olive" />
        <span class="font-mono text-xs font-bold text-brown">${escapeHTML(m.nim)}</span>
        <span class="text-xs font-semibold text-ink truncate">${escapeHTML(m.full_name)}</span>
      </label>
    `,
    )
    .join("");

  const modal = openModal({
    title: "Buat Periode & Tagihan Kas",
    badge: "PERIODE FLEKSIBEL",
    maxWidthClass: "max-w-xl",
    bodyHtml: `
      <form id="create-period-form" novalidate class="space-y-4">
        <div>
          <label for="period-name" class="block font-display uppercase text-xs font-bold tracking-wider text-ink mb-1">
            Nama Periode Kas *
          </label>
          <input
            id="period-name"
            type="text"
            placeholder="Contoh: Kas Minggu 2 atau Kas Kunjungan Industri"
            class="varsity-input"
            required
          />
          <p id="err-period-name" class="hidden text-xs font-semibold text-champion-red mt-1"></p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label for="period-start" class="block font-display uppercase text-xs font-bold tracking-wider text-ink mb-1">
              Tanggal Mulai *
            </label>
            <input id="period-start" type="date" value="${today}" class="varsity-input" required />
            <p id="err-period-start" class="hidden text-xs font-semibold text-champion-red mt-1"></p>
          </div>
          <div>
            <label for="period-due" class="block font-display uppercase text-xs font-bold tracking-wider text-ink mb-1">
              Tanggal Jatuh Tempo *
            </label>
            <input id="period-due" type="date" value="${nextWeek}" class="varsity-input" required />
            <p id="err-period-due" class="hidden text-xs font-semibold text-champion-red mt-1"></p>
          </div>
        </div>

        <div>
          <label for="period-amount" class="block font-display uppercase text-xs font-bold tracking-wider text-ink mb-1">
            Nominal Kewajiban per Anggota (Rp) *
          </label>
          <input
            id="period-amount"
            type="number"
            min="1000"
            step="500"
            value="10000"
            class="varsity-input tabular-money font-bold"
            required
          />
          <p class="text-[11px] text-brown mt-1">
            Nilai awal Rp10.000. Perubahan nominal hanya berlaku untuk periode ini dan tidak mengubah tagihan lama.
          </p>
          <p id="err-period-amount" class="hidden text-xs font-semibold text-champion-red mt-1"></p>
        </div>

        <div>
          <label for="period-notes" class="block font-display uppercase text-xs font-bold tracking-wider text-ink mb-1">
            Catatan / Tujuan Iuran (Opsional)
          </label>
          <textarea
            id="period-notes"
            rows="2"
            placeholder="Keterangan tambahan untuk anggota kelas..."
            class="varsity-input"
          ></textarea>
        </div>

        <div class="space-y-2 pt-1 border-t border-ink/20">
          <label class="block font-display uppercase text-xs font-bold tracking-wider text-ink">
            Target Penerbitan Tagihan
          </label>
          <div class="flex flex-wrap gap-4 text-xs font-semibold">
            <label class="inline-flex items-center gap-2 cursor-pointer">
              <input type="radio" name="target_mode" value="all" checked class="accent-olive" />
              <span>Seluruh Anggota Aktif (${activeMembers.length} orang)</span>
            </label>
            <label class="inline-flex items-center gap-2 cursor-pointer">
              <input type="radio" name="target_mode" value="selected" class="accent-olive" />
              <span>Pilih Anggota Tertentu</span>
            </label>
          </div>

          <div id="selected-members-box" class="hidden max-h-40 overflow-y-auto p-2.5 bg-parchment border-2 border-ink rounded-md grid grid-cols-1 sm:grid-cols-2 gap-2">
            ${memberCheckboxesHtml || '<p class="text-xs text-brown">Tidak ada anggota aktif.</p>'}
          </div>
          <p id="err-period-members" class="hidden text-xs font-semibold text-champion-red mt-1"></p>
        </div>
      </form>
    `,
    footerHtml: `
      <button type="button" data-close-modal class="varsity-btn-neutral">Batal</button>
      <button type="submit" form="create-period-form" id="submit-period-btn" class="varsity-btn-primary">
        Terbitkan Periode & Tagihan
      </button>
    `,
  });

  const form = modal.querySelector("#create-period-form");
  const targetRadios = modal.querySelectorAll('input[name="target_mode"]');
  const membersBox = modal.querySelector("#selected-members-box");

  targetRadios.forEach((radio) => {
    radio.addEventListener("change", (e) => {
      if (e.target.value === "selected") {
        membersBox.classList.remove("hidden");
      } else {
        membersBox.classList.add("hidden");
      }
    });
  });

  const showFieldErr = (id, msg) => {
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

    const nameVal = modal.querySelector("#period-name").value.trim();
    const startVal = modal.querySelector("#period-start").value;
    const dueVal = modal.querySelector("#period-due").value;
    const amountVal = modal.querySelector("#period-amount").value;
    const notesVal = modal.querySelector("#period-notes").value.trim();
    const targetMode = modal.querySelector('input[name="target_mode"]:checked')?.value || "all";

    let hasError = false;

    if (!nameVal) {
      showFieldErr("err-period-name", "Nama periode wajib diisi.");
      hasError = true;
    } else {
      showFieldErr("err-period-name", "");
    }

    if (!startVal) {
      showFieldErr("err-period-start", "Tanggal mulai wajib diisi.");
      hasError = true;
    } else {
      showFieldErr("err-period-start", "");
    }

    if (!dueVal) {
      showFieldErr("err-period-due", "Tanggal jatuh tempo wajib diisi.");
      hasError = true;
    } else if (startVal && dueVal < startVal) {
      showFieldErr("err-period-due", "Jatuh tempo tidak boleh lebih awal dari tanggal mulai.");
      hasError = true;
    } else {
      showFieldErr("err-period-due", "");
    }

    const amountCheck = validateNominalRupiah(amountVal, { min: 1000 });
    if (!amountCheck.valid) {
      showFieldErr("err-period-amount", amountCheck.message);
      hasError = true;
    } else {
      showFieldErr("err-period-amount", "");
    }

    let selectedMemberIds = null;
    if (targetMode === "selected") {
      selectedMemberIds = Array.from(modal.querySelectorAll('input[name="selected_members"]:checked')).map((cb) => cb.value);

      if (selectedMemberIds.length === 0) {
        showFieldErr("err-period-members", "Pilih minimal satu anggota kelas.");
        hasError = true;
      } else {
        showFieldErr("err-period-members", "");
      }
    } else if (activeMembers.length === 0) {
      showFieldErr("err-period-members", "Belum ada anggota aktif yang terdaftar.");
      hasError = true;
    } else {
      showFieldErr("err-period-members", "");
    }

    if (hasError) return;

    const submitBtn = modal.querySelector("#submit-period-btn");
    setButtonLoading(submitBtn, true, "Menerbitkan...");

    try {
      const newPeriodId = await createPeriodWithBills({
        name: nameVal,
        startDate: startVal,
        dueDate: dueVal,
        defaultAmount: amountCheck.value,
        notes: notesVal,
        memberIds: selectedMemberIds,
      });

      closeModal();
      filterState.periodId = newPeriodId || "all";
      showToast(`Periode "${nameVal}" dan tagihan anggota berhasil diterbitkan.`, "success");
      await loadBillsData();
    } catch (err) {
      showToast(err.message || "Gagal membuat periode kas.", "error");
      setButtonLoading(submitBtn, false);
    }
  });
}

function openCashPaymentModal(bill) {
  const remaining = Math.max(0, Number(bill.amount_due) - Number(bill.amount_paid));
  const memberName = bill.members?.full_name || "Anggota";
  const periodName = bill.cash_periods?.name || "Periode Kas";

  const modal = openModal({
    title: "Catat Pembayaran Tunai",
    badge: "TUNAI TERVERIFIKASI",
    maxWidthClass: "max-w-md",
    bodyHtml: `
      <div class="p-3.5 bg-parchment border-2 border-ink rounded-md space-y-1.5 text-xs">
        <div class="flex justify-between">
          <span class="text-brown font-semibold">Anggota Pembayar:</span>
          <span class="font-bold text-ink">${escapeHTML(memberName)}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-brown font-semibold">Periode Kas:</span>
          <span class="font-bold text-ink">${escapeHTML(periodName)}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-brown font-semibold">Total Tagihan:</span>
          <span class="tabular-money font-semibold">${formatRupiah(bill.amount_due)}</span>
        </div>
        <div class="flex justify-between pt-1.5 border-t border-ink/20">
          <span class="text-brown font-bold">Sisa Kewajiban:</span>
          <span class="tabular-money font-bold text-champion-red">${formatRupiah(remaining)}</span>
        </div>
      </div>

      <form id="cash-payment-form" novalidate class="space-y-4">
        <div>
          <label for="cash-amount" class="block font-display uppercase text-xs font-bold tracking-wider text-ink mb-1">
            Nominal Tunai Diterima (Rp) *
          </label>
          <input
            id="cash-amount"
            type="number"
            min="1000"
            max="${remaining}"
            step="500"
            value="${remaining}"
            class="varsity-input tabular-money font-bold text-base"
            required
          />
          <p class="text-[11px] text-brown mt-1">
            Isi lebih kecil dari sisa kewajiban jika anggota membayar secara cicilan.
          </p>
          <p id="err-cash-amount" class="hidden text-xs font-semibold text-champion-red mt-1"></p>
        </div>

        <div>
          <label for="cash-notes" class="block font-display uppercase text-xs font-bold tracking-wider text-ink mb-1">
            Catatan Penerimaan (Opsional)
          </label>
          <input
            id="cash-notes"
            type="text"
            placeholder="Contoh: Diterima tunai di ruang kuliah"
            class="varsity-input"
          />
        </div>

        <p class="text-xs bg-gold/40 border border-ink rounded p-2.5 text-ink">
          Pastikan uang tunai telah diterima secara fisik. Sistem akan langsung mencatat pemasukan ke buku besar dan menerbitkan kuitansi digital.
        </p>
      </form>
    `,
    footerHtml: `
      <button type="button" data-close-modal class="varsity-btn-neutral">Batal</button>
      <button type="submit" form="cash-payment-form" id="submit-cash-btn" class="varsity-btn-primary">
        Sahkan Pembayaran Tunai
      </button>
    `,
  });

  const form = modal.querySelector("#cash-payment-form");
  const errEl = modal.querySelector("#err-cash-amount");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const rawAmount = modal.querySelector("#cash-amount").value;
    const notesVal = modal.querySelector("#cash-notes").value.trim();

    const check = validateNominalRupiah(rawAmount, { min: 1000, max: remaining });
    if (!check.valid) {
      errEl.textContent = check.message;
      errEl.classList.remove("hidden");
      return;
    }
    errEl.classList.add("hidden");

    const submitBtn = modal.querySelector("#submit-cash-btn");
    setButtonLoading(submitBtn, true, "Menyimpan...");

    try {
      await recordCashPayment({
        billId: bill.id,
        amount: check.value,
        notes: notesVal,
      });

      closeModal();
      showToast(`Pembayaran tunai ${formatRupiah(check.value)} atas nama ${memberName} sah & kuitansi diterbitkan!`, "success");
      await loadBillsData();
    } catch (err) {
      showToast(err.message || "Gagal mencatat pembayaran tunai.", "error");
      setButtonLoading(submitBtn, false);
    }
  });
}

function renderPeriodsSection() {
  if (allPeriods.length === 0) {
    return renderEmptyState({
      title: "Belum Ada Periode Kas",
      description: 'Klik tombol "Buat Periode & Tagihan Baru" untuk memulai penagihan kas kelas TI24C.',
    });
  }

  const cardsHtml = allPeriods
    .map((period) => {
      const isSelected = filterState.periodId === period.id;
      const isActive = period.status === "active";
      const periodBills = allBills.filter((b) => b.period_id === period.id);
      const paidCount = periodBills.filter((b) => b.status === "paid").length;

      return `
        <article class="${
          isSelected ? "bg-gold/35" : "bg-cream"
        } border-2 border-ink rounded-md shadow-varsity p-4 flex flex-col justify-between gap-3">
          <div class="space-y-1.5">
            <div class="flex items-center justify-between gap-2">
              <span class="varsity-badge ${isActive ? "bg-gold text-ink" : "bg-brown text-cream"}">
                ${isActive ? "AKTIF" : "DITUTUP"}
              </span>
              <span class="font-display font-bold text-sm tabular-money text-ink">
                ${formatRupiah(period.default_amount)} / anggota
              </span>
            </div>
            <h3 class="text-lg font-bold uppercase text-ink leading-snug">
              ${escapeHTML(period.name)}
            </h3>
            <p class="text-xs text-brown">
              ${formatDateID(period.start_date)} — Jatuh Tempo: <strong>${formatDateID(period.due_date)}</strong>
            </p>
            ${period.notes ? `<p class="text-xs text-ink/80 line-clamp-2">${escapeHTML(period.notes)}</p>` : ""}
          </div>

          <div class="pt-3 border-t border-ink/20 flex flex-wrap items-center justify-between gap-2">
            <span class="text-xs font-semibold text-olive">
              Lunas: ${paidCount}/${periodBills.length} tagihan
            </span>
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                data-filter-period="${period.id}"
                class="varsity-btn-neutral py-1 px-2.5 text-xs"
              >
                ${isSelected ? "Ditampilkan" : "Lihat Tagihan"}
              </button>
              ${
                isActive
                  ? `<button
                      type="button"
                      data-close-period="${period.id}"
                      data-period-name="${escapeHTML(period.name)}"
                      class="varsity-btn-accent py-1 px-2.5 text-xs"
                    >
                      Tutup
                    </button>`
                  : ""
              }
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  return `
    <section class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold uppercase text-ink">Daftar Periode Kas Fleksibel</h2>
        <span class="varsity-badge bg-parchment text-ink">${allPeriods.length} PERIODE</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        ${cardsHtml}
      </div>
    </section>
  `;
}

function renderBillsTableSection() {
  const filtered = getFilteredBills();

  const periodOptions = allPeriods
    .map((p) => `<option value="${p.id}" ${filterState.periodId === p.id ? "selected" : ""}>${escapeHTML(p.name)}</option>`)
    .join("");

  const rowsHtml = filtered
    .map((bill) => {
      const remaining = Math.max(0, Number(bill.amount_due) - Number(bill.amount_paid));
      const statusMeta = getBillStatusMeta(bill.status);
      const canPayCash = ["unpaid", "partial", "overdue"].includes(bill.status);

      return `
        <tr class="hover:bg-parchment/40">
          <td class="py-3 px-4">
            <p class="font-bold text-sm text-ink">${escapeHTML(bill.members?.full_name || "-")}</p>
            <p class="font-mono text-xs text-brown">${escapeHTML(bill.members?.nim || "-")}</p>
          </td>
          <td class="py-3 px-4 text-xs font-semibold text-ink">
            ${escapeHTML(bill.cash_periods?.name || "-")}
          </td>
          <td class="py-3 px-4 text-xs text-brown">
            ${formatDateID(bill.due_date)}
          </td>
          <td class="py-3 px-4 text-right tabular-money text-sm">
            ${formatRupiah(bill.amount_due)}
          </td>
          <td class="py-3 px-4 text-right tabular-money text-sm font-semibold text-olive">
            ${formatRupiah(bill.amount_paid)}
          </td>
          <td class="py-3 px-4 text-right tabular-money text-sm font-bold text-ink">
            ${formatRupiah(remaining)}
          </td>
          <td class="py-3 px-4 text-center">
            <span class="varsity-badge ${statusMeta.className}">${statusMeta.label}</span>
          </td>
          <td class="py-3 px-4 text-right">
            ${
              canPayCash
                ? `<button
                    type="button"
                    data-cash-bill-id="${bill.id}"
                    class="varsity-btn-secondary py-1.5 px-3 text-xs"
                  >
                    + Catat Tunai
                  </button>`
                : `<span class="text-xs font-semibold text-brown">Selesai</span>`
            }
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <section class="varsity-card-light overflow-hidden">
      <div class="p-4 sm:p-5 bg-parchment border-b-2 border-ink space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-lg font-bold uppercase text-ink">Rekap Tagihan & Penerimaan Tunai Anggota</h2>
            <p class="text-xs text-brown">Menampilkan ${filtered.length} dari ${allBills.length} total tagihan diterbitkan</p>
          </div>
          <span class="varsity-badge bg-cream text-ink">SNAPSHOT TAGIHAN</span>
        </div>

        <!-- Bar Filter -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label for="filter-period" class="block font-display uppercase text-[11px] font-bold text-ink mb-1">
              Filter Periode
            </label>
            <select id="filter-period" class="varsity-input py-2 text-xs font-semibold">
              <option value="all" ${filterState.periodId === "all" ? "selected" : ""}>Semua Periode</option>
              ${periodOptions}
            </select>
          </div>
          <div>
            <label for="filter-status" class="block font-display uppercase text-[11px] font-bold text-ink mb-1">
              Status Tagihan
            </label>
            <select id="filter-status" class="varsity-input py-2 text-xs font-semibold">
              <option value="all" ${filterState.status === "all" ? "selected" : ""}>Semua Status</option>
              <option value="unpaid" ${filterState.status === "unpaid" ? "selected" : ""}>Belum Bayar</option>
              <option value="partial" ${filterState.status === "partial" ? "selected" : ""}>Dicicil</option>
              <option value="paid" ${filterState.status === "paid" ? "selected" : ""}>Lunas</option>
              <option value="overdue" ${filterState.status === "overdue" ? "selected" : ""}>Jatuh Tempo</option>
              <option value="closed" ${filterState.status === "closed" ? "selected" : ""}>Ditutup</option>
            </select>
          </div>
          <div>
            <label for="filter-search" class="block font-display uppercase text-[11px] font-bold text-ink mb-1">
              Cari Nama / NIM Anggota
            </label>
            <input
              id="filter-search"
              type="search"
              value="${escapeHTML(filterState.search)}"
              placeholder="Ketik nama atau NIM..."
              class="varsity-input py-2 text-xs"
            />
          </div>
        </div>
      </div>

      ${
        filtered.length === 0
          ? `<div class="p-6">${renderEmptyState({
              title: "Tidak Ada Tagihan Ditemukan",
              description: "Ubah filter periode/status atau buat periode tagihan kas baru.",
            })}</div>`
          : `
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-olive text-cream font-display uppercase text-xs tracking-wider border-b-2 border-ink">
                  <th class="py-3 px-4">Anggota</th>
                  <th class="py-3 px-4">Periode</th>
                  <th class="py-3 px-4">Jatuh Tempo</th>
                  <th class="py-3 px-4 text-right">Tagihan</th>
                  <th class="py-3 px-4 text-right">Terbayar</th>
                  <th class="py-3 px-4 text-right">Sisa</th>
                  <th class="py-3 px-4 text-center">Status</th>
                  <th class="py-3 px-4 text-right">Aksi Tunai</th>
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
}

function renderPage() {
  if (!contentContainer) return;

  contentContainer.innerHTML = `
    <!-- Action Bar -->
    <section class="varsity-panel-dark p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 varsity-stitch-light">
      <div class="space-y-1">
        <span class="varsity-badge bg-gold text-ink">ADMINISTRASI BENDAHARA</span>
        <h2 class="text-xl font-bold uppercase text-cream">Manajemen Periode & Tagihan Kas</h2>
        <p class="text-xs sm:text-sm text-parchment">
          Buat periode iuran fleksibel dengan nominal awal Rp10.000 atau catat pembayaran tunai setelah uang diterima.
        </p>
      </div>
      <button id="open-create-period-btn" type="button" class="varsity-btn-primary shrink-0">
        + Buat Periode & Tagihan
      </button>
    </section>

    ${renderPeriodsSection()}
    ${renderBillsTableSection()}
  `;

  // Event: Buka Modal Buat Periode
  document.getElementById("open-create-period-btn")?.addEventListener("click", openCreatePeriodModal);

  // Event: Filter cepat dari kartu periode
  contentContainer.querySelectorAll("[data-filter-period]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.filterPeriod;
      filterState.periodId = filterState.periodId === targetId ? "all" : targetId;
      renderPage();
    });
  });

  // Event: Tutup Periode dengan konfirmasi
  contentContainer.querySelectorAll("[data-close-period]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const periodId = btn.dataset.closePeriod;
      const periodName = btn.dataset.periodName;

      const confirmed = await openConfirmModal({
        title: "Tutup Periode Kas",
        message: `Periode "${periodName}" akan ditutup. Sisa tagihan yang belum lunas pada periode ini akan ditandai sebagai Ditutup tanpa menghapus riwayat pembayaran sah. Lanjutkan?`,
        confirmLabel: "Ya, Tutup Periode",
        variant: "danger",
      });

      if (!confirmed) return;

      try {
        await closeCashPeriod(periodId);
        showToast(`Periode "${periodName}" berhasil ditutup.`, "success");
        await loadBillsData();
      } catch (err) {
        showToast(err.message || "Gagal menutup periode.", "error");
      }
    });
  });

  // Event: Filter bar
  document.getElementById("filter-period")?.addEventListener("change", (e) => {
    filterState.periodId = e.target.value;
    renderPage();
  });

  document.getElementById("filter-status")?.addEventListener("change", (e) => {
    filterState.status = e.target.value;
    renderPage();
  });

  document.getElementById("filter-search")?.addEventListener("input", (e) => {
    filterState.search = e.target.value;
    renderPage();
    const input = document.getElementById("filter-search");
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  });

  // Event: Catat Pembayaran Tunai
  contentContainer.querySelectorAll("[data-cash-bill-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const bill = allBills.find((b) => b.id === btn.dataset.cashBillId);
      if (bill) openCashPaymentModal(bill);
    });
  });
}

async function loadBillsData() {
  if (!contentContainer) return;
  contentContainer.innerHTML = renderLoadingState("Memuat data periode & tagihan kas...");

  try {
    const [periods, bills, members] = await Promise.all([fetchCashPeriods(), fetchCashBills(), fetchMembers({ activeOnly: true })]);

    allPeriods = periods;
    allBills = bills;
    activeMembers = members;
    renderPage();
  } catch (err) {
    contentContainer.innerHTML = renderErrorState({
      title: "Gagal Memuat Periode & Tagihan",
      message: err.message || "Terjadi kesalahan saat mengambil data tagihan.",
      retryId: "retry-bills-btn",
    });

    document.getElementById("retry-bills-btn")?.addEventListener("click", loadBillsData);
  }
}

async function initBillsPage() {
  const authData = await requireAuth(["bendahara"]);
  if (!authData) return;

  currentProfile = authData.profile;
  contentContainer = mountAppShell({
    profile: currentProfile,
    activeMenuId: "bills",
    pageTitle: "Periode & Tagihan Kas",
    pageSubtitle: "Kelola periode fleksibel, snapshot tagihan, & pencatatan tunai",
  });

  await loadBillsData();
}

initBillsPage();
