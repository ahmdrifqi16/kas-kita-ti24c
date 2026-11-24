import { renderChampionsEmblem } from "../components/emblem.js";
import { showToast } from "../components/ui-states.js";
import { isSupabaseConfigured } from "../config/supabase.js";
import { requestPasswordReset, signInWithEmail, signUpMemberAccount, subscribeAuthState, updateUserPassword } from "../services/auth.service.js";
import { redirectIfAuthenticated } from "../guards/auth.guard.js";
import { validateEmail, validatePassword } from "../utils/validators.js";
import { setButtonLoading } from "../utils/dom.js";

const emblemSlot = document.getElementById("login-emblem-slot");
if (emblemSlot) {
  emblemSlot.innerHTML = renderChampionsEmblem({ size: "md" });
}

const noticeSlot = document.getElementById("auth-notice-slot");
const authTabs = document.getElementById("auth-tabs");
const tabSignin = document.getElementById("tab-signin");
const tabSignup = document.getElementById("tab-signup");

const signinForm = document.getElementById("signin-form");
const signupForm = document.getElementById("signup-form");
const forgotForm = document.getElementById("forgot-form");
const recoveryForm = document.getElementById("recovery-update-form");

function showBannerNotice(message, tone = "warning") {
  if (!noticeSlot) return;
  const bg = tone === "error" ? "bg-champion-red/15 border-champion-red text-champion-red" : "bg-gold/40 border-ink text-ink";
  noticeSlot.innerHTML = `
    <div class="p-3 border-2 ${bg} rounded-md text-xs font-semibold">
      ${message}
    </div>
  `;
}

function switchAuthView(view) {
  signinForm.classList.add("hidden");
  signupForm.classList.add("hidden");
  forgotForm.classList.add("hidden");
  recoveryForm.classList.add("hidden");

  if (view === "signin" || view === "signup") {
    authTabs.classList.remove("hidden");
  } else {
    authTabs.classList.add("hidden");
  }

  if (view === "signin") {
    signinForm.classList.remove("hidden");
    tabSignin.className = "py-2 font-display uppercase text-xs font-bold tracking-wider rounded bg-gold text-ink border border-ink";
    tabSignup.className = "py-2 font-display uppercase text-xs font-bold tracking-wider rounded text-ink hover:bg-cream/60";
  } else if (view === "signup") {
    signupForm.classList.remove("hidden");
    tabSignup.className = "py-2 font-display uppercase text-xs font-bold tracking-wider rounded bg-gold text-ink border border-ink";
    tabSignin.className = "py-2 font-display uppercase text-xs font-bold tracking-wider rounded text-ink hover:bg-cream/60";
  } else if (view === "forgot") {
    forgotForm.classList.remove("hidden");
  } else if (view === "recovery") {
    recoveryForm.classList.remove("hidden");
  }
}

function setFieldErr(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg || "";
  el.classList.toggle("hidden", !msg);
}

// Periksa alasan pengalihan dari query parameter URL
const urlParams = new URLSearchParams(window.location.search);
const reason = urlParams.get("reason");
if (reason === "session_expired") {
  showBannerNotice("Sesi login Anda telah habis. Silakan masuk kembali untuk melanjutkan.", "warning");
} else if (reason === "unauthenticated") {
  showBannerNotice("Silakan masuk terlebih dahulu untuk mengakses halaman kas kelas.", "warning");
}

if (!isSupabaseConfigured) {
  showBannerNotice("Konfigurasi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY belum terpasang di .env.", "error");
} else {
  // Deteksi jika pengguna membuka halaman dari tautan email reset password
  subscribeAuthState((event) => {
    if (event === "PASSWORD_RECOVERY") {
      switchAuthView("recovery");
    }
  });

  if (!window.location.hash.includes("type=recovery")) {
    redirectIfAuthenticated();
  }
}

tabSignin?.addEventListener("click", () => switchAuthView("signin"));
tabSignup?.addEventListener("click", () => switchAuthView("signup"));
document.getElementById("open-forgot-btn")?.addEventListener("click", () => switchAuthView("forgot"));
document.getElementById("back-to-signin-btn")?.addEventListener("click", () => switchAuthView("signin"));

// 1. Submit Sign In
signinForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("signin-email").value;
  const password = document.getElementById("signin-password").value;

  const emailCheck = validateEmail(email);
  const passCheck = validatePassword(password, 6);

  setFieldErr("err-signin-email", emailCheck.valid ? "" : emailCheck.message);
  setFieldErr("err-signin-password", passCheck.valid ? "" : passCheck.message);
  if (!emailCheck.valid || !passCheck.valid) return;

  const btn = document.getElementById("signin-submit-btn");
  setButtonLoading(btn, true, "Memverifikasi...");

  try {
    await signInWithEmail(emailCheck.value, password);
    window.location.replace("/src/pages/dashboard.html");
  } catch (err) {
    showToast(err.message, "error");
    setButtonLoading(btn, false);
  }
});

// 2. Submit Sign Up Anggota
signupForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fullName = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;

  const nameValid = fullName.length >= 3;
  const emailCheck = validateEmail(email);
  const passCheck = validatePassword(password, 8);

  setFieldErr("err-signup-name", nameValid ? "" : "Nama lengkap minimal 3 karakter.");
  setFieldErr("err-signup-email", emailCheck.valid ? "" : emailCheck.message);
  setFieldErr("err-signup-password", passCheck.valid ? "" : passCheck.message);

  if (!nameValid || !emailCheck.valid || !passCheck.valid) return;

  const btn = document.getElementById("signup-submit-btn");
  setButtonLoading(btn, true, "Mendaftarkan...");

  try {
    const res = await signUpMemberAccount({
      fullName,
      email: emailCheck.value,
      password,
    });

    if (res.session) {
      showToast("Pendaftaran berhasil! Mengalihkan ke dashboard...", "success");
      window.location.replace("/src/pages/dashboard.html");
    } else {
      showBannerNotice("Pendaftaran berhasil! Silakan periksa email Anda untuk konfirmasi akun sebelum masuk.", "warning");
      signupForm.reset();
      switchAuthView("signin");
      setButtonLoading(btn, false);
    }
  } catch (err) {
    showToast(err.message, "error");
    setButtonLoading(btn, false);
  }
});

// 3. Submit Lupa Password
forgotForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("forgot-email").value;
  const emailCheck = validateEmail(email);

  setFieldErr("err-forgot-email", emailCheck.valid ? "" : emailCheck.message);
  if (!emailCheck.valid) return;

  const btn = document.getElementById("forgot-submit-btn");
  setButtonLoading(btn, true, "Mengirim...");

  try {
    await requestPasswordReset(emailCheck.value);
    showBannerNotice("Tautan pemulihan kata sandi telah dikirim ke email Anda jika terdaftar di sistem.", "warning");
    forgotForm.reset();
    switchAuthView("signin");
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    setButtonLoading(btn, false);
  }
});

// 4. Submit Kata Sandi Baru dari Recovery Link
recoveryForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const newPass = document.getElementById("recovery-new-pass").value;
  const passCheck = validatePassword(newPass, 8);

  setFieldErr("err-recovery-pass", passCheck.valid ? "" : passCheck.message);
  if (!passCheck.valid) return;

  const btn = document.getElementById("recovery-submit-btn");
  setButtonLoading(btn, true, "Menyimpan...");

  try {
    await updateUserPassword(newPass);
    showToast("Kata sandi baru berhasil disimpan! Mengalihkan ke dashboard...", "success");
    window.location.replace("/src/pages/dashboard.html");
  } catch (err) {
    showToast(err.message, "error");
    setButtonLoading(btn, false);
  }
});
