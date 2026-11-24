import { escapeHTML } from '../utils/formatters.js';

const MODAL_ROOT_ID = 'varsity-modal-root';

export function closeModal() {
  const existing = document.getElementById(MODAL_ROOT_ID);
  if (existing) {
    existing.remove();
    document.body.classList.remove('overflow-hidden');
  }
}

/**
 * Membuka dialog modal bergaya retro varsity
 */
export function openModal({
  title = 'Detail',
  badge = 'TI24C CHAMPIONS',
  bodyHtml = '',
  footerHtml = '',
  maxWidthClass = 'max-w-lg'
}) {
  closeModal();

  const wrapper = document.createElement('div');
  wrapper.id = MODAL_ROOT_ID;
  wrapper.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/70';
  wrapper.setAttribute('role', 'dialog');
  wrapper.setAttribute('aria-modal', 'true');

  wrapper.innerHTML = `
    <div class="w-full ${maxWidthClass} bg-cream border-2 border-ink rounded-md shadow-varsity-lg overflow-hidden max-h-[90vh] flex flex-col">
      <div class="px-5 py-4 bg-olive text-cream border-b-2 border-ink flex items-center justify-between gap-3">
        <div>
          <span class="varsity-badge bg-gold text-ink text-[10px]">${escapeHTML(badge)}</span>
          <h3 class="text-xl font-bold uppercase text-cream mt-1">${escapeHTML(title)}</h3>
        </div>
        <button
          type="button"
          data-close-modal
          aria-label="Tutup jendela"
          class="px-2.5 py-1 bg-cream text-ink border-2 border-ink rounded font-bold text-xs hover:bg-gold focus:outline-none focus:ring-2 focus:ring-gold"
        >
          ✕
        </button>
      </div>
      <div class="p-5 overflow-y-auto space-y-4 text-sm text-ink">
        ${bodyHtml}
      </div>
      ${
        footerHtml
          ? `<div class="px-5 py-3.5 bg-parchment border-t-2 border-ink flex flex-wrap items-center justify-end gap-2">${footerHtml}</div>`
          : ''
      }
    </div>
  `;

  wrapper.addEventListener('click', (e) => {
    if (e.target === wrapper || e.target.closest('[data-close-modal]')) {
      closeModal();
    }
  });

  const handleEsc = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', handleEsc);
    }
  };
  document.addEventListener('keydown', handleEsc);

  document.body.appendChild(wrapper);
  document.body.classList.add('overflow-hidden');
  return wrapper;
}

/**
 * Dialog konfirmasi standar untuk aksi penting (hapus, tutup periode, batalkan, dll.)
 */
export function openConfirmModal({
  title = 'Konfirmasi Tindakan',
  message = 'Apakah Anda yakin ingin melanjutkan tindakan ini?',
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  variant = 'danger'
}) {
  return new Promise((resolve) => {
    const confirmBtnClass =
      variant === 'danger' ? 'varsity-btn-primary' : 'varsity-btn-secondary';

    const modal = openModal({
      title,
      badge: 'KONFIRMASI',
      maxWidthClass: 'max-w-md',
      bodyHtml: `<p class="text-sm text-ink leading-relaxed">${escapeHTML(message)}</p>`,
      footerHtml: `
        <button type="button" id="confirm-modal-cancel" class="varsity-btn-neutral">
          ${escapeHTML(cancelLabel)}
        </button>
        <button type="button" id="confirm-modal-ok" class="${confirmBtnClass}">
          ${escapeHTML(confirmLabel)}
        </button>
      `
    });

    const cleanup = (result) => {
      closeModal();
      resolve(result);
    };

    modal.querySelector('#confirm-modal-cancel')?.addEventListener('click', () => cleanup(false));
    modal.querySelector('#confirm-modal-ok')?.addEventListener('click', () => cleanup(true));
  });
}