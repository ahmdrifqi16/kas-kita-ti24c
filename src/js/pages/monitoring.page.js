import { mountAppShell } from "../layouts/app-shell.js";
import { requireAuth } from "../guards/auth.guard.js";
import { fetchCashBills, fetchCashPeriods } from "../services/bills.service.js";
import { escapeHTML, formatDateID, formatRupiah, getBillStatusMeta } from "../utils/formatters.js";
import { renderEmptyState, renderErrorState, renderLoadingState } from "../components/ui-states.js";

let contentContainer = null;
let periods = [];
let bills = [];
let selectedPeriod = "all";
let selectedStatus = "all";

function renderPage() {
  const filtered = bills.filter((b) => {
    if (selectedPeriod !== "all" && b.period_id !== selectedPeriod) return false;
    if (selectedStatus !== "all" && b.status !== selectedStatus) return false;
    return true;
  });

  const rowsHtml = filtered
    .map((b) => {
      const rem = Math.max(0, Number(b.amount_due) - Number(b.amount_paid));
      const st = getBillStatusMeta(b.status);
      return `
        <tr class="hover:bg-parchment/40">
          <td class="py-3 px-4 font-mono text-xs font-bold text-ink">${escapeHTML(b.members?.nim || "-")}</td>
          <td class="py-3 px-4 font-bold text-sm text-ink">${escapeHTML(b.members?.full_name || "-")}</td>
          <td class="py-3 px-4 text-xs text-ink">${escapeHTML(b.cash_periods?.name || "-")}</td>
          <td class="py-3 px-4 text-xs text-brown">${formatDateID(b.due_date)}</td>
          <td class="py-3 px-4 text-right tabular-money text-sm">${formatRupiah(b.amount_due)}</td>
          <td class="py-3 px-4 text-right tabular-money text-sm font-bold text-olive">${formatRupiah(b.amount_paid)}</td>
          <td class="py-3 px-4 text-right tabular-money text-sm font-bold text-ink">${formatRupiah(rem)}</td>
          <td class="py-3 px-4 text-center"><span class="varsity-badge ${st.className}">${st.label}</span></td>
        </tr>
      `;
    })
    .join("");

  contentContainer.innerHTML = `
    <section class="varsity-panel-dark p-5 varsity-stitch-light">
      <span class="varsity-badge bg-gold text-ink">MONITORING KETUA KELAS (READ-ONLY)</span>
      <h2 class="text-xl font-bold uppercase text-cream mt-2">Pemantauan Status Pelunasan Kas Anggota</h2>
      <p class="text-xs sm:text-sm text-parchment mt-1">
        Pantau kedisiplinan pembayaran per periode dan per mahasiswa tanpa mengubah catatan transaksi Bendahara.
      </p>
    </section>

    <section class="varsity-card-light overflow-hidden">
      <div class="p-4 bg-parchment border-b-2 border-ink grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label for="mon-period" class="block font-display uppercase text-[11px] font-bold text-ink mb-1">Filter Periode</label>
          <select id="mon-period" class="varsity-input py-2 text-xs font-semibold">
            <option value="all">Semua Periode</option>
            ${periods.map((p) => `<option value="${p.id}" ${selectedPeriod === p.id ? "selected" : ""}>${escapeHTML(p.name)}</option>`).join("")}
          </select>
        </div>
        <div>
          <label for="mon-status" class="block font-display uppercase text-[11px] font-bold text-ink mb-1">Status Pelunasan</label>
          <select id="mon-status" class="varsity-input py-2 text-xs font-semibold">
            <option value="all" ${selectedStatus === "all" ? "selected" : ""}>Semua Status</option>
            <option value="paid" ${selectedStatus === "paid" ? "selected" : ""}>Lunas</option>
            <option value="partial" ${selectedStatus === "partial" ? "selected" : ""}>Dicicil</option>
            <option value="unpaid" ${selectedStatus === "unpaid" ? "selected" : ""}>Belum Bayar</option>
            <option value="overdue" ${selectedStatus === "overdue" ? "selected" : ""}>Jatuh Tempo</option>
          </select>
        </div>
      </div>
      ${
        filtered.length === 0
          ? `<div class="p-6">${renderEmptyState({ title: "Data Tidak Ditemukan", description: "Tidak ada tagihan yang sesuai filter." })}</div>`
          : `
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-olive text-cream font-display uppercase text-xs border-b-2 border-ink">
                  <th class="py-3 px-4">NIM</th>
                  <th class="py-3 px-4">Nama Anggota</th>
                  <th class="py-3 px-4">Periode</th>
                  <th class="py-3 px-4">Jatuh Tempo</th>
                  <th class="py-3 px-4 text-right">Tagihan</th>
                  <th class="py-3 px-4 text-right">Terbayar</th>
                  <th class="py-3 px-4 text-right">Sisa</th>
                  <th class="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y-2 divide-ink/15 text-sm">${rowsHtml}</tbody>
            </table>
          </div>`
      }
    </section>
  `;

  document.getElementById("mon-period")?.addEventListener("change", (e) => {
    selectedPeriod = e.target.value;
    renderPage();
  });
  document.getElementById("mon-status")?.addEventListener("change", (e) => {
    selectedStatus = e.target.value;
    renderPage();
  });
}

async function init() {
  const auth = await requireAuth(["ketua"]);
  if (!auth) return;
  contentContainer = mountAppShell({
    profile: auth.profile,
    activeMenuId: "monitoring",
    pageTitle: "Monitoring Kas Kelas",
    pageSubtitle: "Pemantauan tingkat pelunasan tagihan TI24C Champions",
  });

  contentContainer.innerHTML = renderLoadingState("Memuat data monitoring kas...");
  try {
    const [pList, bList] = await Promise.all([fetchCashPeriods(), fetchCashBills()]);
    periods = pList;
    bills = bList;
    renderPage();
  } catch (err) {
    contentContainer.innerHTML = renderErrorState({ title: "Gagal Memuat Monitoring", message: err.message });
  }
}

init();
