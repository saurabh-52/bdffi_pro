function isActiveFlag(value) {
  return value === true || value === 1 || value === '1';
}

function isAlertsEnabledFlag(value) {
  return value === true || value === 1 || value === '1';
}

function normalizePhoneNumber(value) {
  let digits = String(value || '').replace(/\D+/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10) digits = `91${digits}`;
  return digits;
}

function toJsonText(value) {
  if (value == null) return null;
  if (typeof value === 'string') {
    try {
      JSON.parse(value);
      return value;
    } catch {
      return JSON.stringify({ raw: value });
    }
  }

  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ raw: String(value) });
  }
}

function normalizeDonor(row, index) {
  const rawMobile = String(row.mobile || row.phone || row.mobile_no || '').trim();
  const mobileDigits = rawMobile.replace(/\D+/g, '');
  const mobile = mobileDigits.length > 10 ? mobileDigits.slice(-10) : mobileDigits;

  return {
    id: Number(row.id) || Date.now() + index + 1,
    name: String(row.name || '').trim(),
    admission: String(row.admission || row.admission_no || '').trim(),
    gender: String(row.gender || '').trim(),
    programme: String(row.programme || '').trim(),
    blood: String(row.blood || row.blood_group || '').trim(),
    mobile,
    lastDon: row.lastDon || row.last_donation_date || null,
    eligible: Boolean(row.eligible ?? true),
    notified: Boolean(row.notified ?? false),
  };
}

module.exports = {
  isActiveFlag,
  isAlertsEnabledFlag,
  normalizePhoneNumber,
  toJsonText,
  normalizeDonor,
};
