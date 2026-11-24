import { supabase } from "../config/supabase.js";

/**
 * Mengambil ringkasan saldo resmi (total pemasukan, pengeluaran, saldo aktif)
 */
export async function fetchCashSummary() {
  const { data, error } = await supabase.rpc("get_official_cash_summary");
  if (error) throw new Error(`Gagal memuat saldo kas: ${error.message}`);

  const row = Array.isArray(data) ? data[0] : data;
  return {
    totalIncome: Number(row?.total_income || 0),
    totalExpense: Number(row?.total_expense || 0),
    currentBalance: Number(row?.current_balance || 0),
  };
}

/**
 * Mengambil buku besar transaksi publik yang sudah disanitasi (untuk semua role)
 */
export async function fetchPublicTransactions({ type = null, limit = 50 } = {}) {
  let query = supabase
    .from("view_public_transactions")
    .select("*")
    .order("trx_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (type) {
    query = query.eq("type", type);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Gagal memuat riwayat transaksi: ${error.message}`);
  return data || [];
}

/**
 * Bendahara mengambil seluruh data buku besar lengkap (termasuk deskripsi internal & status reversal)
 */
export async function fetchFullTransactions() {
  const { data, error } = await supabase
    .from("transactions")
    .select(
      `
      id,
      trx_number,
      payment_id,
      category_id,
      type,
      amount,
      trx_date,
      description,
      public_description,
      attachment_path,
      is_reversed,
      reversal_reason,
      created_at,
      transaction_categories ( id, code, name, type )
    `,
    )
    .order("trx_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Gagal memuat buku besar transaksi: ${error.message}`);
  return data || [];
}

/**
 * Mengunggah bukti nota pengeluaran ke bucket privat expense-attachments
 */
export async function uploadExpenseAttachment(file) {
  const fileExt = file.name.split(".").pop();
  const safeName = `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;

  const { error } = await supabase.storage.from("expense-attachments").upload(safeName, file, { upsert: false });

  if (error) {
    throw new Error(`Gagal mengunggah bukti pengeluaran: ${error.message}`);
  }

  return safeName;
}

/**
 * Membuat Signed URL berbatas waktu (10 menit) untuk nota pengeluaran
 */
export async function getExpenseAttachmentSignedUrl(attachmentPath) {
  const { data, error } = await supabase.storage.from("expense-attachments").createSignedUrl(attachmentPath, 600);

  if (error) throw new Error(`Gagal membuka nota pengeluaran: ${error.message}`);
  return data.signedUrl;
}

/**
 * Bendahara mencatat pengeluaran kas secara atomik
 */
export async function recordExpense({ categoryId, amount, trxDate, description, publicDescription = "", attachmentFile = null }) {
  let attachmentPath = null;

  if (attachmentFile) {
    attachmentPath = await uploadExpenseAttachment(attachmentFile);
  }

  const { data, error } = await supabase.rpc("rpc_record_expense", {
    p_category_id: categoryId,
    p_amount: Number(amount),
    p_trx_date: trxDate,
    p_description: description,
    p_public_description: publicDescription || null,
    p_attachment_path: attachmentPath,
  });

  if (error) {
    if (attachmentPath) {
      await supabase.storage.from("expense-attachments").remove([attachmentPath]);
    }
    throw new Error(error.message);
  }

  return data;
}

/**
 * Bendahara mencatat pemasukan non-tagihan (donasi, sumbangan, atau pemasukan lain)
 */
export async function recordOtherIncome({ categoryId, amount, trxDate, description, publicDescription = "", createdBy }) {
  const datePart = String(trxDate || new Date().toISOString().split("T")[0])
    .replace(/-/g, "")
    .slice(0, 6);
  const randSuffix = Math.floor(1000 + Math.random() * 9000);
  const trxNumber = `TRX-${datePart}-M${randSuffix}`;

  const cleanDesc = String(description).trim();
  const cleanPublic = String(publicDescription || "").trim() || cleanDesc;

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      trx_number: trxNumber,
      category_id: categoryId,
      type: "income",
      amount: Number(amount),
      trx_date: trxDate,
      description: cleanDesc,
      public_description: cleanPublic,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) throw new Error(`Gagal mencatat pemasukan tambahan: ${error.message}`);
  return data;
}

/**
 * Koreksi transaksi manual melalui pembatalan tercatat (reversal) tanpa menghapus histori
 */
export async function reverseManualTransaction({ trxId, reason, reversedBy }) {
  const { data, error } = await supabase
    .from("transactions")
    .update({
      is_reversed: true,
      reversed_by: reversedBy,
      reversal_reason: String(reason).trim(),
    })
    .eq("id", trxId)
    .is("payment_id", null)
    .eq("is_reversed", false)
    .select()
    .single();

  if (error) {
    throw new Error(`Gagal membatalkan transaksi: ${error.message}`);
  }

  return data;
}
