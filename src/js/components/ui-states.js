import { escapeHTML } from '../utils/formatters.js';

/**
 * State Loading bergaya varsity
 */
export function renderLoadingState(message = 'Memuat data kas TI24C...') {
  return `
    <div class="varsity-card-light p-8 flex flex-col items-center justify-center text-center gap-3">
      <div class="w-10 h-10 border-4 border-ink border-t-champion-red rounded-full animate-spin"></div>
      <p class="font-display uppercase tracking-wider text-base text-ink">${escapeHTML(message)}</p>
      <p class="text-xs text-brown">Mohon tunggu sebentar</p>
    </div>
  `;
}

/**
 * State Kosong (Empty State)
 */
export function renderEmptyState({
  title = 'Belum Ada Data',
  description = 'Data belum tersedia untuk ditampilkan saat ini.',
  actionHtml = ''
} = {}) {
  return `
    <div class="varsity-card-light p-8 text-center flex flex-col items-center justify-center gap-3">
      <span class="varsity-badge bg-parchment text-ink">ARSIP KOSONG</span>
      <h3 class="text-xl font-bold uppercase text-ink">${escapeHTML(title)}</h3>
      <p class="text-sm text-brown max-w-md">${escapeHTML(description)}</p>
      ${actionHtml ? `<div class="mt-2">${actionHtml}</div>` : ''}
    </div>
  `;
}

/**
 * State Error
 */
export function renderErrorState({
  title = 'Terjadi Kendala',
  message = 'Gagal memuat data dari server.',
  retryId = ''
} = {}) {
  return `
    <div class="bg-cream border-2 border-ink rounded-md shadow-varsity p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div class="space-y-1">
        <span class="varsity-badge bg-champion-red text-cream">ERROR</span>
        <h3 class="text-lg font-bold uppercase text-ink">${escapeHTML(title)}</h3>
        <p class="text-sm text-ink/80">${escapeHTML(message)}</p>
      </div>
      ${
        retryId
          ? `<button id="${escapeHTML(retryId)}" type="button" class="varsity-btn-secondary shrink-0">Coba Lagi</button>`
          : ''
      }
    </div>
  `;
}

/**
 * Notifikasi Toast (Success / Error / Info)
 */
export function showToast(message, type = 'info') {
  let container = document.getElementById('varsity-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'varsity-toast-container';
    container.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)]';
    document.body.appendChild(container);
  }

  const styles = {
    success: 'bg-gold text-ink',
    error: 'bg-champion-red text-cream',
    warning: 'bg-orange text-ink',
    info: 'bg-olive text-cream'
  }[type] || 'bg-olive text-cream';

  const badgeLabel = {
    success: 'BERHASIL',
    error: 'GAGAL',
    warning: 'PERHATIAN',
    info: 'INFO'
  }[type] || 'INFO';

  const toast = document.createElement('div');
  toast.className = `${styles} border-2 border-ink rounded-md shadow-varsity p-3.5 flex items-start justify-between gap-3 transition-all duration-200`;
  toast.innerHTML = `
    <div class="space-y-1">
      <span class="inline-block px-1.5 py-0.5 text-[10px] font-display font-bold tracking-wider bg-ink text-cream rounded">
        ${badgeLabel}
      </span>
      <p class="text-sm font-medium leading-snug">${escapeHTML(message)}</p>
    </div>
    <button type="button" aria-label="Tutup notifikasi" class="text-xs font-bold px-1.5 py-0.5 border border-current rounded hover:opacity-75">
      ✕
    </button>
  `;

  toast.querySelector('button').addEventListener('click', () => toast.remove());
  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentElement) toast.remove();
  }, 4500);
}