import * as XLSX from 'xlsx';
import { BLOOD_GROUPS, BLOOD_ALIASES } from './constants.js';

export function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export const IST_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const IST_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

export function getISTDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const parts = IST_DATE_FORMATTER.formatToParts(date);
  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;

  return year && month && day ? `${year}-${month}-${day}` : '';
}

export function formatISTDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return `${IST_DATE_TIME_FORMATTER.format(date)} IST`;
}

export function formatDisplayPhone(phone) {
  if (!phone) return '';
  const clean = String(phone).replace(/\D+/g, '');
  const last10 = clean.slice(-10);
  if (last10.length === 10) {
    return `+91-${last10}`;
  }
  return phone;
}

export function normalizeKey(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function cleanValue(value) {
  return String(value ?? '').trim();
}

export function extractAdmissionPrefix(admission) {
  if (!admission) return '';
  const clean = String(admission).trim().toLowerCase();

  // Pattern 1: e.g. 24je0102 -> 24je
  const match1 = clean.match(/^(\d+[a-z]+)/i);
  if (match1) return match1[1];

  // Pattern 2: e.g. ISM/2022/001 -> ism/2022
  const match2 = clean.match(/^([a-z0-9]+[\/_-][a-z0-9]+)/i);
  if (match2) return match2[1];

  // Default fallback: first 4 characters
  return clean.slice(0, 4);
}

export function extractBaseProgramme(programme) {
  if (!programme) return '';
  const clean = String(programme).trim();

  const match = clean.match(/^(B\.?\s*Tech|B\.?\s*Sc|B\.?\s*A|M\.?\s*Tech|M\.?\s*Sc|M\.?\s*A|MBA|Ph\.?D|B\.?\s*B\.?\s*A)/i);
  if (match) {
    let base = match[0].replace(/\s+/g, '');
    base = base.replace(/b\.?tech/i, 'B.Tech');
    base = base.replace(/b\.?sc/i, 'B.Sc');
    base = base.replace(/b\.?a/i, 'B.A.');
    base = base.replace(/m\.?tech/i, 'M.Tech');
    base = base.replace(/m\.?sc/i, 'M.Sc');
    base = base.replace(/m\.?a/i, 'M.A.');
    base = base.replace(/mba/i, 'MBA');
    base = base.replace(/ph\.?d/i, 'Ph.D.');
    base = base.replace(/b\.?b\.?a/i, 'B.B.A.');
    return base;
  }

  return clean.split(/[\s\/_]+/)[0];
}

export function normalizeBloodGroup(value) {
  const raw = cleanValue(value);
  if (!raw) return '';

  const normalized = normalizeKey(raw);
  return BLOOD_ALIASES[normalized] || BLOOD_ALIASES[raw.toLowerCase()] || raw.toUpperCase();
}

export function findRowValue(row, aliases) {
  const entries = Object.entries(row);

  for (const alias of aliases) {
    const normalizedAlias = normalizeKey(alias);
    const match = entries.find(([key, value]) => {
      if (!cleanValue(value)) return false;
      const normalizedKey = normalizeKey(key);
      return normalizedKey === normalizedAlias || normalizedKey.includes(normalizedAlias) || normalizedAlias.includes(normalizedKey);
    });

    if (match) {
      return cleanValue(match[1]);
    }
  }

  return '';
}

export function parseDonorsSheet(worksheet) {
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });

  return rows
    .map((row, index) => {
      const name = findRowValue(row, ['name', 'student name', 'donor name', 'full name']);
      const admission = findRowValue(row, ['admission no', 'admission number', 'admission', 'roll no', 'registration no']);
      const gender = findRowValue(row, ['gender', 'sex']);
      const programme = findRowValue(row, ['programme', 'program', 'course', 'branch', 'department']);
      const rawMobile = findRowValue(row, ['mobile no', 'mobile number', 'phone no', 'phone number', 'contact no', 'phone']);
      const mobileDigits = String(rawMobile || '').replace(/\D+/g, '');
      const mobile = mobileDigits.length > 10 ? mobileDigits.slice(-10) : mobileDigits;
      const blood = normalizeBloodGroup(findRowValue(row, ['blood group', 'blood', 'bg']));

      return {
        id: Date.now() + index + 1,
        name,
        admission,
        gender,
        programme,
        mobile,
        blood,
        lastDon: null,
        eligible: true,
        notified: false,
      };
    })
    .filter(donor => donor.name || donor.admission || donor.mobile || donor.blood);
}

export function getBloodCounts(donors) {
  return BLOOD_GROUPS.reduce((accumulator, group) => {
    accumulator[group] = donors.filter(donor => donor.blood === group).length;
    return accumulator;
  }, {});
}

export function formatSheetTime(value) {
  if (!value) return '';

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

export function isDonorInWhatsAppCooldown(donorMobile, whatsappEvents) {
  if (!whatsappEvents || !whatsappEvents.length) {
    return { hasSelectedMonth: false, inCooldown: false, expiryDate: null };
  }

  // Normalize mobile number to compare last 10 digits
  const normalizedMobile = String(donorMobile || '').replace(/\D+/g, '').slice(-10);
  if (!normalizedMobile) {
    return { hasSelectedMonth: false, inCooldown: false, expiryDate: null };
  }

  // Find all events for this donor
  const donorEvents = whatsappEvents.filter(e => {
    const eMobile = String(e.student_phone || '').replace(/\D+/g, '').slice(-10);
    return eMobile === normalizedMobile;
  });

  let newestCooldownExpiry = null;
  let matchesCondition = false;
  let selectedMonthsStr = '';
  let calculatedLastDon = '';

  for (const e of donorEvents) {
    const responseStr = e.response || '';
    if (!responseStr.startsWith('No - Donated Recently (')) {
      continue;
    }

    // Extract exact month selection
    let months = 0;
    if (responseStr.includes('1 month')) {
      months = 1;
    } else if (responseStr.includes('2 months')) {
      months = 2;
    } else if (responseStr.includes('3 months')) {
      months = 3;
    } else {
      continue; // Skip "Others"
    }

    matchesCondition = true;
    const eventDate = new Date(e.updated_at || e.created_at);
    if (Number.isNaN(eventDate.getTime())) continue;

    // Donation date = event date minus N months (assuming 30 days per month)
    const donationDate = new Date(eventDate.getTime() - months * 30 * 24 * 60 * 60 * 1000);
    // Cooldown expiry = donation date plus 90 days
    const expiryDate = new Date(donationDate.getTime() + 90 * 24 * 60 * 60 * 1000);

    if (!newestCooldownExpiry || expiryDate > newestCooldownExpiry) {
      newestCooldownExpiry = expiryDate;
      selectedMonthsStr = `${months} month${months > 1 ? 's' : ''}`;
      const monthsNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      calculatedLastDon = `${monthsNames[donationDate.getMonth()]} ${donationDate.getFullYear()}`;
    }
  }

  if (!matchesCondition) {
    return { hasSelectedMonth: false, inCooldown: false, expiryDate: null, selectedMonthsStr: '', calculatedLastDon: '' };
  }

  const today = new Date();
  const inCooldown = newestCooldownExpiry ? today <= newestCooldownExpiry : false;

  return {
    hasSelectedMonth: true,
    inCooldown,
    expiryDate: newestCooldownExpiry,
    selectedMonthsStr,
    calculatedLastDon
  };
}

export function formatShortDate(date) {
  if (!date) return '';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function getEventSender(event) {
  if (!event || !event.meta) return null;
  try {
    const parsed = typeof event.meta === 'string' ? JSON.parse(event.meta) : event.meta;
    return parsed.sender || null;
  } catch {
    return null;
  }
}

export function getPathState() {
  if (typeof window === 'undefined') {
    return { pathname: '/', token: '', view: '' };
  }

  const url = new URL(window.location.href);
  return {
    pathname: url.pathname,
    token: url.searchParams.get('token') || url.searchParams.get('resetToken') || '',
    view: url.searchParams.get('view') || '',
  };
}

export function getRequestPeriod(createdAt) {
  const createdKey = getISTDateKey(createdAt);
  if (!createdKey) return 'older';

  const now = new Date();
  const todayKey = getISTDateKey(now);
  if (!todayKey) return 'older';

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = getISTDateKey(yesterday);

  const createdMonthKey = createdKey.slice(0, 7);
  const currentMonthKey = todayKey.slice(0, 7);

  if (createdKey === todayKey) return 'today';
  if (createdKey === yesterdayKey) return 'yesterday';
  if (createdMonthKey === currentMonthKey) return 'this-month';
  return 'older';
}
