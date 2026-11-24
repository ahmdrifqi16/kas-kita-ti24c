import { mountAppShell } from "../layouts/app-shell.js";
import { requireAuth } from "../guards/auth.guard.js";
import { fetchCashBills } from "../services/bills.service.js";
import { escapeHTML, formatDateID, formatRupiah, getBillStatusMeta } from "../utils/formatters.js";
import { renderEmptyState, renderErrorState, renderLoadingState } from "../components/ui-states.js";

async function init() {
  const auth = await requireAuth(["anggota"]);
  if (!auth) return;

  const contentContainer = mountAppShell({
    profile: auth.profile,
    activeMenuId: "my-bills",
    pageTitle: "Tagihan Saya",
    pageSubtitle: "Rincian kewajiban iuran kas & status cicilan per periode",
  });

  contentContainer.innerHTML = renderLoadingState("Memuat daftar tagihan pribadi...");

  try {
    const bills = await fetchCashBills();
    const totalDue = bills.reduce((s, b) => s + Number(b.amount_due || 0), 0);
    const totalPaid = bills.reduce((s, b) => s + Number(b.amount_paid || 0), 0);
    const remainingTotal = Math.max(0, totalDue - totalPaid);

    const rowsHtml = bills
      .map((b) => {
        const rem = Math.max(0, Number(b.amount_due) - Number(b.amount_paid));
        const st = getBillStatusMeta(b.status);
        const canPay = ["unpaid", "partial", "overdue"].includes(b.status);
        return `
          <tr class="hover:bg-parchment/40">
            <td class="py-3 px-4 font-bold text-ink">${escapeHTML(b.cash_periods?.name || "Periode Kas")}</td>
            <td class="py-3 px-4 text-xs text-brown">${formatDateID(b.due_date)}</td>
            <td class="py-3 px-4 text-right tabular-money">${formatRupiah(b.amount_due)}</td>
            <td class="py-3 px-4 text-right tabular-money font-semibold text-olive">${formatRupiah(b.amount_paid)}</td>
            <td class="py-3 px-4 text-right tabular-money font-bold text-ink">${formatRupiah(rem)}</td>
            <td class="py-3 px-4 text-center"><span class="varsity-badge ${st.className}">${st.label}</span></td>
            <td class="py-3 px-4 text-right">
              ${
                canPay
                  ? `<a href="/src/pages/pay.html" class="varsity-btn-primary py-1.5 px-3 text-xs">Bayar</a>`
                  : `<span class="text-xs font-semibold text-olive">Selesai</span>`
              }
            </td>
          </tr>
        `;
      })
      .join("");

    contentContainer.innerHTML = `
      <section class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <article class="bg-parchment border-2 border-ink rounded-md p-4">
          <p class="font-display uppercase text-xs font-bold text-brown">Total Kewajiban</p>
          <p class="font-display font-bold text-2xl tabular-money text-ink mt-1">${formatRupiah(totalDue)}</p>
        </article>
        <article class="bg-gold border-2 border-ink rounded-md p-4">
          <p class="font-display uppercase text-xs font-bold text-brown">Sudah Terverifikasi</p>
          <p class="font-display font-bold text-2xl tabular-money text-ink mt-1">${formatRupiah(totalPaid)}</p>
        </article>
        <article class="bg-cream border-2 border-ink rounded-md p-4">
          <p class="font-display uppercase text-xs font-bold text-brown">Sisa Tagihan</p>
          <p class="font-display font-bold text-2xl tabular-money text-champion-red mt-1">${formatRupiah(remainingTotal)}</p>
        </article>
      </section>

      <section class="varsity-card-light overflow-hidden">
        <div class="p-4 bg-parchment border-b-2 border-ink flex items-center justify-between">
          <h2 class="text-lg font-bold uppercase text-ink">Daftar Tagihan Kas Saya (${bills.length})</h2>
          <a href="/src/pages/pay.html" class="varsity-btn-secondary py-1.5 px-3 text-xs">Bayar via Transfer</a>
        </div>
        ${
          bills.length === 0
            ? `<div class="p-6">${renderEmptyState({ title: "Belum Ada Tagihan", description: "Belum ada tagihan kas yang diterbitkan untuk akun Anda." })}</div>`
            : `
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-olive text-cream font-display uppercase text-xs border-b-2 border-ink">
                    <th class="py-3 px-4">Periode</th>
                    <th class="py-3 px-4">Jatuh Tempo</th>
                    <th class="py-3 px-4 text-right">Tagihan</th>
                    <th class="py-3 px-4 text-right">Terbayar</th>
                    <th class="py-3 px-4 text-right">Sisa</th>
                    <th class="py-3 px-4 text-center">Status</th>
                    <th class="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody class="divide-y-2 divide-ink/15 text-sm">${rowsHtml}</tbody>
              </table>
            </div>`
        }
      </section>
    `;
  } catch (err) {
    contentContainer.innerHTML = renderErrorState({ title: "Gagal Memuat Tagihan", message: err.message });
  }
}

init();
