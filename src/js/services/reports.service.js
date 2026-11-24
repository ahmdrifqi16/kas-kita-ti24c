import { supabase } from "../config/supabase.js";

/**
 * Mengambil data buku besar tersanitasi dengan filter tanggal dan jenis transaksi
 */
export async function fetchFilteredLedger({ startDate = null, endDate = null, type = null } = {}) {
  let query = supabase.from("view_public_transactions").select("*").order("trx_date", { ascending: true });

  if (startDate) {
    query = query.gte("trx_date", startDate);
  }
  if (endDate) {
    query = query.lte("trx_date", endDate);
  }
  if (type && type !== "all") {
    query = query.eq("type", type);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Gagal memuat laporan transaksi: ${error.message}`);
  return data || [];
}

/**
 * Mengambil daftar kategori transaksi untuk filter & form pengeluaran
 */
export async function fetchTransactionCategories(type = null) {
  let query = supabase.from("transaction_categories").select("*").order("name", { ascending: true });

  if (type) {
    query = query.eq("type", type);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Gagal memuat kategori transaksi: ${error.message}`);
  return data || [];
}
