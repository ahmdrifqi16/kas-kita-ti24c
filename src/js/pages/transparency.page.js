import { mountAppShell } from "../layouts/app-shell.js";
import { requireAuth } from "../guards/auth.guard.js";
import { fetchCashSummary, fetchPublicTransactions } from "../services/transactions.service.js";
import { escapeHTML, formatDateID, formatRupiah } from "../utils/formatters.js";
import { renderEmptyState, renderErrorState, renderLoadingState } from "../components/ui-states.js";

let contentContainer = null;
let summary = { totalIncome: 0, totalExpense: 0, currentBalance: 0 };
let trxs = [];
let filterType = "all";

function renderPage() {
  const filtered = filterType === "all" ? trxs : trxs.filter((t) => t.type === filterType);

  const rowsHtml = filtered
    .map((t) => {
      const isIncome = t.type === "income";
      return `
        <tr class="hover:bg-parchment/40">
          <td class="py-3 px-4 font-mono text-xs font-bold text-ink">${escapeHTML(t.trx_number)}</td>
          <td class="py-3 px-4 text-xs text-brown">${formatDateID(t.trx_date)}</td>
          <td class="py-3 px-4">
            <span class="varsity-badge ${isIncome ? "bg-gold text-ink" : "bg-champion-red text-cream"}">
              ${escapeHTML(t.category_name)}
            </span>
          </td>
          <td class="py-3 px-4 text-sm text-ink">${escapeHTML(t.description)}</td>
          <td class="py-3 px-4 text-right font-bold tabular-money ${isIncome ? "text-olive" : "text-champion-red"}">
            ${isIncome ? "+" : "-"} ${formatRupiah(t.amount)}
          </td>
        </tr>
      `;
    })
    .join("");

  contentContainer.innerHTML = `
    <section class="varsity-panel-dark p-5 varsity-stitch-light">
      <span class="varsity-badge bg-gold text-ink">KETERBUKAAN KEUANGAN KELAS</span>
      <h2 class="text-xl font-bold uppercase text-cream mt-2">Transparansi Buku Besar Kas TI24C</h2>
      <p class="text-xs sm:text-sm text-parchment mt-1">
        Seluruh pemasukan sah dan pengeluaran kelas tercatat terbuka dengan perlindungan privasi nomor rekening pribadi.
      </p>
    </section>

    <section class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <article class="bg-gold border-2 border-ink rounded-md shadow-varsity p-4">
        <p class="font-display uppercase text-xs font-bold text-brown">Saldo Kas Resmi</p>
        <p class="font-display font-bold text-2xl tabular-money text-ink mt-1">${formatRupiah(summary.currentBalance)}</p>
      </article>
      <article class="bg-parchment border-2 border-ink rounded-md shadow-varsity p-4">
        <p class="font-display uppercase text-xs font-bold text-brown">Total Pemasukan Sah</p>
        <p class="font-display font-bold text-2xl tabular-money text-olive mt-1">${formatRupiah(summary.totalIncome)}</p>
      </article>
      <article class="bg-cream border-2 border-ink rounded-md shadow-varsity p-4">
        <p class="font-display uppercase text-xs font-bold text-brown">Total Pengeluaran</p>
        <p class="font-display font-bold text-2xl tabular-money text-champion-red mt-1">${formatRupiah(summary.totalExpense)}</p>
      </article>
    </section>

    <section class="varsity-card-light overflow-hidden">
      <div class="p-4 bg-parchment border-b-2 border-ink flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-lg font-bold uppercase text-ink">Mutasi Kas Terverifikasi (${filtered.length})</h3>
        <div class="flex gap-1.5">
          <button type="button" data-t-filter="all" class="varsity-btn-neutral py-1 px-3 text-xs ${filterType === "all" ? "bg-gold" : ""}">Semua</button>
          <button type="button" data-t-filter="income" class="varsity-btn-neutral py-1 px-3 text-xs ${filterType === "income" ? "bg-gold" : ""}">Pemasukan</button>
          <button type="button" data-t-filter="expense" class="varsity-btn-neutral py-1 px-3 text-xs ${filterType === "expense" ? "bg-gold" : ""}">Pengeluaran</button>
        </div>
      </div>
      ${
        filtered.length === 0
          ? `<div class="p-6">${renderEmptyState({ title: "Belum Ada Transaksi", description: "Belum ada mutasi kas yang tercatat." })}</div>`
          : `
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-olive text-cream font-display uppercase text-xs border-b-2 border-ink">
                  <th class="py-3 px-4">No. Referensi</th>
                  <th class="py-3 px-4">Tanggal</th>
                  <th class="py-3 px-4">Kategori</th>
                  <th class="py-3 px-4">Keterangan</th>
                  <th class="py-3 px-4 text-right">Nominal</th>
                </tr>
              </thead>
              <tbody class="divide-y-2 divide-ink/15 text-sm">${rowsHtml}</tbody>
            </table>
          </div>`
      }
    </section>
  `;

  contentContainer.querySelectorAll("[data-t-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      filterType = btn.dataset.tFilter;
      renderPage();
    });
  });
}

async function init() {
  const auth = await requireAuth(["anggota", "ketua"]);
  if (!auth) return;
  contentContainer = mountAppShell({
    profile: auth.profile,
    activeMenuId: "transparency",
    pageTitle: "Transparansi Kas",
    pageSubtitle: "Buku besar publik pemasukan & pengeluaran kelas TI24C",
  });

  contentContainer.innerHTML = renderLoadingState("Memuat data transparansi kas...");
  try {
    const [sumData, list] = await Promise.all([fetchCashSummary(), fetchPublicTransactions({ limit: 100 })]);
    summary = sumData;
    trxs = list;
    renderPage();
  } catch (err) {
    contentContainer.innerHTML = renderErrorState({ title: "Gagal Memuat Transparansi", message: err.message });
  }
}

init();
