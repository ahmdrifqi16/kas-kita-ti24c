import { renderChampionsEmblem } from "../components/emblem.js";
import { getMenuByRole } from "../guards/auth.guard.js";
import { escapeHTML, getRoleLabel } from "../utils/formatters.js";
import { signOut } from "../services/auth.service.js";
import { showToast } from "../components/ui-states.js";

/**
 * Merender kerangka utama aplikasi (Sidebar Olive + Topbar + Konten Utama)
 */
export function mountAppShell({
  profile,
  activeMenuId = "dashboard",
  pageTitle = "Dashboard",
  pageSubtitle = "Ringkasan keuangan kelas TI24C Champions",
  onRolePreviewChange = null,
}) {
  const root = document.getElementById("app-root");
  if (!root) return null;

  const role = profile?.role || "anggota";
  const menus = getMenuByRole(role);

  const navItemsHtml = menus
    .map((item) => {
      const isActive = item.id === activeMenuId;
      const activeClasses = isActive
        ? "bg-gold text-ink border-2 border-ink shadow-varsity-sm font-bold"
        : "text-cream/90 hover:bg-ink/40 border-2 border-transparent";

      const stageBadge = !item.ready
        ? `<span class="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-ink/50 text-parchment font-sans">Tahap 3/4</span>`
        : "";

      return `
        <a
          href="${item.href}"
          data-menu-id="${item.id}"
          data-ready="${item.ready}"
          class="flex items-center gap-2.5 px-3 py-2.5 rounded-md font-display uppercase tracking-wider text-sm transition-colors ${activeClasses}"
        >
          <span class="w-2 h-2 rounded-xs ${isActive ? "bg-champion-red" : "bg-gold/70"}"></span>
          <span>${escapeHTML(item.label)}</span>
          ${stageBadge}
        </a>
      `;
    })
    .join("");

  root.innerHTML = `
    <div class="min-h-screen flex flex-col lg:flex-row">
      <!-- Backdrop Mobile -->
      <div id="sidebar-backdrop" class="fixed inset-0 bg-ink/60 z-30 hidden lg:hidden"></div>

      <!-- Sidebar Olive -->
      <aside
        id="app-sidebar"
        class="fixed lg:static inset-y-0 left-0 z-40 w-72 bg-olive text-cream border-r-2 border-ink flex flex-col transform -translate-x-full lg:translate-x-0 transition-transform duration-200"
      >
        <!-- Brand Header -->
        <div class="p-4 border-b-2 border-ink bg-ink/25 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            ${renderChampionsEmblem({ size: "sm" })}
            <div>
              <div class="flex items-center gap-1.5">
                <span class="font-display font-bold text-xl tracking-wider text-cream leading-none">KAS KITA</span>
                <span class="font-script text-gold text-lg leading-none">Champions</span>
              </div>
              <p class="text-[11px] font-display uppercase tracking-widest text-parchment mt-1">
                KELAS TI24C • OFFICIAL
              </p>
            </div>
          </div>
          <button id="close-sidebar-btn" type="button" class="lg:hidden px-2 py-1 border border-cream/40 rounded text-xs">
            ✕
          </button>
        </div>

        <!-- User Badge -->
        <div class="p-4 border-b-2 border-ink/60 bg-ink/15">
          <p class="text-xs text-parchment uppercase font-display tracking-wider">Masuk Sebagai</p>
          <p class="font-bold text-sm text-cream truncate mt-0.5">${escapeHTML(profile?.full_name || "Anggota TI24C")}</p>
          <span class="inline-block mt-1.5 px-2 py-0.5 text-[11px] font-display font-bold uppercase tracking-wider bg-orange text-ink border border-ink rounded">
            ROLE: ${escapeHTML(getRoleLabel(role))}
          </span>
        </div>

        <!-- Menu Navigasi -->
        <nav class="flex-1 overflow-y-auto p-3 space-y-1" aria-label="Navigasi Utama">
          ${navItemsHtml}
        </nav>

        <!-- Footer Logout -->
        <div class="p-4 border-t-2 border-ink bg-ink/25">
          <button id="logout-btn" type="button" class="varsity-btn-primary w-full">
            Keluar Aplikasi
          </button>
        </div>
      </aside>

      <!-- Main Area -->
      <div class="flex-1 flex flex-col min-w-0">
        <!-- Top Header -->
        <header class="bg-parchment border-b-2 border-ink px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <button
              id="open-sidebar-btn"
              type="button"
              aria-label="Buka menu"
              class="lg:hidden varsity-btn-neutral px-3 py-2 text-xs"
            >
              ☰ MENU
            </button>
            <div>
              <h1 class="text-2xl sm:text-3xl font-bold uppercase text-ink leading-tight">
                ${escapeHTML(pageTitle)}
              </h1>
              <p class="text-xs sm:text-sm text-brown">${escapeHTML(pageSubtitle)}</p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            ${
              onRolePreviewChange
                ? `
              <label for="role-preview-select" class="text-xs font-display uppercase font-bold text-ink hidden sm:inline">
                Simulasi Role UI:
              </label>
              <select id="role-preview-select" class="varsity-input py-1.5 px-2.5 text-xs w-auto font-bold">
                <option value="bendahara" ${role === "bendahara" ? "selected" : ""}>Bendahara</option>
                <option value="ketua" ${role === "ketua" ? "selected" : ""}>Ketua Kelas</option>
                <option value="anggota" ${role === "anggota" ? "selected" : ""}>Anggota</option>
              </select>
            `
                : ""
            }
            <span class="varsity-badge bg-gold text-ink hidden sm:inline-flex">
              TI24C • 2026
            </span>
          </div>
        </header>

        <!-- Dynamic Page Content -->
        <main id="page-content" class="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
        </main>
      </div>
    </div>
  `;

  // Mobile Drawer Controls
  const sidebar = document.getElementById("app-sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");
  const openBtn = document.getElementById("open-sidebar-btn");
  const closeBtn = document.getElementById("close-sidebar-btn");

  const toggleSidebar = (show) => {
    if (show) {
      sidebar.classList.remove("-translate-x-full");
      backdrop.classList.remove("hidden");
    } else {
      sidebar.classList.add("-translate-x-full");
      backdrop.classList.add("hidden");
    }
  };

  openBtn?.addEventListener("click", () => toggleSidebar(true));
  closeBtn?.addEventListener("click", () => toggleSidebar(false));
  backdrop?.addEventListener("click", () => toggleSidebar(false));

  // Cegah dead-link untuk menu tahap 3/4 yang belum dibuat
  sidebar.querySelectorAll('a[data-ready="false"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const label = link.querySelector("span:nth-child(2)")?.textContent || "Modul";
      showToast(`Halaman "${label}" disiapkan pada Tahap 3 & 4 setelah migrasi database Supabase.`, "info");
      toggleSidebar(false);
    });
  });

  // Simulasi switcher role pada mode preview
  const roleSelect = document.getElementById("role-preview-select");
  roleSelect?.addEventListener("change", (e) => {
    if (onRolePreviewChange) onRolePreviewChange(e.target.value);
  });

  // Logout
  document.getElementById("logout-btn")?.addEventListener("click", async () => {
    try {
      await signOut();
      window.location.replace("/src/pages/login.html");
    } catch (err) {
      showToast(err.message || "Gagal keluar dari sesi.", "error");
    }
  });

  return document.getElementById("page-content");
}
