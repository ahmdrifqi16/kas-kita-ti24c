import { mountAppShell } from "../layouts/app-shell.js";
import { requireAuth } from "../guards/auth.guard.js";
import {
  createMember,
  createUserAccount,
  deleteMember,
  deleteUserAccount,
  fetchAllProfiles,
  fetchMembers,
  updateMember,
  updateUserAccount,
} from "../services/members.service.js";
import { escapeHTML } from "../utils/formatters.js";
import { validateEmail, validatePassword } from "../utils/validators.js";
import { setButtonLoading } from "../utils/dom.js";
import { renderEmptyState, renderErrorState, renderLoadingState, showToast } from "../components/ui-states.js";
import { closeModal, openConfirmModal, openModal } from "../components/modal.js";

let currentProfile = null;
let contentContainer = null;
let allMembers = [];
let allProfiles = [];
let memberSearchQuery = "";
let accountSearchQuery = "";

function openMemberFormModal(member = null) {
  const isEdit = Boolean(member);
  const modal = openModal({
    title: isEdit ? "Ubah Data Anggota" : "Tambah Anggota TI24C",
    badge: "MASTER ANGGOTA",
    maxWidthClass: "max-w-md",
    bodyHtml: `
      <form id="member-form" novalidate class="space-y-4">
        <div>
          <label for="m-nim" class="block font-display uppercase text-xs font-bold text-ink mb-1">NIM *</label>
          <input id="m-nim" type="text" value="${escapeHTML(member?.nim || "")}" placeholder="Contoh: 240511057" class="varsity-input font-mono" required />
          <p id="err-m-nim" class="hidden text-xs font-semibold text-champion-red mt-1"></p>
        </div>
        <div>
          <label for="m-fullname" class="block font-display uppercase text-xs font-bold text-ink mb-1">Nama Lengkap *</label>
          <input id="m-fullname" type="text" value="${escapeHTML(member?.full_name || "")}" placeholder="Nama lengkap mahasiswa" class="varsity-input" required />
          <p id="err-m-fullname" class="hidden text-xs font-semibold text-champion-red mt-1"></p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label for="m-nickname" class="block font-display uppercase text-xs font-bold text-ink mb-1">Nama Panggilan</label>
            <input id="m-nickname" type="text" value="${escapeHTML(member?.nickname || "")}" placeholder="Opsional" class="varsity-input" />
          </div>
          <div>
            <label for="m-phone" class="block font-display uppercase text-xs font-bold text-ink mb-1">No. WhatsApp / HP</label>
            <input id="m-phone" type="text" value="${escapeHTML(member?.phone || "")}" placeholder="08xxxxxxxxxx" class="varsity-input" />
          </div>
        </div>
      </form>
    `,
    footerHtml: `
      <button type="button" data-close-modal class="varsity-btn-neutral">Batal</button>
      <button type="submit" form="member-form" id="save-member-btn" class="varsity-btn-primary">
        ${isEdit ? "Simpan Perubahan" : "Simpan Anggota"}
      </button>
    `,
  });

  modal.querySelector("#member-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nim = modal.querySelector("#m-nim").value.trim();
    const fullName = modal.querySelector("#m-fullname").value.trim();
    const nickname = modal.querySelector("#m-nickname").value.trim();
    const phone = modal.querySelector("#m-phone").value.trim();

    const errNim = modal.querySelector("#err-m-nim");
    const errName = modal.querySelector("#err-m-fullname");

    errNim.classList.toggle("hidden", Boolean(nim));
    if (!nim) errNim.textContent = "NIM anggota wajib diisi.";

    errName.classList.toggle("hidden", Boolean(fullName));
    if (!fullName) errName.textContent = "Nama lengkap wajib diisi.";

    if (!nim || !fullName) return;

    const btn = modal.querySelector("#save-member-btn");
    setButtonLoading(btn, true, "Menyimpan...");

    try {
      if (isEdit) {
        await updateMember(member.id, {
          nim,
          full_name: fullName,
          nickname: nickname || null,
          phone: phone || null,
        });
        showToast(`Data anggota ${fullName} berhasil diperbarui.`, "success");
      } else {
        await createMember({ nim, fullName, nickname, phone });
        showToast(`Anggota ${fullName} berhasil ditambahkan.`, "success");
      }
      closeModal();
      await loadMembersData();
    } catch (err) {
      showToast(err.message || "Gagal menyimpan data anggota.", "error");
      setButtonLoading(btn, false);
    }
  });
}

function openAccountFormModal(account = null) {
  const isEdit = Boolean(account);
  const memberOptions = allMembers
    .map((m) => `<option value="${m.id}" ${account?.member_id === m.id ? "selected" : ""}>${escapeHTML(m.nim)} — ${escapeHTML(m.full_name)}</option>`)
    .join("");

  const modal = openModal({
    title: isEdit ? "Ubah Akun & Hak Akses" : "Tambah Akun Pengguna Baru",
    badge: isEdit ? account.email : "AKUN LOGIN BARU",
    maxWidthClass: "max-w-md",
    bodyHtml: `
      <form id="account-crud-form" novalidate class="space-y-4">
        ${
          !isEdit
            ? `
          <div>
            <label for="acc-email" class="block font-display uppercase text-xs font-bold text-ink mb-1">Email Login *</label>
            <input id="acc-email" type="email" placeholder="nama@email.com" class="varsity-input" required />
            <p id="err-acc-email" class="hidden text-xs font-semibold text-champion-red mt-1"></p>
          </div>
          `
            : `
          <div class="p-2.5 bg-parchment border border-ink rounded text-xs">
            <span class="text-brown font-semibold">Email Akun:</span>
            <p class="font-mono font-bold text-ink">${escapeHTML(account.email || "-")}</p>
          </div>
          `
        }

        <div>
          <label for="acc-fullname" class="block font-display uppercase text-xs font-bold text-ink mb-1">Nama Tampilan Profil *</label>
          <input id="acc-fullname" type="text" value="${escapeHTML(account?.full_name || "")}" placeholder="Nama lengkap pengguna" class="varsity-input" required />
          <p id="err-acc-fullname" class="hidden text-xs font-semibold text-champion-red mt-1"></p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label for="acc-role" class="block font-display uppercase text-xs font-bold text-ink mb-1">Role Hak Akses *</label>
            <select id="acc-role" class="varsity-input font-semibold">
              <option value="anggota" ${!account || account.role === "anggota" ? "selected" : ""}>Anggota Kelas</option>
              <option value="ketua" ${account?.role === "ketua" ? "selected" : ""}>Ketua Kelas</option>
              <option value="bendahara" ${account?.role === "bendahara" ? "selected" : ""}>Bendahara</option>
            </select>
          </div>

          <div>
            <label for="acc-member" class="block font-display uppercase text-xs font-bold text-ink mb-1">Tautkan ke NIM</label>
            <select id="acc-member" class="varsity-input">
              <option value="">-- Tidak Ditautkan --</option>
              ${memberOptions}
            </select>
          </div>
        </div>

        <div>
          <label for="acc-password" class="block font-display uppercase text-xs font-bold text-ink mb-1">
            ${isEdit ? "Kata Sandi Baru (Kosongkan jika tidak diubah)" : "Kata Sandi Awal (Min. 8 Karakter) *"}
          </label>
          <input
            id="acc-password"
            type="password"
            minlength="8"
            placeholder="${isEdit ? "Isi hanya jika ingin mereset password user" : "Minimal 8 karakter"}"
            class="varsity-input"
            ${isEdit ? "" : "required"}
          />
          <p id="err-acc-password" class="hidden text-xs font-semibold text-champion-red mt-1"></p>
        </div>
      </form>
    `,
    footerHtml: `
      <button type="button" data-close-modal class="varsity-btn-neutral">Batal</button>
      <button type="submit" form="account-crud-form" id="save-account-btn" class="varsity-btn-secondary">
        ${isEdit ? "Simpan Perubahan" : "Buat Akun"}
      </button>
    `,
  });

  const setErr = (id, msg) => {
    const el = modal.querySelector(`#${id}`);
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("hidden", !msg);
  };

  modal.querySelector("#account-crud-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const fullName = modal.querySelector("#acc-fullname").value.trim();
    const role = modal.querySelector("#acc-role").value;
    const memberId = modal.querySelector("#acc-member").value || null;
    const password = modal.querySelector("#acc-password").value;

    let hasError = false;

    if (fullName.length < 3) {
      setErr("err-acc-fullname", "Nama tampilan minimal 3 karakter.");
      hasError = true;
    } else {
      setErr("err-acc-fullname", "");
    }

    let emailVal = "";
    if (!isEdit) {
      const emailCheck = validateEmail(modal.querySelector("#acc-email").value);
      if (!emailCheck.valid) {
        setErr("err-acc-email", emailCheck.message);
        hasError = true;
      } else {
        setErr("err-acc-email", "");
        emailVal = emailCheck.value;
      }

      const passCheck = validatePassword(password, 8);
      if (!passCheck.valid) {
        setErr("err-acc-password", passCheck.message);
        hasError = true;
      } else {
        setErr("err-acc-password", "");
      }
    } else if (password.trim() !== "") {
      const passCheck = validatePassword(password, 8);
      if (!passCheck.valid) {
        setErr("err-acc-password", passCheck.message);
        hasError = true;
      } else {
        setErr("err-acc-password", "");
      }
    }

    if (hasError) return;

    const btn = modal.querySelector("#save-account-btn");
    setButtonLoading(btn, true, "Menyimpan...");

    try {
      if (isEdit) {
        await updateUserAccount({
          userId: account.id,
          fullName,
          role,
          memberId,
          newPassword: password.trim(),
        });
        showToast(`Akun ${account.email} berhasil diperbarui.`, "success");
      } else {
        await createUserAccount({
          email: emailVal,
          password,
          fullName,
          role,
          memberId,
        });
        showToast(`Akun baru ${emailVal} berhasil dibuat.`, "success");
      }

      closeModal();
      await loadMembersData();
    } catch (err) {
      showToast(err.message || "Gagal menyimpan data akun.", "error");
      setButtonLoading(btn, false);
    }
  });
}

function renderPage() {
  const qMember = memberSearchQuery.trim().toLowerCase();
  const filteredMembers = qMember
    ? allMembers.filter(
        (m) =>
          (m.nim || "").toLowerCase().includes(qMember) ||
          (m.full_name || "").toLowerCase().includes(qMember) ||
          (m.nickname || "").toLowerCase().includes(qMember),
      )
    : allMembers;

  const qAcc = accountSearchQuery.trim().toLowerCase();
  const filteredProfiles = qAcc
    ? allProfiles.filter(
        (p) =>
          (p.email || "").toLowerCase().includes(qAcc) ||
          (p.full_name || "").toLowerCase().includes(qAcc) ||
          (p.member_nim || "").toLowerCase().includes(qAcc),
      )
    : allProfiles;

  const memberRows = filteredMembers
    .map((m) => {
      const linkedProfile = allProfiles.find((p) => p.member_id === m.id);
      return `
        <tr class="hover:bg-parchment/40">
          <td class="py-3 px-4 font-mono text-xs font-bold text-ink">${escapeHTML(m.nim)}</td>
          <td class="py-3 px-4">
            <p class="font-bold text-sm text-ink">${escapeHTML(m.full_name)}</p>
            ${m.nickname ? `<p class="text-xs text-brown">Panggilan: ${escapeHTML(m.nickname)}</p>` : ""}
          </td>
          <td class="py-3 px-4 text-xs text-brown">${escapeHTML(m.phone || "-")}</td>
          <td class="py-3 px-4 text-xs">
            ${
              linkedProfile
                ? `<span class="varsity-badge bg-gold text-ink">TERHUBUNG (${escapeHTML(linkedProfile.role.toUpperCase())})</span>`
                : `<span class="text-brown">Belum ada akun</span>`
            }
          </td>
          <td class="py-3 px-4 text-center">
            <span class="varsity-badge ${m.is_active ? "bg-olive text-cream" : "bg-brown text-cream"}">
              ${m.is_active ? "AKTIF" : "NONAKTIF"}
            </span>
          </td>
          <td class="py-3 px-4 text-right whitespace-nowrap space-x-1">
            <button type="button" data-edit-member="${m.id}" class="varsity-btn-neutral py-1 px-2.5 text-xs">Edit</button>
            <button type="button" data-toggle-member="${m.id}" class="varsity-btn-secondary py-1 px-2.5 text-xs">
              ${m.is_active ? "Nonaktifkan" : "Aktifkan"}
            </button>
            <button type="button" data-delete-member="${m.id}" class="varsity-btn-primary py-1 px-2.5 text-xs">Hapus</button>
          </td>
        </tr>
      `;
    })
    .join("");

  const profileRows = filteredProfiles
    .map((p) => {
      const isSelf = p.id === currentProfile.id;
      return `
        <tr class="hover:bg-parchment/40">
          <td class="py-3 px-4">
            <p class="font-bold text-sm text-ink">
              ${escapeHTML(p.full_name || "Pengguna")}
              ${isSelf ? '<span class="ml-1 text-[10px] font-mono text-olive">(Akun Anda)</span>' : ""}
            </p>
            <p class="font-mono text-xs text-brown">${escapeHTML(p.email || "-")}</p>
          </td>
          <td class="py-3 px-4">
            <span class="varsity-badge bg-gold text-ink">${escapeHTML((p.role || "anggota").toUpperCase())}</span>
          </td>
          <td class="py-3 px-4 text-xs text-ink">
            ${
              p.member_id
                ? `<span class="font-mono font-bold text-olive">${escapeHTML(p.member_nim || "")}</span> — ${escapeHTML(p.member_full_name || "")}`
                : '<span class="text-champion-red font-semibold">Belum ditautkan</span>'
            }
          </td>
          <td class="py-3 px-4 text-right whitespace-nowrap space-x-1">
            <button type="button" data-edit-account="${p.id}" class="varsity-btn-secondary py-1 px-3 text-xs">
              Ubah / Tautkan
            </button>
            ${
              !isSelf
                ? `<button type="button" data-delete-account="${p.id}" class="varsity-btn-primary py-1 px-2.5 text-xs">
                    Hapus
                  </button>`
                : ""
            }
          </td>
        </tr>
      `;
    })
    .join("");

  contentContainer.innerHTML = `
    <section class="varsity-panel-dark p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 varsity-stitch-light">
      <div class="space-y-1">
        <span class="varsity-badge bg-gold text-ink">MASTER DATA & AKUN</span>
        <h2 class="text-xl font-bold uppercase text-cream">Anggota TI24C & Manajemen Akun Pengguna</h2>
        <p class="text-xs sm:text-sm text-parchment">
          Kelola daftar induk mahasiswa TI24C serta buat, ubah, tautkan, atau hapus akun login pengguna.
        </p>
      </div>
      <div class="flex flex-wrap gap-2 shrink-0">
        <button id="add-member-btn" type="button" class="varsity-btn-primary">+ Tambah Anggota</button>
        <button id="add-account-btn" type="button" class="varsity-btn-secondary">+ Tambah Akun Login</button>
      </div>
    </section>

    <!-- Tabel 1: Daftar Anggota Kelas -->
    <section class="varsity-card-light overflow-hidden">
      <div class="p-4 bg-parchment border-b-2 border-ink flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 class="text-lg font-bold uppercase text-ink">Daftar Anggota Kelas (${allMembers.length})</h3>
          <p class="text-xs text-brown">Anggota tanpa riwayat tagihan dapat dihapus permanen; anggota yang sudah memiliki transaksi dapat dinonaktifkan.</p>
        </div>
        <input id="member-search" type="search" value="${escapeHTML(memberSearchQuery)}" placeholder="Cari NIM atau nama..." class="varsity-input py-2 text-xs sm:w-64" />
      </div>
      ${
        filteredMembers.length === 0
          ? `<div class="p-6">${renderEmptyState({ title: "Anggota Tidak Ditemukan", description: "Belum ada data anggota yang sesuai pencarian." })}</div>`
          : `
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-olive text-cream font-display uppercase text-xs tracking-wider border-b-2 border-ink">
                  <th class="py-3 px-4">NIM</th>
                  <th class="py-3 px-4">Nama Lengkap</th>
                  <th class="py-3 px-4">Kontak</th>
                  <th class="py-3 px-4">Akun Login</th>
                  <th class="py-3 px-4 text-center">Status</th>
                  <th class="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y-2 divide-ink/15 text-sm">${memberRows}</tbody>
            </table>
          </div>`
      }
    </section>

    <!-- Tabel 2: Daftar Akun Pengguna Terdaftar -->
    <section class="varsity-card-light overflow-hidden">
      <div class="p-4 bg-parchment border-b-2 border-ink flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 class="text-lg font-bold uppercase text-ink">Daftar Akun Pengguna Terdaftar (${allProfiles.length})</h3>
          <p class="text-xs text-brown">Buat akun baru untuk anggota, ubah role/tautan NIM, reset password, atau hapus akun yang tidak terpakai.</p>
        </div>
        <input id="account-search" type="search" value="${escapeHTML(accountSearchQuery)}" placeholder="Cari email, nama, atau NIM..." class="varsity-input py-2 text-xs sm:w-64" />
      </div>
      ${
        filteredProfiles.length === 0
          ? `<div class="p-6">${renderEmptyState({ title: "Akun Tidak Ditemukan", description: "Tidak ada akun pengguna yang sesuai pencarian." })}</div>`
          : `
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-olive text-cream font-display uppercase text-xs tracking-wider border-b-2 border-ink">
                  <th class="py-3 px-4">Profil & Email Login</th>
                  <th class="py-3 px-4">Role</th>
                  <th class="py-3 px-4">Anggota Tertaut</th>
                  <th class="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y-2 divide-ink/15 text-sm">${profileRows}</tbody>
            </table>
          </div>`
      }
    </section>
  `;

  document.getElementById("add-member-btn")?.addEventListener("click", () => openMemberFormModal());
  document.getElementById("add-account-btn")?.addEventListener("click", () => openAccountFormModal());

  document.getElementById("member-search")?.addEventListener("input", (e) => {
    memberSearchQuery = e.target.value;
    renderPage();
    const input = document.getElementById("member-search");
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  });

  document.getElementById("account-search")?.addEventListener("input", (e) => {
    accountSearchQuery = e.target.value;
    renderPage();
    const input = document.getElementById("account-search");
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  });

  // Event Anggota: Edit, Nonaktifkan/Aktifkan, Hapus
  contentContainer.querySelectorAll("[data-edit-member]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const m = allMembers.find((item) => item.id === btn.dataset.editMember);
      if (m) openMemberFormModal(m);
    });
  });

  contentContainer.querySelectorAll("[data-toggle-member]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const m = allMembers.find((item) => item.id === btn.dataset.toggleMember);
      if (!m) return;
      const nextActive = !m.is_active;
      const ok = await openConfirmModal({
        title: nextActive ? "Aktifkan Anggota" : "Nonaktifkan Anggota",
        message: `${nextActive ? "Aktifkan kembali" : "Nonaktifkan"} ${m.full_name} (${m.nim}) dari daftar penagihan kas?`,
        confirmLabel: "Ya, Lanjutkan",
        variant: nextActive ? "secondary" : "danger",
      });
      if (!ok) return;

      try {
        await updateMember(m.id, { is_active: nextActive });
        showToast(`Status ${m.full_name} berhasil diubah.`, "success");
        await loadMembersData();
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  });

  contentContainer.querySelectorAll("[data-delete-member]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const m = allMembers.find((item) => item.id === btn.dataset.deleteMember);
      if (!m) return;

      const ok = await openConfirmModal({
        title: "Hapus Anggota Kelas",
        message: `Hapus permanen ${m.full_name} (${m.nim}) dari daftar anggota kelas? Data hanya dapat dihapus jika belum memiliki riwayat tagihan atau pembayaran.`,
        confirmLabel: "Ya, Hapus Anggota",
        variant: "danger",
      });
      if (!ok) return;

      try {
        await deleteMember(m.id);
        showToast(`Anggota ${m.full_name} berhasil dihapus.`, "success");
        await loadMembersData();
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  });

  // Event Akun Pengguna: Ubah/Tautkan, Hapus
  contentContainer.querySelectorAll("[data-edit-account]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = allProfiles.find((item) => item.id === btn.dataset.editAccount);
      if (p) openAccountFormModal(p);
    });
  });

  contentContainer.querySelectorAll("[data-delete-account]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const p = allProfiles.find((item) => item.id === btn.dataset.deleteAccount);
      if (!p) return;

      const ok = await openConfirmModal({
        title: "Hapus Akun Pengguna",
        message: `Hapus permanen akun login "${p.full_name}" (${p.email})? Pengguna tidak akan bisa masuk lagi kecuali mendaftar ulang, namun data induk anggota di tabel atas tetap aman.`,
        confirmLabel: "Ya, Hapus Akun",
        variant: "danger",
      });
      if (!ok) return;

      try {
        await deleteUserAccount(p.id);
        showToast(`Akun ${p.email} berhasil dihapus.`, "success");
        await loadMembersData();
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  });
}

async function loadMembersData() {
  contentContainer.innerHTML = renderLoadingState("Memuat daftar anggota & akun pengguna...");
  try {
    const [members, profiles] = await Promise.all([fetchMembers(), fetchAllProfiles()]);
    allMembers = members;
    allProfiles = profiles;
    renderPage();
  } catch (err) {
    contentContainer.innerHTML = renderErrorState({
      title: "Gagal Memuat Data Anggota & Akun",
      message: err.message,
      retryId: "retry-members-btn",
    });
    document.getElementById("retry-members-btn")?.addEventListener("click", loadMembersData);
  }
}

async function init() {
  const auth = await requireAuth(["bendahara"]);
  if (!auth) return;
  currentProfile = auth.profile;
  contentContainer = mountAppShell({
    profile: currentProfile,
    activeMenuId: "members",
    pageTitle: "Anggota Kelas TI24C",
    pageSubtitle: "Master data mahasiswa & CRUD akun pengguna terdaftar",
  });
  await loadMembersData();
}

init();
