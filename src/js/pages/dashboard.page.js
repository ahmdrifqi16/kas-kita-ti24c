import { mountAppShell } from "../layouts/app-shell.js";
import { requireAuth } from "../guards/auth.guard.js";
import { fetchCashSummary, fetchPublicTransactions } from "../services/transactions.service.js";
import { fetchCashBills } from "../services/bills.service.js";
import { fetchPayments } from "../services/receipts.service.js";
import { fetchAnnouncements } from "../services/operations.service.js";
import { escapeHTML, formatDateID, formatDateTimeID, formatRupiah, getBillStatusMeta, getPaymentStatusMeta } from "../utils/formatters.js";
import { renderEmptyState, renderErrorState, renderLoadingState, showToast } from "../components/ui-states.js";
import { openModal } from "../components/modal.js";

let currentProfile = null;
let contentContainer = null;

function buildKpiCards(role, { summary, bills, payments }) {
  if (role === "anggota") {
    const totalDue = bills.reduce((acc, b) => acc + Number(b.amount_due || 0), 0);
    const totalPaid = bills.reduce((acc, b) => acc + Number(b.amount_paid || 0), 0);
    const remaining = Math.max(0, totalDue - totalPaid);
    const unpaidCount = bills.filter((b) => b.status !== "paid" && b.status !== "closed").length;

    return [
      {
        label: "Total Kewajiban Saya",
        value: formatRupiah(totalDue),
        note: `${bills.length} periode tagihan tercatat`,
        accent: "bg-parchment",
      },
      {
        label: "Sudah Terverifikasi",
        value: formatRupiah(totalPaid),
        note: "Akumulasi pembayaran & cicilan sah",
        accent: "bg-gold",
      },
      {
        label: "Sisa Tagihan Saya",
        value: formatRupiah(remaining),
        note: unpaidCount > 0 ? `${unpaidCount} periode belum lunas` : "Seluruh tagihan lunas",
        accent: remaining > 0 ? "bg-orange" : "bg-cream",
      },
      {
        label: "Saldo Kas Kelas",
        value: formatRupiah(summary.currentBalance),
        note: "Saldo resmi kas TI24C",
        accent: "bg-cream",
      },
    ];
  }

  if (role === "ketua") {
    const totalBills = bills.length;
    const paidBills = bills.filter((b) => b.status === "paid").length;
    const completionRate = totalBills > 0 ? Math.round((paidBills / totalBills) * 100) : 0;

    return [
      {
        label: "Saldo Kas Resmi",
        value: formatRupiah(summary.currentBalance),
        note: "Pemasukan sah dikurangi pengeluaran",
        accent: "bg-gold",
      },
      {
        label: "Total Pemasukan Sah",
        value: formatRupiah(summary.totalIncome),
        note: "Tercatat di buku besar kelas",
        accent: "bg-parchment",
      },
      {
        label: "Total Pengeluaran",
        value: formatRupiah(summary.totalExpense),
        note: "Pengeluaran operasional kelas",
        accent: "bg-cream",
      },
      {
        label: "Tingkat Pelunasan Kas",
        value: `${completionRate}%`,
        note: `${paidBills} dari ${totalBills} tagihan lunas`,
        accent: "bg-orange",
      },
    ];
  }

  // Role: bendahara
  const pendingCount = payments.length;
  return [
    {
      label: "Saldo Kas Resmi",
      value: formatRupiah(summary.currentBalance),
      note: "Sumber kebenaran dari ledger",
      accent: "bg-gold",
    },
    {
      label: "Total Pemasukan Sah",
      value: formatRupiah(summary.totalIncome),
      note: "Hanya pembayaran terverifikasi",
      accent: "bg-parchment",
    },
    {
      label: "Total Pengeluaran",
      value: formatRupiah(summary.totalExpense),
      note: "Pengeluaran sah tercatat",
      accent: "bg-cream",
    },
    {
      label: "Antrean Verifikasi",
      value: `${pendingCount} Pengajuan`,
      note: pendingCount > 0 ? "Menunggu tinjauan Bendahara" : "Semua transfer telah diproses",
      accent: pendingCount > 0 ? "bg-orange" : "bg-cream",
    },
  ];
}

function renderAnnouncementBanner(announcements) {
  const latest = announcements[0];
  if (!latest) {
    return `
      <section class="varsity-panel-dark p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 varsity-stitch-light">
        <div>
          <span class="varsity-badge bg-gold text-ink">TI24C CHAMPIONS</span>
          <h2 class="text-xl font-bold uppercase text-cream mt-2">Sistem Keuangan Kas Kelas Aktif</h2>
          <p class="text-sm text-parchment mt-0.5">Belum ada pengumuman baru dari pengurus kelas.</p>
        </div>
        <button id="refresh-dashboard-btn" type="button" class="varsity-btn-secondary shrink-0">
          Muat Ulang Data
        </button>
      </section>
    `;
  }

  return `
    <section class="varsity-panel-dark p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 varsity-stitch-light">
      <div class="space-y-1.5 max-w-3xl">
        <div class="flex flex-wrap items-center gap-2">
          <span class="varsity-badge bg-gold text-ink">${latest.is_pinned ? "PENGUMUMAN PENTING" : "INFO KELAS"}</span>
          <span class="text-xs text-parchment">${formatDateID(latest.created_at)}</span>
        </div>
        <h2 class="text-xl sm:text-2xl font-bold uppercase text-cream leading-snug">
          ${escapeHTML(latest.title)}
        </h2>
        <p class="text-sm text-parchment line-clamp-2">
          ${escapeHTML(latest.content)}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2 shrink-0">
        <button
          type="button"
          id="view-announcement-btn"
          data-title="${escapeHTML(latest.title)}"
          data-date="${escapeHTML(formatDateTimeID(latest.created_at))}"
          data-content="${escapeHTML(latest.content)}"
          class="varsity-btn-neutral"
        >
          Baca Lengkap
        </button>
        <button id="refresh-dashboard-btn" type="button" class="varsity-btn-secondary">
          Refresh
        </button>
      </div>
    </section>
  `;
}

function renderRoleSpecificMiddleSection(role, profile, { bills, payments }) {
  // 1. Tampilan Anggota
  if (role === "anggota") {
    if (!profile.member_id) {
      return `
        <section class="bg-orange/25 border-2 border-ink rounded-md shadow-varsity p-5 space-y-2">
          <span class="varsity-badge bg-champion-red text-cream">AKUN BELUM DITAUTKAN</span>
          <h3 class="text-lg font-bold uppercase text-ink">Profil Anda Belum Terhubung ke Data Anggota TI24C</h3>
          <p class="text-sm text-ink/90">
            Hubungi Bendahara kelas agar akun email Anda ditautkan ke NIM dan nama anggota Anda untuk menampilkan tagihan pribadi.
          </p>
        </section>
      `;
    }

    const billRowsHtml = bills
      .map((bill) => {
        const remaining = Math.max(0, Number(bill.amount_due) - Number(bill.amount_paid));
        const statusMeta = getBillStatusMeta(bill.status);
        const periodName = bill.cash_periods?.name || "Periode Kas";

        return `
          <tr class="hover:bg-parchment/40">
            <td class="py-3 px-4 font-semibold text-ink">${escapeHTML(periodName)}</td>
            <td class="py-3 px-4 text-xs text-brown">${formatDateID(bill.due_date)}</td>
            <td class="py-3 px-4 text-right tabular-money">${formatRupiah(bill.amount_due)}</td>
            <td class="py-3 px-4 text-right tabular-money font-semibold text-olive">${formatRupiah(bill.amount_paid)}</td>
            <td class="py-3 px-4 text-right tabular-money font-bold text-ink">${formatRupiah(remaining)}</td>
            <td class="py-3 px-4 text-center">
              <span class="varsity-badge ${statusMeta.className}">${statusMeta.label}</span>
            </td>
          </tr>
        `;
      })
      .join("");

    const recentPaymentsHtml = payments
      .slice(0, 5)
      .map((p) => {
        const st = getPaymentStatusMeta(p.status);
        const periodName = p.cash_bills?.cash_periods?.name || "Iuran Kas";
        return `
          <div class="p-3.5 bg-cream border-2 border-ink rounded-md flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="font-bold text-sm text-ink truncate">${escapeHTML(periodName)}</p>
              <p class="text-xs text-brown">
                ${p.method === "cash" ? "Tunai" : "Transfer"} • ${formatDateTimeID(p.created_at)}
              </p>
              ${
                p.status === "rejected" && p.rejection_reason
                  ? `<p class="text-xs text-champion-red font-semibold mt-1">Alasan: ${escapeHTML(p.rejection_reason)}</p>`
                  : ""
              }
            </div>
            <div class="text-right shrink-0 space-y-1">
              <p class="font-display font-bold text-base tabular-money text-ink">${formatRupiah(p.amount)}</p>
              <span class="varsity-badge ${st.className}">${st.label}</span>
            </div>
          </div>
        `;
      })
      .join("");

    return `
      <section class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div class="lg:col-span-7 varsity-card-light overflow-hidden">
          <div class="p-4 bg-parchment border-b-2 border-ink flex items-center justify-between gap-2">
            <div>
              <h3 class="text-lg font-bold uppercase text-ink">Rincian Tagihan Saya</h3>
              <p class="text-xs text-brown">Status dihitung otomatis dari pembayaran yang telah diverifikasi</p>
            </div>
            <span class="varsity-badge bg-cream text-ink">${bills.length} TAGIHAN</span>
          </div>
          ${
            bills.length === 0
              ? `<div class="p-6">${renderEmptyState({
                  title: "Belum Ada Tagihan",
                  description: "Belum ada tagihan kas yang diterbitkan untuk akun Anda.",
                })}</div>`
              : `
              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                  <thead>
                    <tr class="bg-olive text-cream font-display uppercase text-xs tracking-wider border-b-2 border-ink">
                      <th class="py-2.5 px-4">Periode</th>
                      <th class="py-2.5 px-4">Jatuh Tempo</th>
                      <th class="py-2.5 px-4 text-right">Tagihan</th>
                      <th class="py-2.5 px-4 text-right">Terbayar</th>
                      <th class="py-2.5 px-4 text-right">Sisa</th>
                      <th class="py-2.5 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y-2 divide-ink/15 text-sm">
                    ${billRowsHtml}
                  </tbody>
                </table>
              </div>
            `
          }
        </div>

        <div class="lg:col-span-5 varsity-card-light p-4 sm:p-5 space-y-3">
          <div class="flex items-center justify-between border-b-2 border-ink pb-2.5">
            <h3 class="text-lg font-bold uppercase text-ink">Pengajuan & Pembayaran Terakhir</h3>
            <span class="varsity-badge bg-gold text-ink">${payments.length} RIWAYAT</span>
          </div>
          ${
            payments.length === 0
              ? renderEmptyState({
                  title: "Belum Ada Pembayaran",
                  description: "Riwayat pengajuan transfer dan pembayaran tunai Anda akan muncul di sini.",
                })
              : `<div class="space-y-2.5">${recentPaymentsHtml}</div>`
          }
        </div>
      </section>
    `;
  }

  // 2. Tampilan Bendahara & Ketua Kelas (Rekap Status Tagihan + Antrean Verifikasi untuk Bendahara)
  const counts = {
    paid: bills.filter((b) => b.status === "paid").length,
    partial: bills.filter((b) => b.status === "partial").length,
    unpaid: bills.filter((b) => b.status === "unpaid").length,
    overdue: bills.filter((b) => b.status === "overdue").length,
  };

  const rekapCardHtml = `
    <div class="varsity-card-light p-5 space-y-4">
      <div class="flex items-center justify-between border-b-2 border-ink pb-2.5">
        <div>
          <h3 class="text-lg font-bold uppercase text-ink">Rekap Status Tagihan Kelas</h3>
          <p class="text-xs text-brown">Total ${bills.length} tagihan diterbitkan lintas periode</p>
        </div>
        <span class="varsity-badge bg-gold text-ink">MONITORING</span>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="p-3 bg-gold/40 border-2 border-ink rounded-md text-center">
          <p class="font-display text-2xl font-bold text-ink">${counts.paid}</p>
          <p class="text-xs font-display uppercase font-bold text-ink">Lunas</p>
        </div>
        <div class="p-3 bg-orange/35 border-2 border-ink rounded-md text-center">
          <p class="font-display text-2xl font-bold text-ink">${counts.partial}</p>
          <p class="text-xs font-display uppercase font-bold text-ink">Dicicil</p>
        </div>
        <div class="p-3 bg-parchment border-2 border-ink rounded-md text-center">
          <p class="font-display text-2xl font-bold text-ink">${counts.unpaid}</p>
          <p class="text-xs font-display uppercase font-bold text-ink">Belum Bayar</p>
        </div>
        <div class="p-3 bg-champion-red/20 border-2 border-ink rounded-md text-center">
          <p class="font-display text-2xl font-bold text-champion-red">${counts.overdue}</p>
          <p class="text-xs font-display uppercase font-bold text-ink">Jatuh Tempo</p>
        </div>
      </div>
    </div>
  `;

  if (role === "ketua") {
    return `<section>${rekapCardHtml}</section>`;
  }

  // Bendahara juga melihat daftar singkat antrean transfer pending
  const pendingListHtml = payments
    .slice(0, 4)
    .map((p) => {
      const memberName = p.members?.full_name || "Anggota";
      const periodName = p.cash_bills?.cash_periods?.name || "Periode Kas";
      return `
        <div class="p-3 bg-cream border-2 border-ink rounded-md flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="font-bold text-sm text-ink truncate">${escapeHTML(memberName)}</p>
            <p class="text-xs text-brown truncate">${escapeHTML(periodName)} • ${formatDateTimeID(p.created_at)}</p>
          </div>
          <div class="text-right shrink-0">
            <p class="font-display font-bold text-base tabular-money text-ink">${formatRupiah(p.amount)}</p>
            <span class="varsity-badge bg-orange text-ink text-[10px]">PENDING</span>
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <section class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div class="lg:col-span-6">${rekapCardHtml}</div>
      <div class="lg:col-span-6 varsity-card-light p-5 space-y-3">
        <div class="flex items-center justify-between border-b-2 border-ink pb-2.5">
          <div>
            <h3 class="text-lg font-bold uppercase text-ink">Antrean Verifikasi Transfer</h3>
            <p class="text-xs text-brown">Pengajuan menunggu persetujuan Bendahara</p>
          </div>
          <span class="varsity-badge bg-orange text-ink">${payments.length} ANTREAN</span>
        </div>
        ${
          payments.length === 0
            ? renderEmptyState({
                title: "Antrean Bersih",
                description: "Tidak ada pengajuan transfer yang menunggu verifikasi saat ini.",
              })
            : `<div class="space-y-2.5">${pendingListHtml}</div>`
        }
      </div>
    </section>
  `;
}

function renderRecentTransactionsSection(transactions) {
  const rowsHtml = transactions
    .map((trx) => {
      const isIncome = trx.type === "income";
      return `
        <tr class="hover:bg-parchment/40">
          <td class="py-3 px-4 font-mono text-xs font-bold text-ink">${escapeHTML(trx.trx_number)}</td>
          <td class="py-3 px-4 text-xs text-brown">${formatDateID(trx.trx_date)}</td>
          <td class="py-3 px-4">
            <span class="varsity-badge ${isIncome ? "bg-gold text-ink" : "bg-champion-red text-cream"}">
              ${escapeHTML(trx.category_name)}
            </span>
          </td>
          <td class="py-3 px-4 text-sm text-ink">${escapeHTML(trx.description)}</td>
          <td class="py-3 px-4 text-right font-bold tabular-money ${isIncome ? "text-olive" : "text-champion-red"}">
            ${isIncome ? "+" : "-"} ${formatRupiah(trx.amount)}
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <section class="varsity-card-light overflow-hidden">
      <div class="p-4 sm:p-5 bg-parchment border-b-2 border-ink flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 class="text-lg font-bold uppercase text-ink">Buku Besar Transaksi Kelas Terbaru</h3>
          <p class="text-xs text-brown">Menampilkan transaksi kas sah yang telah disanitasi sesuai kebijakan privasi</p>
        </div>
        <span class="varsity-badge bg-cream text-ink">TRANSPARANSI RESMI</span>
      </div>
      ${
        transactions.length === 0
          ? `<div class="p-6">${renderEmptyState({
              title: "Belum Ada Transaksi Tercatat",
              description: "Pemasukan kas terverifikasi dan pengeluaran yang dicatat Bendahara akan tampil di sini.",
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

async function loadDashboardData({ showSuccessToast = false } = {}) {
  if (!contentContainer || !currentProfile) return;

  contentContainer.innerHTML = renderLoadingState("Memuat data kas TI24C dari server...");

  try {
    const role = currentProfile.role;

    const [summary, bills, payments, transactions, announcements] = await Promise.all([
      fetchCashSummary(),
      fetchCashBills(),
      role === "bendahara" ? fetchPayments({ status: "pending" }) : role === "anggota" ? fetchPayments() : Promise.resolve([]),
      fetchPublicTransactions({ limit: 8 }),
      fetchAnnouncements(),
    ]);

    const kpiCards = buildKpiCards(role, { summary, bills, payments });
    const kpiHtml = kpiCards
      .map(
        (card) => `
        <article class="${card.accent} border-2 border-ink rounded-md shadow-varsity p-4 sm:p-5 flex flex-col justify-between">
          <p class="font-display uppercase text-xs font-bold tracking-wider text-brown">
            ${escapeHTML(card.label)}
          </p>
          <p class="font-display font-bold text-2xl sm:text-3xl text-ink tabular-money mt-2">
            ${escapeHTML(card.value)}
          </p>
          <p class="text-xs text-ink/80 mt-2 pt-2 border-t border-ink/20">
            ${escapeHTML(card.note)}
          </p>
        </article>
      `,
      )
      .join("");

    contentContainer.innerHTML = `
      ${renderAnnouncementBanner(announcements)}
      <section class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        ${kpiHtml}
      </section>
      ${renderRoleSpecificMiddleSection(role, currentProfile, { bills, payments })}
      ${renderRecentTransactionsSection(transactions)}
    `;

    document.getElementById("refresh-dashboard-btn")?.addEventListener("click", () => {
      loadDashboardData({ showSuccessToast: true });
    });

    const viewAnnouncementBtn = document.getElementById("view-announcement-btn");
    viewAnnouncementBtn?.addEventListener("click", () => {
      openModal({
        title: viewAnnouncementBtn.dataset.title || "Pengumuman Kelas",
        badge: viewAnnouncementBtn.dataset.date || "INFO TI24C",
        bodyHtml: `<p class="whitespace-pre-line leading-relaxed text-ink">${escapeHTML(viewAnnouncementBtn.dataset.content || "")}</p>`,
        footerHtml: `<button type="button" data-close-modal class="varsity-btn-secondary">Tutup</button>`,
      });
    });

    if (showSuccessToast) {
      showToast("Data dashboard berhasil diperbarui dari database.", "success");
    }
  } catch (err) {
    contentContainer.innerHTML = renderErrorState({
      title: "Gagal Memuat Dashboard",
      message: err.message || "Terjadi kesalahan saat mengambil data keuangan.",
      retryId: "retry-dashboard-btn",
    });

    document.getElementById("retry-dashboard-btn")?.addEventListener("click", () => {
      loadDashboardData({ showSuccessToast: true });
    });
  }
}

async function initDashboard() {
  const authData = await requireAuth();
  if (!authData) return;

  currentProfile = authData.profile;
  contentContainer = mountAppShell({
    profile: currentProfile,
    activeMenuId: "dashboard",
    pageTitle: "Dashboard Kas Kelas",
    pageSubtitle: "TI24C Champions • Ringkasan & Transparansi Keuangan",
  });

  await loadDashboardData();
}

initDashboard();
