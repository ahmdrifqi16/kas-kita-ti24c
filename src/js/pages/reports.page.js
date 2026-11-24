import { mountAppShell } from "../layouts/app-shell.js";
import { requireAuth } from "../guards/auth.guard.js";
import { fetchCashSummary } from "../services/transactions.service.js";
import { fetchFilteredLedger } from "../services/reports.service.js";
import { fetchCashBills, fetchCashPeriods } from "../services/bills.service.js";
import { escapeHTML, formatDateID, formatRupiah } from "../utils/formatters.js";
import { renderEmptyState, renderErrorState, renderLoadingState, showToast } from "../components/ui-states.js";

let contentContainer = null;
let summary = { totalIncome: 0, totalExpense: 0, currentBalance: 0 };
let ledgerRows = [];
let periods = [];
let bills = [];

let filters = {
  startDate: "",
  endDate: "",
  type: "all",
};

function exportReportToCsv() {
  if (ledgerRows.length === 0) {
    showToast("Tidak ada data transaksi pada rentang laporan untuk diekspor.", "warning");
    return;
  }

  const headers = ["No Referensi", "Tanggal", "Jenis", "Kategori", "Keterangan", "Nominal (Rp)"];
  const csvLines = [
    headers.join(","),
    ...ledgerRows.map((r) => {
      const values = [
        `"${(r.trx_number || "").replace(/"/g, '""')}"`,
        `"${r.trx_date || ""}"`,
        `"${r.type === "income" ? "Pemasukan" : "Pengeluaran"}"`,
        `"${(r.category_name || "").replace(/"/g, '""')}"`,
        `"${(r.description || "").replace(/"/g, '""')}"`,
        Number(r.amount || 0),
      ];
      return values.join(",");
    }),
  ];

  const blob = new Blob(["\uFEFF" + csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Laporan-Kas-TI24C-${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("File CSV laporan berhasil diunduh (siap dibuka di Excel).", "success");
}

function renderPage() {
  const periodIncome = ledgerRows.filter((r) => r.type === "income").reduce((s, r) => s + Number(r.amount || 0), 0);
  const periodExpense = ledgerRows.filter((r) => r.type === "expense").reduce((s, r) => s + Number(r.amount || 0), 0);

  const periodSummaryRows = periods
    .map((p) => {
      const pBills = bills.filter((b) => b.period_id === p.id);
      const targetTotal = pBills.reduce((s, b) => s + Number(b.amount_due || 0), 0);
      const collectedTotal = pBills.reduce((s, b) => s + Number(b.amount_paid || 0), 0);
      const paidMembers = pBills.filter((b) => b.status === "paid").length;
      const pct = targetTotal > 0 ? Math.round((collectedTotal / targetTotal) * 100) : 0;

      return `
        <tr>
          <td class="py-3 px-4 font-bold text-ink">${escapeHTML(p.name)}</td>
          <td class="py-3 px-4 text-xs text-brown">${formatDateID(p.due_date)}</td>
          <td class="py-3 px-4 text-center text-xs font-semibold">${paidMembers}/${pBills.length} Lunas</td>
          <td class="py-3 px-4 text-right tabular-money">${formatRupiah(targetTotal)}</td>
          <td class="py-3 px-4 text-right tabular-money font-bold text-olive">${formatRupiah(collectedTotal)} (${pct}%)</td>
        </tr>
      `;
    })
    .join("");

  const mutasiRows = ledgerRows
    .map((r) => {
      const isIncome = r.type === "income";
      return `
        <tr>
          <td class="py-2.5 px-4 font-mono text-xs font-bold">${escapeHTML(r.trx_number)}</td>
          <td class="py-2.5 px-4 text-xs text-brown">${formatDateID(r.trx_date)}</td>
          <td class="py-2.5 px-4 text-xs font-semibold">${escapeHTML(r.category_name)}</td>
          <td class="py-2.5 px-4 text-sm">${escapeHTML(r.description)}</td>
          <td class="py-2.5 px-4 text-right font-bold tabular-money ${isIncome ? "text-olive" : "text-champion-red"}">
            ${isIncome ? "+" : "-"} ${formatRupiah(r.amount)}
          </td>
        </tr>
      `;
    })
    .join("");

  contentContainer.innerHTML = `
    <section class="varsity-panel-dark p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 varsity-stitch-light no-print">
      <div class="space-y-1">
        <span class="varsity-badge bg-gold text-ink">LAPORAN RESMI</span>
        <h2 class="text-xl font-bold uppercase text-cream">Laporan Pertanggungjawaban Kas TI24C</h2>
        <p class="text-xs sm:text-sm text-parchment">
          Saring mutasi kas berdasarkan rentang tanggal, ekspor ke CSV/Excel, atau cetak dokumen PDF.
        </p>
      </div>
      <div class="flex flex-wrap gap-2 shrink-0">
        <button id="export-csv-btn" type="button" class="varsity-btn-secondary">Ekspor CSV / Excel</button>
        <button id="print-report-btn" type="button" class="varsity-btn-primary">Cetak / Simpan PDF</button>
      </div>
    </section>

    <!-- Filter Laporan -->
    <section class="varsity-card-light p-4 no-print">
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
        <div>
          <label for="rep-start" class="block font-display uppercase text-[11px] font-bold text-ink mb-1">Dari Tanggal</label>
          <input id="rep-start" type="date" value="${filters.startDate}" class="varsity-input py-2 text-xs" />
        </div>
        <div>
          <label for="rep-end" class="block font-display uppercase text-[11px] font-bold text-ink mb-1">Sampai Tanggal</label>
          <input id="rep-end" type="date" value="${filters.endDate}" class="varsity-input py-2 text-xs" />
        </div>
        <div>
          <label for="rep-type" class="block font-display uppercase text-[11px] font-bold text-ink mb-1">Jenis Mutasi</label>
          <select id="rep-type" class="varsity-input py-2 text-xs font-semibold">
            <option value="all" ${filters.type === "all" ? "selected" : ""}>Semua Mutasi</option>
            <option value="income" ${filters.type === "income" ? "selected" : ""}>Pemasukan</option>
            <option value="expense" ${filters.type === "expense" ? "selected" : ""}>Pengeluaran</option>
          </select>
        </div>
        <div class="flex gap-2">
          <button id="apply-report-filter" type="button" class="varsity-btn-primary py-2 px-3 text-xs flex-1">Terapkan</button>
          <button id="reset-report-filter" type="button" class="varsity-btn-neutral py-2 px-3 text-xs">Reset</button>
        </div>
      </div>
    </section>

    <!-- Area Laporan Siap Cetak -->
    <div class="space-y-6">
      <section class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <article class="bg-gold border-2 border-ink rounded-md p-4">
          <p class="font-display uppercase text-xs font-bold text-brown">Saldo Kas Resmi Saat Ini</p>
          <p class="font-display font-bold text-2xl tabular-money text-ink mt-1">${formatRupiah(summary.currentBalance)}</p>
        </article>
        <article class="bg-parchment border-2 border-ink rounded-md p-4">
          <p class="font-display uppercase text-xs font-bold text-brown">Pemasukan pada Filter Ini</p>
          <p class="font-display font-bold text-2xl tabular-money text-olive mt-1">${formatRupiah(periodIncome)}</p>
        </article>
        <article class="bg-cream border-2 border-ink rounded-md p-4">
          <p class="font-display uppercase text-xs font-bold text-brown">Pengeluaran pada Filter Ini</p>
          <p class="font-display font-bold text-2xl tabular-money text-champion-red mt-1">${formatRupiah(periodExpense)}</p>
        </article>
      </section>

      <section class="varsity-card-light overflow-hidden">
        <div class="p-4 bg-parchment border-b-2 border-ink">
          <h3 class="text-lg font-bold uppercase text-ink">Rekapitulasi Realisasi per Periode Kas</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-olive text-cream font-display uppercase text-xs border-b-2 border-ink">
                <th class="py-2.5 px-4">Periode</th>
                <th class="py-2.5 px-4">Jatuh Tempo</th>
                <th class="py-2.5 px-4 text-center">Pelunasan</th>
                <th class="py-2.5 px-4 text-right">Target</th>
                <th class="py-2.5 px-4 text-right">Terkumpul</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-ink/15 text-sm">
              ${periodSummaryRows || '<tr><td colspan="5" class="p-4 text-center text-xs text-brown">Belum ada periode kas.</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>

      <section class="varsity-card-light overflow-hidden">
        <div class="p-4 bg-parchment border-b-2 border-ink flex justify-between items-center">
          <h3 class="text-lg font-bold uppercase text-ink">Rincian Mutasi Kas (${ledgerRows.length} Transaksi)</h3>
          <span class="text-xs text-brown">Dicetak: ${formatDateID(new Date().toISOString())}</span>
        </div>
        ${
          ledgerRows.length === 0
            ? `<div class="p-6">${renderEmptyState({ title: "Tidak Ada Mutasi", description: "Tidak ditemukan transaksi pada rentang filter ini." })}</div>`
            : `
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-olive text-cream font-display uppercase text-xs border-b-2 border-ink">
                    <th class="py-2.5 px-4">Referensi</th>
                    <th class="py-2.5 px-4">Tanggal</th>
                    <th class="py-2.5 px-4">Kategori</th>
                    <th class="py-2.5 px-4">Keterangan</th>
                    <th class="py-2.5 px-4 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-ink/15 text-sm">${mutasiRows}</tbody>
              </table>
            </div>`
        }
      </section>
    </div>
  `;

  document.getElementById("export-csv-btn")?.addEventListener("click", exportReportToCsv);
  document.getElementById("print-report-btn")?.addEventListener("click", () => window.print());

  document.getElementById("apply-report-filter")?.addEventListener("click", () => {
    filters.startDate = document.getElementById("rep-start").value;
    filters.endDate = document.getElementById("rep-end").value;
    filters.type = document.getElementById("rep-type").value;
    loadReportsData();
  });

  document.getElementById("reset-report-filter")?.addEventListener("click", () => {
    filters = { startDate: "", endDate: "", type: "all" };
    loadReportsData();
  });
}

async function loadReportsData() {
  contentContainer.innerHTML = renderLoadingState("Menyusun laporan keuangan TI24C...");
  try {
    const [sumData, rows, periodList, billList] = await Promise.all([
      fetchCashSummary(),
      fetchFilteredLedger({
        startDate: filters.startDate || null,
        endDate: filters.endDate || null,
        type: filters.type,
      }),
      fetchCashPeriods(),
      fetchCashBills(),
    ]);
    summary = sumData;
    ledgerRows = rows;
    periods = periodList;
    bills = billList;
    renderPage();
  } catch (err) {
    contentContainer.innerHTML = renderErrorState({
      title: "Gagal Memuat Laporan",
      message: err.message,
      retryId: "retry-rep-btn",
    });
    document.getElementById("retry-rep-btn")?.addEventListener("click", loadReportsData);
  }
}

async function init() {
  const auth = await requireAuth(["bendahara", "ketua"]);
  if (!auth) return;
  contentContainer = mountAppShell({
    profile: auth.profile,
    activeMenuId: "reports",
    pageTitle: "Laporan Keuangan",
    pageSubtitle: "Rekapitulasi saldo, realisasi periode, & ekspor laporan",
  });
  await loadReportsData();
}

init();
