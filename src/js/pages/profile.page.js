import { mountAppShell } from "../layouts/app-shell.js";
import { requireAuth } from "../guards/auth.guard.js";
import { fetchMemberById } from "../services/members.service.js";
import { updateUserPassword } from "../services/auth.service.js";
import { escapeHTML } from "../utils/formatters.js";
import { setButtonLoading } from "../utils/dom.js";
import { showToast } from "../components/ui-states.js";

async function init() {
  const auth = await requireAuth(["anggota"]);
  if (!auth) return;

  const { session, profile } = auth;
  const contentContainer = mountAppShell({
    profile,
    activeMenuId: "profile",
    pageTitle: "Profil & Keamanan Akun",
    pageSubtitle: "Informasi keanggotaan TI24C Champions & kata sandi",
  });

  let memberInfo = null;
  try {
    memberInfo = await fetchMemberById(profile.member_id);
  } catch {
    memberInfo = null;
  }

  contentContainer.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section class="varsity-card-light p-5 sm:p-6 space-y-4">
        <div class="border-b-2 border-ink pb-2.5">
          <h2 class="text-lg font-bold uppercase text-ink">Identitas Anggota TI24C</h2>
          <p class="text-xs text-brown">Informasi akun login dan tautan master data kelas</p>
        </div>

        <dl class="divide-y divide-ink/20 text-sm">
          <div class="py-2.5 flex justify-between gap-2">
            <dt class="text-brown font-medium">Nama Profil</dt>
            <dd class="font-bold text-ink">${escapeHTML(profile.full_name || "-")}</dd>
          </div>
          <div class="py-2.5 flex justify-between gap-2">
            <dt class="text-brown font-medium">Email Login</dt>
            <dd class="font-mono text-xs font-bold text-ink">${escapeHTML(session.user.email || "-")}</dd>
          </div>
          <div class="py-2.5 flex justify-between gap-2">
            <dt class="text-brown font-medium">Role Akun</dt>
            <dd><span class="varsity-badge bg-gold text-ink">ANGGOTA</span></dd>
          </div>
          <div class="py-2.5 flex justify-between gap-2">
            <dt class="text-brown font-medium">NIM Tertaut</dt>
            <dd class="font-mono font-bold text-olive">${escapeHTML(memberInfo?.nim || "Belum ditautkan Bendahara")}</dd>
          </div>
          <div class="py-2.5 flex justify-between gap-2">
            <dt class="text-brown font-medium">Nama Resmi Kelas</dt>
            <dd class="font-bold text-ink">${escapeHTML(memberInfo?.full_name || "-")}</dd>
          </div>
        </dl>
      </section>

      <section class="varsity-card-light p-5 sm:p-6 space-y-4">
        <div class="border-b-2 border-ink pb-2.5">
          <h2 class="text-lg font-bold uppercase text-ink">Ubah Kata Sandi</h2>
          <p class="text-xs text-brown">Gunakan minimal 8 karakter untuk menjaga keamanan akun Anda</p>
        </div>

        <form id="change-password-form" novalidate class="space-y-4">
          <div>
            <label for="new-pass" class="block font-display uppercase text-xs font-bold text-ink mb-1">Kata Sandi Baru *</label>
            <input id="new-pass" type="password" minlength="8" placeholder="Minimal 8 karakter" class="varsity-input" required />
            <p id="err-new-pass" class="hidden text-xs font-semibold text-champion-red mt-1"></p>
          </div>
          <div>
            <label for="confirm-pass" class="block font-display uppercase text-xs font-bold text-ink mb-1">Konfirmasi Kata Sandi Baru *</label>
            <input id="confirm-pass" type="password" minlength="8" placeholder="Ulangi kata sandi baru" class="varsity-input" required />
            <p id="err-confirm-pass" class="hidden text-xs font-semibold text-champion-red mt-1"></p>
          </div>
          <button id="save-pass-btn" type="submit" class="varsity-btn-primary w-full">Perbarui Kata Sandi</button>
        </form>
      </section>
    </div>
  `;

  document.getElementById("change-password-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const p1 = document.getElementById("new-pass").value;
    const p2 = document.getElementById("confirm-pass").value;
    const err1 = document.getElementById("err-new-pass");
    const err2 = document.getElementById("err-confirm-pass");

    const validLen = p1.length >= 8;
    err1.classList.toggle("hidden", validLen);
    if (!validLen) err1.textContent = "Kata sandi baru minimal 8 karakter.";

    const match = p1 === p2;
    err2.classList.toggle("hidden", match);
    if (!match) err2.textContent = "Konfirmasi kata sandi tidak cocok.";

    if (!validLen || !match) return;

    const btn = document.getElementById("save-pass-btn");
    setButtonLoading(btn, true, "Memperbarui...");

    try {
      await updateUserPassword(p1);
      document.getElementById("change-password-form").reset();
      showToast("Kata sandi akun berhasil diperbarui.", "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setButtonLoading(btn, false);
    }
  });
}

init();
