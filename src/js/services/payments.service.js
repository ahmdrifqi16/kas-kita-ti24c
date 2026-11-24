import { supabase } from "../config/supabase.js";

/**
 * Mengambil daftar tujuan transfer resmi yang aktif
 */
export async function fetchActiveDestinations() {
  const { data, error } = await supabase.from("payment_destinations").select("*").eq("is_active", true).order("provider_name", { ascending: true });

  if (error) throw new Error(`Gagal memuat tujuan transfer: ${error.message}`);
  return data || [];
}

/**
 * Anggota mengunggah bukti ke bucket privat & mengirim pengajuan transfer (pending)
 */
export async function submitTransferPayment({ userId, memberId, billId, destinationId, amount, proofFile, notes = "" }) {
  const fileExt = proofFile.name.split(".").pop();
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;
  const storagePath = `${userId}/${safeName}`;

  const { error: uploadError } = await supabase.storage.from("payment-proofs").upload(storagePath, proofFile, { upsert: false });

  if (uploadError) {
    throw new Error(`Gagal mengunggah bukti transfer: ${uploadError.message}`);
  }

  const { data, error: insertError } = await supabase
    .from("payments")
    .insert({
      bill_id: billId,
      member_id: memberId,
      destination_id: destinationId || null,
      amount: Number(amount),
      method: "transfer",
      proof_path: storagePath,
      notes: notes || null,
      status: "pending",
      submitted_by: userId,
    })
    .select()
    .single();

  if (insertError) {
    await supabase.storage.from("payment-proofs").remove([storagePath]);
    throw new Error(`Gagal mengirim pengajuan transfer: ${insertError.message}`);
  }

  return data;
}

/**
 * Anggota membatalkan pengajuan transfer miliknya yang masih berstatus pending
 */
export async function cancelPendingPayment(paymentId) {
  const { error } = await supabase.from("payments").update({ status: "cancelled" }).eq("id", paymentId).eq("status", "pending");

  if (error) {
    throw new Error(`Gagal membatalkan pengajuan: ${error.message}`);
  }
}

/**
 * Bendahara mencatat pembayaran tunai secara atomik
 */
export async function recordCashPayment({ billId, amount, notes = "" }) {
  const { data, error } = await supabase.rpc("rpc_record_cash_payment", {
    p_bill_id: billId,
    p_amount: Number(amount),
    p_notes: notes || null,
  });

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Bendahara memverifikasi (verified/rejected) pengajuan transfer
 */
export async function verifyTransferPayment({ paymentId, decision, rejectionReason = "" }) {
  const { data, error } = await supabase.rpc("rpc_verify_transfer_payment", {
    p_payment_id: paymentId,
    p_decision: decision,
    p_rejection_reason: rejectionReason || null,
  });

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Membuat Signed URL berbatas waktu (10 menit) untuk melihat bukti transfer privat
 */
export async function getPaymentProofSignedUrl(proofPath) {
  const { data, error } = await supabase.storage.from("payment-proofs").createSignedUrl(proofPath, 600);

  if (error) throw new Error(`Gagal membuka bukti transfer: ${error.message}`);
  return data.signedUrl;
}
