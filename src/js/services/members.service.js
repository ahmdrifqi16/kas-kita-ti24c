import { supabase } from "../config/supabase.js";
import { toSafeUserError } from "../utils/error-handler.js";

/**
 * Mengambil seluruh daftar anggota kelas TI24C
 */
export async function fetchMembers({ activeOnly = false } = {}) {
  let query = supabase.from("members").select("*").order("nim", { ascending: true });

  if (activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw toSafeUserError(error, "Gagal memuat daftar anggota kelas.");
  return data || [];
}

/**
 * Mengambil detail satu anggota berdasarkan ID (untuk halaman Profil)
 */
export async function fetchMemberById(memberId) {
  if (!memberId) return null;
  const { data, error } = await supabase.from("members").select("id, nim, full_name, nickname, phone, is_active").eq("id", memberId).maybeSingle();

  if (error) throw toSafeUserError(error, "Gagal memuat informasi keanggotaan.");
  return data;
}

/**
 * Bendahara menambahkan anggota baru
 */
export async function createMember({ nim, fullName, nickname = "", phone = "" }) {
  const { data, error } = await supabase
    .from("members")
    .insert({
      nim: nim.trim(),
      full_name: fullName.trim(),
      nickname: nickname.trim() || null,
      phone: phone.trim() || null,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw toSafeUserError(error, "Gagal menambahkan anggota baru.");
  return data;
}

/**
 * Bendahara memperbarui data atau status aktif anggota
 */
export async function updateMember(memberId, payload) {
  const { data, error } = await supabase.from("members").update(payload).eq("id", memberId).select().single();

  if (error) throw toSafeUserError(error, "Gagal memperbarui data anggota.");
  return data;
}

/**
 * Bendahara menghapus anggota kelas (aman: menolak jika sudah ada riwayat tagihan/pembayaran)
 */
export async function deleteMember(memberId) {
  const { count: billCount, error: billErr } = await supabase
    .from("cash_bills")
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId);

  if (billErr) {
    throw toSafeUserError(billErr, "Gagal memeriksa riwayat tagihan anggota.");
  }

  if ((billCount || 0) > 0) {
    throw new Error(
      'Anggota ini sudah memiliki riwayat tagihan/pembayaran kas sehingga tidak dapat dihapus permanen. Gunakan tombol "Nonaktifkan" agar riwayat keuangan tetap utuh.',
    );
  }

  // Lepaskan tautan profil akun terlebih dahulu jika ada
  await supabase.from("profiles").update({ member_id: null }).eq("member_id", memberId);

  const { error } = await supabase.from("members").delete().eq("id", memberId);

  if (error) throw toSafeUserError(error, "Gagal menghapus data anggota.");
}

/**
 * Mengambil seluruh daftar akun pengguna terdaftar (lengkap dengan email dari auth.users)
 */
export async function fetchAllProfiles() {
  const { data, error } = await supabase.rpc("rpc_bendahara_list_accounts");
  if (error) throw toSafeUserError(error, "Gagal memuat daftar akun pengguna.");
  return data || [];
}

/**
 * Bendahara membuat akun login pengguna baru
 */
export async function createUserAccount({ email, password, fullName, role = "anggota", memberId = null }) {
  const { data, error } = await supabase.rpc("rpc_bendahara_create_account", {
    p_email: email,
    p_password: password,
    p_full_name: fullName,
    p_role: role,
    p_member_id: memberId || null,
  });

  if (error) throw toSafeUserError(error, "Gagal membuat akun pengguna baru.");
  return data;
}

/**
 * Bendahara memperbarui profil, role, tautan NIM, dan opsional reset kata sandi akun
 */
export async function updateUserAccount({ userId, fullName, role, memberId = null, newPassword = "" }) {
  const { error } = await supabase.rpc("rpc_bendahara_update_account", {
    p_user_id: userId,
    p_full_name: fullName,
    p_role: role,
    p_member_id: memberId || null,
    p_new_password: newPassword || null,
  });

  if (error) throw toSafeUserError(error, "Gagal memperbarui akun pengguna.");
}

/**
 * Bendahara menghapus akun pengguna terdaftar
 */
export async function deleteUserAccount(userId) {
  const { error } = await supabase.rpc("rpc_bendahara_delete_account", {
    p_user_id: userId,
  });

  if (error) throw toSafeUserError(error, "Gagal menghapus akun pengguna.");
}

/**
 * Mengambil seluruh tujuan pembayaran (termasuk yang nonaktif untuk Bendahara)
 */
export async function fetchAllDestinations() {
  const { data, error } = await supabase.from("payment_destinations").select("*").order("created_at", { ascending: true });

  if (error) throw toSafeUserError(error, "Gagal memuat rekening tujuan.");
  return data || [];
}

/**
 * Bendahara menambah atau memperbarui rekening/e-wallet tujuan transfer
 */
export async function savePaymentDestination({ id = null, providerName, accountNumber, accountHolder, instructions = "", isActive = true }) {
  const record = {
    provider_name: providerName.trim(),
    account_number: accountNumber.trim(),
    account_holder: accountHolder.trim(),
    instructions: instructions.trim() || null,
    is_active: Boolean(isActive),
  };

  if (id) {
    const { data, error } = await supabase.from("payment_destinations").update(record).eq("id", id).select().single();

    if (error) throw toSafeUserError(error, "Gagal memperbarui rekening tujuan.");
    return data;
  }

  const { data, error } = await supabase.from("payment_destinations").insert(record).select().single();

  if (error) throw toSafeUserError(error, "Gagal menambahkan rekening tujuan.");
  return data;
}
