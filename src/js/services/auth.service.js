import { supabase, isSupabaseConfigured } from "../config/supabase.js";
import { toSafeUserError } from "../utils/error-handler.js";

export async function signInWithEmail(email, password) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Konfigurasi Supabase belum diisi pada file .env.");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    throw toSafeUserError(error, "Gagal masuk ke akun. Periksa kembali email dan kata sandi Anda.");
  }

  return data;
}

export async function signUpMemberAccount({ fullName, email, password }) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Konfigurasi Supabase belum diisi pada file .env.");
  }

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        full_name: fullName.trim(),
      },
    },
  });

  if (error) {
    throw toSafeUserError(error, "Pendaftaran akun gagal diproses.");
  }

  return data;
}

export async function requestPasswordReset(email) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Konfigurasi Supabase belum diisi pada file .env.");
  }

  const redirectTo = `${window.location.origin}/src/pages/login.html`;
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo,
  });

  if (error) {
    throw toSafeUserError(error, "Gagal mengirim tautan pemulihan kata sandi.");
  }
}

export async function updateUserPassword(newPassword) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Konfigurasi Supabase belum diisi pada file .env.");
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw toSafeUserError(error, "Gagal memperbarui kata sandi akun.");
  }
}

export async function signOutUser() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw toSafeUserError(error, "Gagal mengakhiri sesi.");
  }
}

export async function getCurrentSessionAndProfile() {
  if (!isSupabaseConfigured || !supabase) {
    return { configured: false, session: null, profile: null };
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData?.session) {
    return { configured: true, session: null, profile: null };
  }

  const user = sessionData.session.user;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, member_id, full_name, role, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return { configured: true, session: sessionData.session, profile: null, error: profileError };
  }

  return {
    configured: true,
    session: sessionData.session,
    profile: profile || {
      id: user.id,
      member_id: null,
      full_name: user.user_metadata?.full_name || user.email,
      role: "anggota",
    },
  };
}

export function subscribeAuthState(callback) {
  if (!supabase) return { unsubscribe: () => {} };
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return data.subscription;
}

// Alias kompatibilitas antarmodul
export const signIn = signInWithEmail;
export const signUp = signUpMemberAccount;
export const signOut = signOutUser;
