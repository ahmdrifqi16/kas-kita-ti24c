import { supabase } from '../config/supabase.js';

/**
 * Mengambil kuitansi digital (otomatis terfilter oleh RLS: milik anggota atau semua untuk Bendahara)
 */
export async function fetchReceipts() {
  const { data, error } = await supabase
    .from('receipts')
    .select('id, receipt_number, payment_id, transaction_id, member_id, issued_at, snapshot_data')
    .order('issued_at', { ascending: false });

  if (error) throw new Error(`Gagal memuat kuitansi: ${error.message}`);
  return data || [];
}

/**
 * Mengambil riwayat pengajuan pembayaran beserta tujuan transfer dan info tagihan
 */
export async function fetchPayments({ status = null } = {}) {
  let query = supabase
    .from('payments')
    .select(`
      id,
      bill_id,
      member_id,
      destination_id,
      amount,
      method,
      proof_path,
      notes,
      status,
      rejection_reason,
      verified_at,
      created_at,
      members ( nim, full_name ),
      payment_destinations ( provider_name, account_number, account_holder ),
      cash_bills (
        amount_due,
        amount_paid,
        cash_periods ( name )
      )
    `)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Gagal memuat data pembayaran: ${error.message}`);
  return data || [];
}