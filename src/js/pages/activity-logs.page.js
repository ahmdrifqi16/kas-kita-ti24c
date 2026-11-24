import { mountAppShell } from "../layouts/app-shell.js";
import { requireAuth } from "../guards/auth.guard.js";
import { fetchActivityLogs } from "../services/operations.service.js";
import { escapeHTML, formatDateTimeID } from "../utils/formatters.js";
import { renderEmptyState, renderErrorState, renderLoadingState } from "../components/ui-states.js";

async function init() {
  const auth = await requireAuth(["bendahara"]);
  if (!auth) return;

  const contentContainer = mountAppShell({
    profile: auth.profile,
    activeMenuId: "activity-logs",
    pageTitle: "Activity Log Audit",
    pageSubtitle: "Rekam jejak tindakan keuangan & administrasi TI24C",
  });

  contentContainer.innerHTML = renderLoadingState("Memuat log aktivitas sistem...");

  try {
    const logs = await fetchActivityLogs(100);

    const rowsHtml = logs
      .map((log) => {
        const metaObj = log.details || log.metadata || null;
        const metaText = metaObj ? JSON.stringify(metaObj) : "-";
        return `
          <tr class="hover:bg-parchment/40">
            <td class="py-3 px-4 text-xs text-brown whitespace-nowrap">${formatDateTimeID(log.created_at)}</td>
            <td class="py-3 px-4">
              <span class="varsity-badge bg-gold text-ink">${escapeHTML(log.action || "ACTION")}</span>
            </td>
            <td class="py-3 px-4 font-mono text-xs text-olive">${escapeHTML(log.entity_type || "-")}</td>
            <td class="py-3 px-4 text-xs text-ink break-all max-w-md">${escapeHTML(metaText)}</td>
          </tr>
        `;
      })
      .join("");

    contentContainer.innerHTML = `
      <section class="varsity-card-light overflow-hidden">
        <div class="p-4 bg-parchment border-b-2 border-ink flex items-center justify-between">
          <div>
            <h2 class="text-lg font-bold uppercase text-ink">Jejak Audit Aktivitas Sistem (${logs.length})</h2>
            <p class="text-xs text-brown">Log tindakan penting yang terekam secara otomatis di server</p>
          </div>
          <span class="varsity-badge bg-cream text-ink">AUDIT TRAIL</span>
        </div>
        ${
          logs.length === 0
            ? `<div class="p-6">${renderEmptyState({ title: "Belum Ada Catatan Log", description: "Aktivitas verifikasi, pembuatan periode, dan pengeluaran akan tercatat di sini." })}</div>`
            : `
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-olive text-cream font-display uppercase text-xs border-b-2 border-ink">
                    <th class="py-3 px-4">Waktu</th>
                    <th class="py-3 px-4">Aktivitas</th>
                    <th class="py-3 px-4">Entitas</th>
                    <th class="py-3 px-4">Detail</th>
                  </tr>
                </thead>
                <tbody class="divide-y-2 divide-ink/15 text-sm">${rowsHtml}</tbody>
              </table>
            </div>`
        }
      </section>
    `;
  } catch (err) {
    contentContainer.innerHTML = renderErrorState({ title: "Gagal Memuat Activity Log", message: err.message });
  }
}

init();
