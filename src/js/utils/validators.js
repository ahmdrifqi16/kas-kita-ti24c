export function validateEmail(email) {
  const trimmed = String(email || "").trim();
  if (!trimmed) {
    return { valid: false, message: "Email wajib diisi." };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, message: "Format alamat email tidak valid." };
  }
  return { valid: true, value: trimmed };
}

export function validatePassword(password) {
  const value = String(password || "");
  if (!value) {
    return { valid: false, message: "Kata sandi wajib diisi." };
  }
  if (value.length < 6) {
    return { valid: false, message: "Kata sandi minimal 6 karakter." };
  }
  return { valid: true, value };
}

export function validateNominalRupiah(amount, { min = 1000, max = null } = {}) {
  const num = Number(amount);
  if (!Number.isInteger(num) || Number.isNaN(num)) {
    return { valid: false, message: "Nominal harus berupa angka bulat tanpa desimal." };
  }
  if (num < min) {
    return {
      valid: false,
      message: `Nominal minimal adalah Rp${min.toLocaleString("id-ID")}.`,
    };
  }
  if (max !== null && num > max) {
    return {
      valid: false,
      message: `Nominal tidak boleh melebihi Rp${max.toLocaleString("id-ID")}.`,
    };
  }
  return { valid: true, value: num };
}

export function validateProofFile(file, maxSizeMB = 5) {
  if (!file) {
    return { valid: false, message: "Bukti transfer wajib diunggah." };
  }
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      message: "Format file harus JPG, PNG, WEBP, atau PDF.",
    };
  }
  const maxBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      valid: false,
      message: `Ukuran file maksimal ${maxSizeMB} MB.`,
    };
  }
  return { valid: true, value: file };
}
