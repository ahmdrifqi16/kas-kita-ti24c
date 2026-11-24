import { escapeHTML } from "./formatters.js";

export function qs(selector, parent = document) {
  return parent.querySelector(selector);
}

export function qsa(selector, parent = document) {
  return Array.from(parent.querySelectorAll(selector));
}

/**
 * Mengatur status loading pada tombol submit agar mencegah klik ganda
 */
export function setButtonLoading(button, isLoading, loadingText = "Memproses...") {
  if (!button) return;
  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = loadingText;
  } else {
    button.disabled = false;
    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
    }
  }
}

/**
 * Merender baris tabel atau baris kosong secara aman
 */
export function renderTableBody(tbody, rows, mapRowToHtml, colspan = 5, emptyText = "Belum ada data.") {
  if (!tbody) return;
  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${colspan}" class="py-8 px-4 text-center text-sm text-brown">
          ${escapeHTML(emptyText)}
        </td>
      </tr>
    `;
    return;
  }
  tbody.innerHTML = rows.map(mapRowToHtml).join("");
}
