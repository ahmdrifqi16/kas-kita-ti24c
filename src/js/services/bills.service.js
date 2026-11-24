import { supabase } from "../config/supabase.js";

/**
 * Mengambil daftar periode kas
 */
export async function fetchCashPeriods() {
  const { data, error } = await supabase.from("cash_periods").select("*").order("created_at", { ascending: false });

  if (error) throw new Error(`Gagal memuat periode kas: ${error.message}`);
  return data || [];
}

/**
 * Mengambil tagihan (otomatis terfilter oleh RLS sesuai role & member_id)
 */
export async function fetchCashBills({ periodId = null } = {}) {
  let query = supabase
    .from("cash_bills")
    .select(
      `
      id,
      period_id,
      member_id,
      amount_due,
      amount_paid,
      status,
      due_date,
      created_at,
      cash_periods ( name, status ),
      members ( nim, full_name )
    `,
    )
    .order("due_date", { ascending: true });

  if (periodId) {
    query = query.eq("period_id", periodId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Gagal memuat data tagihan: ${error.message}`);
  return data || [];
}

/**
 * Bendahara membuat periode baru beserta tagihan snapshot via RPC atomik
 */
export async function createPeriodWithBills({ name, startDate, dueDate, defaultAmount = 10000, notes = "", memberIds = null }) {
  const { data, error } = await supabase.rpc("rpc_create_period_with_bills", {
    p_name: name,
    p_start_date: startDate,
    p_due_date: dueDate,
    p_default_amount: Number(defaultAmount),
    p_notes: notes || null,
    p_member_ids: memberIds,
  });

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Bendahara menutup periode kas tanpa menghapus histori transaksi
 */
export async function closeCashPeriod(periodId) {
  const { error: periodError } = await supabase.from("cash_periods").update({ status: "closed" }).eq("id", periodId);

  if (periodError) {
    throw new Error(`Gagal menutup periode kas: ${periodError.message}`);
  }

  const { error: billsError } = await supabase
    .from("cash_bills")
    .update({ status: "closed" })
    .eq("period_id", periodId)
    .in("status", ["unpaid", "partial", "overdue"]);

  if (billsError) {
    throw new Error(`Periode ditutup, namun gagal memperbarui status sisa tagihan: ${billsError.message}`);
  }
}
