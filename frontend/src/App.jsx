import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';

// ── Mock data ─────────────────────────────────────────────
function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

const IST_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const IST_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

function getISTDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const parts = IST_DATE_FORMATTER.formatToParts(date);
  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;

  return year && month && day ? `${year}-${month}-${day}` : '';
}

function formatISTDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return `${IST_DATE_TIME_FORMATTER.format(date)} IST`;
}

const MOCK_REQUESTS = [
  { id: 1, patient: 'Ravi Shankar', hospital: 'AIIMS Delhi', blood: 'B+', contact: '9876543210', status: 'pending', time: '2 min ago', donors: 6, createdAt: daysAgo(0) },
  { id: 2, patient: 'Priya Mehta', hospital: 'Apollo, Mumbai', blood: 'O-', contact: '9123456789', status: 'active', time: '18 min ago', donors: 3, createdAt: daysAgo(0) },
  { id: 3, patient: 'Arjun Das', hospital: 'Manipal Hospital', blood: 'A+', contact: '9988776655', status: 'fulfilled', time: '1 hr ago', donors: 8, createdAt: daysAgo(1) },
  { id: 4, patient: 'Sunita Rao', hospital: 'KGH Vizag', blood: 'AB+', contact: '9765432100', status: 'pending', time: '3 hr ago', donors: 2, createdAt: daysAgo(35) },
  { id: 5, patient: 'Mohit Gupta', hospital: 'PGIMER', blood: 'B-', contact: '9654321098', status: 'active', time: '5 hr ago', donors: 5, createdAt: daysAgo(0) },
];

function getRequestPeriod(createdAt) {
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

const MOCK_DONORS = [
  { id: 1, name: 'Ankit Sharma', admission: 'ISM/2022/001', gender: 'Male', programme: 'B.Tech', blood: 'B+', mobile: '9810101010', lastDon: null, eligible: true, notified: false },
  { id: 2, name: 'Divya Pillai', admission: 'ISM/2022/047', gender: 'Female', programme: 'M.Tech', blood: 'O-', mobile: '9820202020', lastDon: null, eligible: true, notified: true },
  { id: 3, name: 'Karan Singh', admission: 'ISM/2023/012', gender: 'Male', programme: 'MBA', blood: 'A+', mobile: '9830303030', lastDon: null, eligible: false, notified: false },
  { id: 4, name: 'Nisha Patel', admission: 'ISM/2021/088', gender: 'Female', programme: 'B.Sc', blood: 'AB+', mobile: '9840404040', lastDon: null, eligible: true, notified: false },
  { id: 5, name: 'Rahul Joshi', admission: 'ISM/2023/055', gender: 'Male', programme: 'B.Tech', blood: 'B-', mobile: '9850505050', lastDon: null, eligible: true, notified: true },
  { id: 6, name: 'Sneha Reddy', admission: 'ISM/2022/033', gender: 'Female', programme: 'MCA', blood: 'A-', mobile: '9860606060', lastDon: null, eligible: true, notified: false },
  { id: 7, name: 'Vikram Nair', admission: 'ISM/2024/011', gender: 'Male', programme: 'B.Tech', blood: 'O+', mobile: '9870707070', lastDon: null, eligible: true, notified: false },
];

const BLOOD_NOTIFICATION_LOGS = [
  { id: 1, donor: 'Divya Pillai', request: 'Priya Mehta (O-)', status: 'accepted', time: '10 min ago', msg: 'Confirmed via WhatsApp ✓' },
  { id: 2, donor: 'Rahul Joshi', request: 'Mohit Gupta (B-)', status: 'sent', time: '22 min ago', msg: 'WhatsApp message delivered' },
  { id: 3, donor: 'Ankit Sharma', request: 'Ravi Shankar (B+)', status: 'pending', time: '35 min ago', msg: 'Awaiting reply…' },
  { id: 4, donor: 'Karan Singh', request: 'Arjun Das (A+)', status: 'declined', time: '1 hr ago', msg: 'Declined — ineligible cooldown' },
  { id: 5, donor: 'Nisha Patel', request: 'Sunita Rao (AB+)', status: 'sent', time: '2 hr ago', msg: 'WhatsApp message delivered' },
  { id: 6, donor: 'Sneha Reddy', request: 'Arjun Das (A+)', status: 'accepted', time: '3 hr ago', msg: 'Donor confirmed. NGO notified.' },
];

const MANAGER_NOTIFICATION_LOGS = [
  { id: 1, donor: 'Manager', request: 'Imported donor sheet', status: 'accepted', time: '5 min ago', msg: 'Active Excel sheet replaced and saved to backend.' },
  { id: 2, donor: 'Manager', request: 'Deleted donor sheet', status: 'declined', time: '18 min ago', msg: 'Current active sheet was cleared from backend storage.' },
  { id: 3, donor: 'Manager', request: 'Updated donor source', status: 'sent', time: '1 hr ago', msg: 'Fresh donor sheet synchronized for all users.' },
  { id: 4, donor: 'Manager', request: 'Opened sheet preview', status: 'pending', time: '2 hr ago', msg: 'Viewed the active donor sheet before export.' },
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const BLOOD_COUNTS = { 'A+': 14, 'A-': 5, 'B+': 11, 'B-': 3, 'AB+': 7, 'AB-': 2, 'O+': 10, 'O-': 4 };

const BLOOD_ALIASES = {
  'a+': 'A+',
  'apositive': 'A+',
  'a positive': 'A+',
  'a-': 'A-',
  'anegative': 'A-',
  'a negative': 'A-',
  'b+': 'B+',
  'bpositive': 'B+',
  'b positive': 'B+',
  'b-': 'B-',
  'bnegative': 'B-',
  'b negative': 'B-',
  'ab+': 'AB+',
  'abpositive': 'AB+',
  'ab positive': 'AB+',
  'ab-': 'AB-',
  'abnegative': 'AB-',
  'ab negative': 'AB-',
  'o+': 'O+',
  'opositive': 'O+',
  'o positive': 'O+',
  'o-': 'O-',
  'onegative': 'O-',
  'o negative': 'O-'
};

function normalizeKey(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function cleanValue(value) {
  return String(value ?? '').trim();
}

function normalizeBloodGroup(value) {
  const raw = cleanValue(value);
  if (!raw) return '';

  const normalized = normalizeKey(raw);
  return BLOOD_ALIASES[normalized] || BLOOD_ALIASES[raw.toLowerCase()] || raw.toUpperCase();
}

function findRowValue(row, aliases) {
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

function parseDonorsSheet(worksheet) {
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });

  return rows
    .map((row, index) => {
      const name = findRowValue(row, ['name', 'student name', 'donor name', 'full name']);
      const admission = findRowValue(row, ['admission no', 'admission number', 'admission', 'roll no', 'registration no']);
      const gender = findRowValue(row, ['gender', 'sex']);
      const programme = findRowValue(row, ['programme', 'program', 'course', 'branch', 'department']);
      const mobile = findRowValue(row, ['mobile no', 'mobile number', 'phone no', 'phone number', 'contact no', 'phone']);
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

function getBloodCounts(donors) {
  return BLOOD_GROUPS.reduce((accumulator, group) => {
    accumulator[group] = donors.filter(donor => donor.blood === group).length;
    return accumulator;
  }, {});
}

function formatSheetTime(value) {
  if (!value) return '';

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

async function readResponseData(response) {
  const text = await response.text();

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function readPersistedSheet() {
  const response = await fetch('/api/donors');
  if (!response.ok) {
    throw new Error('Failed to load donor sheet from backend.');
  }

  return response.json();
}

async function savePersistedSheet(donors, sheetMeta) {
  const response = await fetch('/api/donors/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ donors, sheetMeta }),
  });

  if (!response.ok) {
    throw new Error('Failed to save donor sheet to backend.');
  }

  return response.json();
}

async function deletePersistedSheet() {
  const response = await fetch('/api/donors', { method: 'DELETE' });
  if (!response.ok) {
    throw new Error('Failed to delete donor sheet from backend.');
  }

  return response.json();
}

async function readManagerAccounts() {
  const response = await fetch('/api/managers');
  if (!response.ok) {
    throw new Error('Failed to load manager accounts from backend.');
  }

  return response.json();
}

async function createManagerAccount(payload) {
  const response = await fetch('/api/managers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await readResponseData(response);

  if (!response.ok) {
    throw new Error(data.message || 'Failed to create manager account.');
  }

  return data;
}

async function deactivateManagerAccount(managerId) {
  const response = await fetch(`/api/managers/${managerId}/deactivate`, { method: 'POST' });
  const data = await readResponseData(response);

  if (!response.ok) {
    throw new Error(data.message || 'Failed to deactivate manager account.');
  }

  return data;
}

async function activateManagerAccount(managerId) {
  const response = await fetch(`/api/managers/${managerId}/activate`, { method: 'POST' });
  const data = await readResponseData(response);

  if (!response.ok) {
    throw new Error(data.message || 'Failed to activate manager account.');
  }

  return data;
}

async function updateGlobalWhatsAppAlerts(managerId, enabled) {
  const response = await fetch(`/api/managers/${managerId}/alerts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  const data = await readResponseData(response);

  if (!response.ok) {
    throw new Error(data.message || 'Failed to update WhatsApp alerts setting.');
  }

  return data;
}

async function sendDonorWhatsAppAlert(donor, message) {
  const templateParams = [
    donor?.name || 'Donor',
    donor?.blood || 'Unknown',
    donor?.programme || 'Student',
  ];

  const response = await fetch('/api/whatsapp/alerts/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ donor, message, templateParams }),
  });

  const data = await readResponseData(response);
  if (!response.ok) {
    throw new Error(data.message || 'Failed to send WhatsApp alert.');
  }

  return data;
}

async function sendBrowserNotification(title, body) {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;

  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;
  }

  if (Notification.permission !== 'granted') return false;

  new Notification(title, { body });
  return true;
}

const ACTIVITY = [
  { color: 'red', text: 'New request from AIIMS Delhi — B+ needed urgently', time: '2 min ago' },
  { color: 'green', text: 'Divya Pillai accepted O− donation for Apollo Mumbai', time: '10 min ago' },
  { color: 'amber', text: 'WhatsApp alert sent to 5 eligible B− donors', time: '22 min ago' },
  { color: 'blue', text: 'Arjun Das (A+) — request fulfilled', time: '1 hr ago' },
  { color: 'green', text: 'Sneha Reddy confirmed donation commitment', time: '3 hr ago' },
];

// ── Icons (inline SVG-free emoji/unicode) ─────────────────
const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: '⚡', badge: null },
  { key: 'request', label: 'New Request', icon: '➕', badge: null },
  { key: 'recent', label: 'Recent Requests', icon: '📋', badge: null },
  { key: 'donors', label: 'Donors', icon: '👥', badge: '56' },
  { key: 'logs', label: 'Notifications', icon: '📲', badge: '3' },
];

// ── Sub-components ─────────────────────────────────────────

function StatCard({ value, label, icon, color, delta, deltaType, onSeeMore }) {
  return (
    <div className={`stat-card ${color} animate-in`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {delta && <div className={`stat-delta ${deltaType}`}>{delta}</div>}
      {onSeeMore && (
        <button type="button" className="stat-action red" onClick={onSeeMore} aria-label={`See more ${label}`}>
          See more ▶
        </button>
      )}
    </div>
  );
}

function WhatsAppAdminPanel({ open, onClose }) {
  const [status, setStatus] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log('WhatsAppAdminPanel open=', open);
  }, [open]);

  async function fetchStatus() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/whatsapp/status');
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      setStatus({ ok: false, error: err.message });
    } finally { setLoading(false); }
  }

  async function fetchEvents() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/whatsapp/events');
      const data = await res.json();
      setEvents(data.events || []);
    } catch (err) {
      setEvents([]);
    } finally { setLoading(false); }
  }

  async function retryEvent(id) {
    try {
      const res = await fetch(`/api/admin/whatsapp/events/${id}/retry`, { method: 'POST' });
      const data = await res.json();
      await fetchEvents();
      await fetchStatus();
      alert(data.ok ? 'Retry succeeded' : `Retry failed: ${data.error || 'unknown'}`);
    } catch (err) {
      alert('Retry request failed: ' + err.message);
    }
  }

  useEffect(() => { if (open) { fetchStatus(); fetchEvents(); } }, [open]);

  if (!open) return null;

  return (
    <div className="sheet-modal-backdrop" onClick={onClose}>
      <div className="sheet-modal card" onClick={e => e.stopPropagation()} style={{ width: '760px', maxHeight: '70vh', overflow: 'auto' }}>
        <div className="card-header">
          <div>
            <h3>WhatsApp Admin</h3>
            <p style={{ margin: 0 }}>Manage WhatsApp event health and retries</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="action-btn" onClick={() => { fetchStatus(); fetchEvents(); }}>Refresh</button>
            <button className="action-btn" onClick={onClose}>Close</button>
          </div>
        </div>
        <div style={{ padding: '1rem' }}>
          {loading && <div>Loading…</div>}
          {status && (
            <div style={{ marginBottom: '1rem' }}>
              <strong>Config OK:</strong> {String(status.hasConfig)}<br />
              <strong>Missing:</strong> {(status.missing || []).join(', ')}<br />
              <strong>Failed events:</strong> {status.failed || 0}
            </div>
          )}

          <h4>Recent Events</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr><th>Id</th><th>Phone</th><th>Name</th><th>Status</th><th>MsgId</th><th>Attempts</th><th>Action</th></tr>
            </thead>
            <tbody>
              {events.map(ev => (
                <tr key={ev.id} style={{ borderTop: '1px solid #eee' }}>
                  <td>{ev.id}</td>
                  <td style={{ fontFamily: 'monospace' }}>{ev.student_phone}</td>
                  <td>{ev.student_name}</td>
                  <td>{ev.status}</td>
                  <td style={{ fontFamily: 'monospace' }}>{ev.message_id || '—'}</td>
                  <td>{ev.attempt_count}</td>
                  <td>
                    {ev.student_phone
                      ? <button className="action-btn" onClick={() => retryEvent(ev.id)}>{ev.status === 'failed' ? 'Retry' : 'Send Again'}</button>
                      : '—'}
                  </td>
                </tr>
              ))}
              {events.length === 0 && (<tr><td colSpan={7} style={{ textAlign: 'center' }}>No events</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function BloodBadge({ type }) {
  return <div className="blood-badge">{type}</div>;
}

function StatusPill({ status }) {
  const map = { pending: 'Pending', fulfilled: 'Fulfilled', active: 'Active' };
  return <span className={`status-pill ${status}`}>{map[status] || status}</span>;
}

function EyeToggleButton({ shown, onClick, label }) {
  return (
    <button
      type="button"
      className="action-btn"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{ minWidth: '3.5rem' }}
    >
      <span aria-hidden="true" style={{ fontSize: '1rem' }}>{shown ? '🙈' : '👁'}</span>
    </button>
  );
}

function getPathState() {
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

// Small request item component with expandable details showing who was notified
function RequestItem({ request }) {
  const [open, setOpen] = useState(false);

  // find matching notification logs for this request (match by patient name)
  const matches = BLOOD_NOTIFICATION_LOGS.filter(l => String(l.request || '').toLowerCase().includes(String(request.patient || '').toLowerCase()));

  return (
    <div style={{ width: '100%' }}>
      <div className="request-row">
        <BloodBadge type={request.blood} />
        <div className="request-info">
          <strong>{request.patient}</strong>
          <span>{request.hospital} · {formatISTDateTime(request.createdAt) || request.time}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{request.donors} matched</span>
          <StatusPill status={request.status} />
          <button type="button" className="action-btn" onClick={() => setOpen(s => !s)} aria-expanded={open} style={{ marginLeft: '0.5rem' }}>
            {open ? 'Hide' : 'Details'}
          </button>
        </div>
      </div>

      {open && (
        <div className="card" style={{ margin: '0.5rem 0', padding: '0.75rem', background: 'var(--bg-1)' }}>
          <div style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>
            <strong>Request details</strong>
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            <div><strong>Contact:</strong> {request.contact || '—'}</div>
            <div><strong>Blood:</strong> {request.blood}</div>
            <div><strong>Units:</strong> {request.donors}</div>
            <div><strong>Submitted:</strong> {formatISTDateTime(request.createdAt) || request.time}</div>
          </div>

          <div>
            <strong>Notifications sent</strong>
            {matches.length === 0 ? (
              <div style={{ color: 'var(--text-3)', marginTop: '0.5rem' }}>No notification records found for this request.</div>
            ) : (
              <div style={{ marginTop: '0.5rem' }}>
                {matches.map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px dashed var(--muted)' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{m.donor}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>{m.msg}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.85rem' }}>{m.status}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{m.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Dashboard View ─────────────────────────────────────────
function DashboardView({ donors, requests, onSeeAllNotifications, onSeeAllRequests }) {
  const eligibleCount = donors.filter(donor => donor.eligible).length;
  const bloodCounts = getBloodCounts(donors);
  const recentBloodNotifications = BLOOD_NOTIFICATION_LOGS.slice(0, 5);
  const recentRequests = requests.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

  return (
    <div className="section-gap">
      <div className="stats-row">
        <StatCard value="12" label="Open Requests" icon="🩸" color="red" delta="↑ 3 today" deltaType="warn" />
        <StatCard value={String(eligibleCount)} label="Eligible Donors" icon="👤" color="green" delta="↑ 8 this week" deltaType="up" />
        <StatCard value="76%" label="Response Rate" icon="📊" color="blue" delta="↑ 4% vs last wk" deltaType="up" />
        <StatCard value="28" label="Lives Impacted" icon="❤️" color="amber" delta="↑ 5 this month" deltaType="up" />
      </div>

      <div className="dashboard-grid">
        <div className="section-gap">
          {/* Recent requests */}
          <div className="card">
            <div style={{ padding: '1.25rem 1.25rem 0' }}>
              <div className="card-header">
                <div>
                  <h3>Recent Requests</h3>
                  <p>Latest blood donation requisitions</p>
                </div>
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                  <span className="status-pill active">Live</span>
                  <button type="button" className="action-btn notify see-all-btn" onClick={onSeeAllRequests} style={{ fontSize: '0.8rem' }}>
                    See All
                  </button>
                </div>
              </div>
            </div>
            <div className="request-list">
              {recentRequests.map(r => (
                <RequestItem key={r.id} request={r} />
              ))}
            </div>
          </div>

          {/* Blood group breakdown */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div className="card-header">
              <div><h3>Donor Pool by Blood Group</h3><p>Eligible donors currently in system</p></div>
            </div>
            <div className="blood-grid">
              {BLOOD_GROUPS.map(g => (
                <div key={g} className="blood-item">
                  <div className="bg-type">{g}</div>
                  <div className="bg-count">{bloodCounts[g]} donors</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column: activity */}
        <div className="card" style={{ padding: '1.25rem', alignSelf: 'start' }}>
          <div className="card-header">
            <div><h3>Live Activity</h3><p>Latest blood donation notifications</p></div>
            <button type="button" className="action-btn notify see-all-btn" onClick={onSeeAllNotifications}>
              See All
            </button>
          </div>
          <div className="activity-feed">
            {recentBloodNotifications.map(a => (
              <div key={a.id} className="activity-item">
                <div className={`activity-dot ${a.status === 'accepted' ? 'green' : a.status === 'declined' ? 'red' : a.status === 'pending' ? 'amber' : 'blue'}`} />
                <div className="activity-text">
                  <span>{a.donor} · {a.request}</span>
                  <span>{a.msg}</span>
                  <time className="activity-time">{a.time}</time>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Request Form View ──────────────────────────────────────
function RequestView({ donors = [], onCreateRequest }) {
  const emptyForm = { patientName: '', hospitalName: '', bloodGroup: 'A+', contactNo: '', unitsNeeded: '', urgency: 'normal', notes: '' };
  const [form, setForm] = useState(emptyForm);
  const [submitted, setSubmitted] = useState(false);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const bloodCounts = getBloodCounts(donors);
  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const handleFile = e => {
    const f = e.target.files[0];
    if (f) setFile(f);
  };
  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    setLoading(false);
    onCreateRequest?.({
      id: Date.now(),
      patient: form.patientName,
      hospital: form.hospitalName,
      blood: form.bloodGroup,
      contact: form.contactNo,
      status: 'pending',
      time: 'just now',
      donors: Number(form.unitsNeeded) || 0,
      createdAt: new Date().toISOString(),
    });
    setSubmitted(true);
    setForm(emptyForm);
    setFile(null);
    setTimeout(() => setSubmitted(false), 5000);
  };

  return (
    <div className="form-page animate-in">
      <h2>New Donation Request</h2>
      <p className="page-sub">Upload a medical requisition form or fill in the details manually. Matched donors will be notified via WhatsApp automatically.</p>
      <div className="request-layout">
        <div className="form-card card form-card-full">
          {/* Upload zone */}
          <label
            className={`upload-zone ${file ? 'has-file' : ''}`}
            htmlFor="form-upload"
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
          >
            <div className="upload-icon">{file ? '✅' : '📄'}</div>
            {file
              ? <p><strong>{file.name}</strong><br />Ready for AI extraction</p>
              : <p><strong>Drop requisition form here</strong><br />or click to upload · PDF, JPG, PNG</p>
            }
            <input id="form-upload" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFile} />
          </label>

          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="field">
                <label htmlFor="patientName">Patient Name *</label>
                <input id="patientName" name="patientName" required value={form.patientName} onChange={handleChange} placeholder="Full patient name" />
              </div>
              <div className="field">
                <label htmlFor="hospitalName">Hospital / Clinic *</label>
                <input id="hospitalName" name="hospitalName" required value={form.hospitalName} onChange={handleChange} placeholder="Hospital name" />
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label htmlFor="bloodGroup">Required Blood Group *</label>
                <select id="bloodGroup" name="bloodGroup" value={form.bloodGroup} onChange={handleChange}>
                  {BLOOD_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="contactNo">Contact Number *</label>
                <input id="contactNo" name="contactNo" required value={form.contactNo} onChange={handleChange} placeholder="+91 XXXXXXXXXX" />
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label htmlFor="unitsNeeded">Number of Units Needed *</label>
                <input id="unitsNeeded" name="unitsNeeded" type="number" min="1" step="1" required value={form.unitsNeeded} onChange={handleChange} placeholder="e.g. 2" />
              </div>
              <div className="field">
                <label htmlFor="urgency">Urgency Level</label>
                <select id="urgency" name="urgency" value={form.urgency} onChange={handleChange}>
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                  <option value="critical">Critical — Immediate</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label htmlFor="notes">Additional Notes</label>
              <textarea id="notes" name="notes" value={form.notes} onChange={handleChange} placeholder="Optional: ward details, timing, doctor notes, or other context…" />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? '⏳ Submitting…' : '🩸 Submit & Notify Donors'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setForm(emptyForm)}>
                Clear
              </button>
            </div>

            {submitted && (
              <div className="success-banner">
                ✅ Request saved! Matched donors are being notified via WhatsApp.
              </div>
            )}
          </form>
        </div>

        <aside className="card donor-pool-panel">
          <div className="card-header donor-pool-header">
            <div>
              <h3>Donor Pool by Blood Group</h3>
              <p>Eligible donors currently in system</p>
            </div>
          </div>

          <div className="donor-pool-list">
            {BLOOD_GROUPS.map(group => (
              <div key={group} className="donor-pool-item">
                <div className="donor-pool-group">{group}</div>
                <div className="donor-pool-count">{bloodCounts[group]} donors</div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── Recent Requests View ──────────────────────────────────
function RecentRequestsView({ requests }) {
  const [periodFilter, setPeriodFilter] = useState('all');
  const [detailsList, setDetailsList] = useState(null);
  const filteredRequests = requests.filter(request => {
    if (periodFilter === 'all') return true;
    const p = getRequestPeriod(request.createdAt);
    if (periodFilter === 'this-month') return p === 'this-month' || p === 'today' || p === 'yesterday';
    return p === periodFilter;
  });

  // sort newest -> oldest by createdAt
  const sortedRequests = filteredRequests.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="section-gap animate-in">
      <div style={{ marginBottom: '0.75rem' }}>
        <div className="stats-row" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
          <StatCard value="18" label="Sent" icon="📤" color="blue" onSeeMore={() => setDetailsList(BLOOD_NOTIFICATION_LOGS.filter(l => l.status==='sent'))} />
          <StatCard value="9" label="Accepted" icon="✅" color="green" onSeeMore={() => setDetailsList(BLOOD_NOTIFICATION_LOGS.filter(l => l.status==='accepted'))} />
          <StatCard value="4" label="Declined" icon="❌" color="red" onSeeMore={() => setDetailsList(BLOOD_NOTIFICATION_LOGS.filter(l => l.status==='declined'))} />
          <StatCard value="5" label="Awaiting" icon="⏳" color="amber" onSeeMore={() => setDetailsList(BLOOD_NOTIFICATION_LOGS.filter(l => l.status==='pending'))} />
        </div>
        {detailsList && (
          <div className="sheet-modal-backdrop" onClick={() => setDetailsList(null)}>
            <div className="sheet-modal card" onClick={e => e.stopPropagation()}>
              <div className="card-header">
                <div>
                  <h3>Notification Details</h3>
                  <p>{detailsList.length} record(s)</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="action-btn notify" onClick={() => setDetailsList(null)}>Close</button>
                </div>
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                {detailsList.length === 0 ? (
                  <div style={{ color: 'var(--text-3)' }}>No records</div>
                ) : (
                  detailsList.map(d => (
                    <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px dashed var(--border)' }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{d.donor}</div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-3)' }}>{d.msg}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>{d.request}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{d.status}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>{d.time}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card recent-requests-card">
        <div className="card-header">
          <div>
            <h3>Recent Requests</h3>
            <p>Latest blood donation requisitions and current status</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <select className="filter-select" value={periodFilter} onChange={e => setPeriodFilter(e.target.value)} aria-label="Filter recent requests by period">
              <option value="all">All</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this-month">This Month</option>
            </select>
            <span className="status-pill active">Live</span>
          </div>
        </div>

        <div className="request-list">
          {sortedRequests.map(request => (
            <RequestItem key={request.id} request={request} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Donors View ────────────────────────────────────────────
function DonorsView({ donors, setDonors, sheetMeta, setSheetMeta, whatsappAlertsEnabled }) {
  const [search, setSearch] = useState('');
  const [filterBG, setFilterBG] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [fileMessage, setFileMessage] = useState({ type: '', text: '' });
  const [alertMessage, setAlertMessage] = useState({ type: '', text: '' });
  const [showSheetPreview, setShowSheetPreview] = useState(false);
  const fileInputRef = useRef(null);

  const triggerImport = () => fileInputRef.current?.click();

  const handleViewSheet = () => setShowSheetPreview(true);

  const handleImport = async event => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const parsedDonors = parseDonorsSheet(worksheet);

      if (!parsedDonors.length) {
        setFileMessage({ type: 'error', text: 'No donor rows found in the selected file.' });
        return;
      }

      const nextSheetMeta = {
        name: file.name,
        rows: parsedDonors.length,
        importedAt: new Date().toISOString(),
      };

      await savePersistedSheet(parsedDonors, nextSheetMeta);
      setDonors(parsedDonors);
      setSheetMeta(nextSheetMeta);
      setFilterBG('all');
      setFilterStatus('all');
      setShowSheetPreview(false);
      setFileMessage({ type: 'success', text: `Imported ${parsedDonors.length} donors from ${file.name}.` });
      await sendBrowserNotification('Excel sheet imported', `${file.name} is now the active donor source.`);
    } catch (error) {
      console.error(error);
      setFileMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to import donor sheet.' });
    } finally {
      event.target.value = '';
    }
  };

  const handleDeleteSheet = async () => {
    if (!sheetMeta) return;

    const deletedName = sheetMeta.name;

    try {
      await deletePersistedSheet();
      setDonors(MOCK_DONORS);
      setSheetMeta(null);
      setSearch('');
      setFilterBG('all');
      setFilterStatus('all');
      setShowSheetPreview(false);
      setFileMessage({ type: 'success', text: `Removed active sheet ${deletedName}.` });
      await sendBrowserNotification('Excel sheet removed', `${deletedName} was removed from the active data source.`);
    } catch (error) {
      console.error(error);
      setFileMessage({ type: 'error', text: 'Failed to remove the active sheet.' });
    }
  };

  const handleDownloadSheet = () => {
    if (!sheetMeta) {
      setFileMessage({ type: 'error', text: 'Import a sheet first to download it.' });
      return;
    }

    const exportRows = donors.map(donor => ({
      'Name': donor.name || '',
      'Admission No': donor.admission || '',
      'Gender': donor.gender || '',
      'Programme': donor.programme || '',
      'Mobile No': donor.mobile || '',
      'Last Donation': donor.lastDon || 'Not known',
      'Blood Group': donor.blood || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Donors');

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${sheetMeta.name.replace(/\.xlsx?$/i, '') || 'donor-sheet'}-full.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const notify = async donorId => {
    const targetDonor = donors.find(donor => donor.id === donorId);

    if (!whatsappAlertsEnabled) {
      setAlertMessage({
        type: 'error',
        text: 'WhatsApp alerts are turned off globally. Enable them to send alerts.',
      });
      return;
    }

    if (!targetDonor) {
      setAlertMessage({ type: 'error', text: 'Selected donor was not found.' });
      return;
    }

    try {
      setAlertMessage({ type: '', text: '' });
      const result = await sendDonorWhatsAppAlert(targetDonor);
      setDonors(currentDonors => currentDonors.map(donor => (donor.id === donorId ? { ...donor, notified: true } : donor)));
      setAlertMessage({
        type: 'success',
        text: result.message || `WhatsApp alert sent to ${targetDonor.name || 'the selected donor'}.`,
      });
      await sendBrowserNotification('WhatsApp alert sent', `${targetDonor.name || 'Donor'} has been notified.`);
    } catch (error) {
      setAlertMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to send WhatsApp alert.',
      });
    }
  };

  const filtered = donors.filter(d => {
    const q = search.toLowerCase();
    const matchSearch = !q || (d.name || '').toLowerCase().includes(q) || (d.admission || '').toLowerCase().includes(q);
    const matchBG = filterBG === 'all' || d.blood === filterBG;
    const matchStatus = filterStatus === 'all' || (filterStatus === 'eligible' ? d.eligible : !d.eligible);
    return matchSearch && matchBG && matchStatus;
  });

  return (
    <div className="donors-page animate-in">
      <h2>Student Donors</h2>
      <p className="page-sub">All registered student donors — filter by blood group or search by name. Donors are eligible 90 days after their last donation.</p>

      <div className="donors-toolbar">
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or admission no…" />
        </div>
        <button type="button" className="btn btn-secondary import-btn" onClick={triggerImport}>
          📥 Import Excel
        </button>
        <button type="button" className="btn btn-secondary import-btn" onClick={handleViewSheet} disabled={!sheetMeta}>
          👁 View Sheet
        </button>
        <button
          type="button"
          className="btn btn-secondary import-btn danger"
          onClick={() => {
            if (!sheetMeta) return;
            const ok = window.confirm(`Remove active sheet '${sheetMeta.name}'? This will clear the saved donor list.`);
            if (ok) handleDeleteSheet();
          }}
          disabled={!sheetMeta}
        >
          🗑 Remove Sheet
        </button>
        <input ref={fileInputRef} type="file" accept=".xls,.xlsx" onChange={handleImport} className="sr-only-file" />
        <select className="filter-select" value={filterBG} onChange={e => setFilterBG(e.target.value)}>
          <option value="all">All Groups</option>
          {BLOOD_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Status</option>
          <option value="eligible">Eligible</option>
          <option value="cooldown">Cooldown</option>
        </select>
      </div>

      <div className="sheet-meta-bar">
        <div>
          <span className="sheet-meta-label">Active Sheet</span>
          <strong>{sheetMeta ? sheetMeta.name : 'No active sheet loaded'}</strong>
        </div>
        <div className="sheet-meta-stats">
          <span>{sheetMeta ? `${sheetMeta.rows} donor rows` : 'Import an Excel file to activate the source'}</span>
          {sheetMeta && <span>Updated {formatSheetTime(sheetMeta.importedAt)}</span>}
        </div>
      </div>

      {fileMessage.text && <div className={`import-banner ${fileMessage.type}`}>{fileMessage.text}</div>}
      {alertMessage.text && <div className={`import-banner ${alertMessage.type}`}>{alertMessage.text}</div>}

      <div className="donor-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Donor</th>
              <th>Gender</th>
              <th>Programme</th>
              <th>Blood Group</th>
              <th>Mobile No</th>
              <th>Last Donation</th>
              <th>Eligibility</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => (
              <tr key={d.id}>
                <td>
                  <div className="donor-name">{d.name}</div>
                  <div className="donor-adm">{d.admission}</div>
                </td>
                <td style={{ color: 'var(--text-2)', fontSize: '0.82rem' }}>{d.gender || '—'}</td>
                <td style={{ color: 'var(--text-2)', fontSize: '0.82rem' }}>{d.programme || '—'}</td>
                <td>
                  <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, color: 'var(--red)', fontSize: '0.95rem' }}>
                    {d.blood}
                  </span>
                </td>
                <td style={{ color: 'var(--text-2)', fontFamily: 'monospace', fontSize: '0.82rem' }}>{d.mobile || '—'}</td>
                <td style={{ color: 'var(--text-3)', fontSize: '0.82rem' }}>{d.lastDon || 'Not known'}</td>
                <td>
                  <span className={`eligible-badge ${d.eligible ? (d.lastDon ? 'yes' : 'warn') : 'no'}`}>
                    {d.eligible ? (d.lastDon ? '✓ Eligible' : '⚠ Eligible') : '✗ Cooldown'}
                  </span>
                </td>
                <td>
                  {d.notified
                    ? <span className="action-btn notified">📲 Notified</span>
                    : <button className="action-btn notify" onClick={() => notify(d.id)} disabled={!d.eligible}>
                        {d.eligible ? 'Send Alert' : 'Ineligible'}
                      </button>
                  }
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '2rem' }}>No donors match your filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showSheetPreview && sheetMeta && (
        <div className="sheet-modal-backdrop" onClick={() => setShowSheetPreview(false)}>
          <div className="sheet-modal card" onClick={e => e.stopPropagation()}>
            <div className="card-header">
              <div>
                <h3>{sheetMeta.name}</h3>
                <p>{sheetMeta.rows} rows in the active donor sheet</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button type="button" className="action-btn notify" onClick={handleDownloadSheet}>Download Sheet</button>
                <button type="button" className="action-btn notify" onClick={() => setShowSheetPreview(false)}>Close</button>
              </div>
            </div>
            <div className="sheet-preview">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Admission No</th>
                    <th>Gender</th>
                    <th>Programme</th>
                    <th>Mobile No</th>
                    <th>Blood Group</th>
                  </tr>
                </thead>
                <tbody>
                  {donors.slice(0, 8).map(donor => (
                    <tr key={donor.id}>
                      <td>{donor.name || '—'}</td>
                      <td>{donor.admission || '—'}</td>
                      <td>{donor.gender || '—'}</td>
                      <td>{donor.programme || '—'}</td>
                      <td>{donor.mobile || '—'}</td>
                      <td>{donor.blood || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {donors.length > 8 && <div className="sheet-preview-note">Showing first 8 rows only.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Logs View ──────────────────────────────────────────────
function LogsView({ managerLogs }) {
  const iconMap = { sent: '📤', accepted: '✅', declined: '❌', pending: '⏳' };
  const [logType, setLogType] = useState('blood');

  const activeLogs = logType === 'blood' ? BLOOD_NOTIFICATION_LOGS : managerLogs;

  return (
    <div className="logs-page animate-in">
      <h2>Notification Log</h2>
      <p className="page-sub">Track blood-donation notifications and manager actions separately. Blood-donation activity is shown by default.</p>

      <div className="log-toggle">
        <button
          type="button"
          className={`log-toggle-btn ${logType === 'blood' ? 'active' : ''}`}
          onClick={() => setLogType('blood')}
        >
          Blood Donation Related
        </button>
        <button
          type="button"
          className={`log-toggle-btn ${logType === 'manager' ? 'active' : ''}`}
          onClick={() => setLogType('manager')}
        >
          Manager Action
        </button>
      </div>

      

      <div className="card">
        <div className="log-list">
          {activeLogs.map(l => (
            <div key={l.id} className="log-row">
              <div className={`log-icon ${l.status}`}>{iconMap[l.status]}</div>
              <div className="log-info">
                <strong>{l.donor}</strong>
                <span>{l.request} — {l.msg}</span>
              </div>
              <span className={`status-pill ${l.status === 'accepted' ? 'fulfilled' : l.status === 'declined' ? 'pending' : 'active'}`} style={{ fontSize: '0.7rem' }}>
                {l.status}
              </span>
              <span className="log-time">{l.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ManagerDashboardView({ managerSession, onLogout, onAddManager, onUpdateSession, onRecordAction, whatsappAlertsEnabled, onToggleWhatsAppAlerts }) {
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const loadManagers = async () => {
      setLoading(true);
      setError('');

      try {
        const accounts = await readManagerAccounts();
        if (!active) return;
        setManagers(Array.isArray(accounts) ? accounts : []);
        const syncedManager = Array.isArray(accounts)
          ? accounts.find(manager => manager.is_primary) || accounts[0]
          : null;
        if (syncedManager) {
          onToggleWhatsAppAlerts?.(syncedManager.whatsapp_alerts_enabled !== false);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load manager accounts.');
          setManagers(managerSession ? [managerSession] : []);
          if (managerSession) {
            onToggleWhatsAppAlerts?.(managerSession.whatsapp_alerts_enabled !== false);
          }
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadManagers();

    return () => {
      active = false;
    };
  }, [managerSession]);

  const primaryManager = managers.find(manager => manager.is_primary) || managerSession;
  const currentManagerId = Number(managerSession?.id);
  const activeManagers = managers.filter(manager => manager.is_primary || manager.is_active);
  const deactivatedManagers = managers.filter(manager => !manager.is_primary && !manager.is_active);
  const handleDeactivate = async manager => {
    const confirmed = window.confirm(`Deactivate ${manager.gmail}? You will be logged out immediately and must activate the account to sign back in.`);
    if (!confirmed) {
      return;
    }

    setActionLoadingId(manager.id);
    setError('');

    try {
      await deactivateManagerAccount(manager.id);
      setManagers(current => current.filter(item => item.id !== manager.id));

      if (Number(managerSession?.id) === Number(manager.id)) {
        onLogout?.();
      }
    } catch (deactivateError) {
      setError(deactivateError instanceof Error ? deactivateError.message : 'Failed to deactivate manager account.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleAlerts = async manager => {
    const nextEnabled = !whatsappAlertsEnabled;
    const confirmed = window.confirm(
      `${nextEnabled ? 'Enable' : 'Disable'} WhatsApp alerts for all users? This change applies globally.`
    );

    if (!confirmed) {
      return;
    }

    setActionLoadingId(manager.id);
    setError('');

    try {
      const updatedManager = await updateGlobalWhatsAppAlerts(manager.id, nextEnabled);
      setManagers(current => current.map(item => ({ ...item, whatsapp_alerts_enabled: updatedManager.whatsapp_alerts_enabled })));
      onUpdateSession?.({ ...managerSession, whatsapp_alerts_enabled: updatedManager.whatsapp_alerts_enabled });
      onToggleWhatsAppAlerts?.(updatedManager.whatsapp_alerts_enabled);
      onRecordAction?.({
        request: updatedManager.whatsapp_alerts_enabled ? 'Enabled global WhatsApp alerts' : 'Disabled global WhatsApp alerts',
        status: updatedManager.whatsapp_alerts_enabled ? 'accepted' : 'declined',
        msg: `${managerSession?.name || updatedManager.name} turned ${updatedManager.whatsapp_alerts_enabled ? 'on' : 'off'} WhatsApp alerts for all users.`,
      });
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Failed to update WhatsApp alerts setting.');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="manager-page animate-in">
      <div className="manager-hero manager-dashboard-hero">
        <div className="manager-badge">Manager Dashboard</div>
        <h2>Manage manager Gmail accounts</h2>
        <p>Signed in as {managerSession?.gmail || 'a manager'} and able to add more manager accounts from this screen.</p>
          <div className="manager-dashboard-hero-meta">
          <div>
            <span className="manager-label">Current session</span>
            <strong>{managerSession?.gmail}</strong>
          </div>
          <div className="global-alert-toggle">
            <label className={`switch ${actionLoadingId != null ? 'disabled' : ''}`}>
              <input
                type="checkbox"
                checked={whatsappAlertsEnabled}
                disabled={actionLoadingId != null}
                onChange={() => handleToggleAlerts(managerSession)}
              />
              <span className="slider" />
            </label>
            <div className="toggle-label">{whatsappAlertsEnabled ? 'Alerts On' : 'Alerts Off'}</div>
          </div>
          <button type="button" className="action-btn notify logout-btn" onClick={onLogout}>
            <span className="logout-arrow">←</span>
            Logout
          </button>
        </div>
      </div>

      <div className="manager-dashboard-grid">
        <div className="manager-card card">
          <div className="card-header">
            <div>
              <h3>Active Accounts</h3>
              <p>{loading ? 'Loading accounts…' : `${activeManagers.length} active account${activeManagers.length === 1 ? '' : 's'}`}</p>
            </div>
            <button type="button" className="btn btn-primary manager-card-action" onClick={onAddManager}>
              ➕ Add Account
            </button>
          </div>

          <div className="manager-self-service-note">
            You can only deactivate your own account. You will be asked to confirm and then logged out immediately.
          </div>

          <div className="manager-summary-grid">
            <div>
              <span className="manager-label">Primary Manager</span>
              <strong>{primaryManager?.gmail || 'Not available'}</strong>
            </div>
            <div>
              <span className="manager-label">Total Accounts</span>
              <strong>{managers.length}</strong>
            </div>
          </div>

          <div className="manager-account-list">
            {activeManagers.map(manager => (
              <div key={manager.id || manager.gmail} className="manager-account-item">
                <div>
                  <strong>{manager.name}</strong>
                  <span>{manager.gmail}</span>
                </div>
                <div className="manager-account-actions">
                  <div className={`manager-account-badge ${manager.is_primary ? 'primary' : ''}`}>
                    {manager.is_primary ? 'Primary' : 'Manager'}
                  </div>
                  {!manager.is_primary && currentManagerId === Number(manager.id) && (
                    <button
                      type="button"
                      className="manager-deactivate-btn"
                      disabled={actionLoadingId === manager.id}
                      onClick={() => handleDeactivate(manager)}
                    >
                      {actionLoadingId === manager.id ? '…' : 'Deactivate'}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!loading && activeManagers.length === 0 && (
              <div className="manager-info">No manager accounts found yet.</div>
            )}
          </div>
        </div>

        <div className="manager-card card">
          <div className="card-header">
            <div>
              <h3>Deactivated Accounts</h3>
              <p>{loading ? 'Loading accounts…' : `${deactivatedManagers.length} deactivated account${deactivatedManagers.length === 1 ? '' : 's'}`}</p>
            </div>
          </div>

          <div className="manager-account-list">
            {deactivatedManagers.map(manager => (
              <div key={manager.id || manager.gmail} className="manager-account-item inactive">
                <div>
                  <strong>{manager.name}</strong>
                  <span>{manager.gmail}</span>
                </div>
                <div className="manager-account-actions">
                  <div className="manager-account-badge inactive">Deactivated</div>
                </div>
              </div>
            ))}
            {!loading && deactivatedManagers.length === 0 && (
              <div className="manager-info">No deactivated accounts.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ManagerAddAccountView({ managerSession, onLogout, onBackToDashboard }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ name: '', gmail: '' });
  const [tempPassword, setTempPassword] = useState(() => generateTemporaryPassword());

  function generateTemporaryPassword() {
    if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
      const bytes = new Uint8Array(12);
      window.crypto.getRandomValues(bytes);
      return Array.from(bytes, byte => (byte % 36).toString(36)).join('').slice(0, 12);
    }

    return `tmp-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
  }

  const handleChange = event => {
    const { name, value } = event.target;
    setForm(current => ({ ...current, [name]: value }));
  };

  const handleSubmit = async event => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const createdManager = await createManagerAccount({ ...form, password: tempPassword });
      setForm({ name: '', gmail: '' });
      setTempPassword(generateTemporaryPassword());
      setMessage(createdManager.tempPassword
        ? `Added ${createdManager.gmail}. Temporary password: ${createdManager.tempPassword}`
        : `Added ${createdManager.gmail}. The temporary password was emailed to the new manager.`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create manager account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="manager-page animate-in">
      <div className="manager-hero">
        <div className="manager-badge">Add Manager</div>
        <h2>Create a new manager account</h2>
        <p>Add a Gmail-based manager login from its own page.</p>
        <div className="manager-dashboard-hero-meta">
          <div>
            <span className="manager-label">Current session</span>
            <strong>{managerSession?.gmail}</strong>
          </div>
          <button type="button" className="action-btn notify" onClick={onLogout}>Logout</button>
        </div>
      </div>

      <form className="manager-card card manager-form-page" onSubmit={handleSubmit}>
        <div className="card-header">
          <div>
            <h3>Manager Details</h3>
            <p>Enter the new manager name, Gmail address, and password</p>
          </div>
          <button type="button" className="action-btn" onClick={onBackToDashboard}>Back to dashboard</button>
        </div>

        <div className="manager-form-grid">
          <div className="field">
            <label htmlFor="managerName">Manager Name</label>
            <input
              id="managerName"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              placeholder="Fast Forward India Manager"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="managerGmail">Manager Gmail</label>
            <input
              id="managerGmail"
              name="gmail"
              type="email"
              value={form.gmail}
              onChange={handleChange}
              placeholder="manager2@fastforwardindia.org"
              autoComplete="email"
              required
            />
          </div>

          {error && <div className="manager-error">{error}</div>}
          {message && <div className="manager-info">{message}</div>}

          <div className="manager-actions manager-actions-right">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '⏳ Saving…' : '➕ Add Manager'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ── Manager Login View ─────────────────────────────────────
function ManagerLoginView({ managerSession, onLoginSuccess }) {
  const [managerEmail, setManagerEmail] = useState(managerSession?.gmail ? String(managerSession.gmail) : '');
  const [password, setPassword] = useState('');
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activationPrompt, setActivationPrompt] = useState(null);
  const [activationLoading, setActivationLoading] = useState(false);

  useEffect(() => {
    setManagerEmail(managerSession?.gmail ? String(managerSession.gmail) : '');
    setPassword('');
  }, [managerSession?.gmail]);

  const handleLogin = async event => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/manager/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: managerEmail, password }),
      });
      const data = await readResponseData(response);

      if (!response.ok) {
        if (response.status === 423 && data?.inactive && data?.manager) {
          setActivationPrompt({
            id: data.manager.id,
            gmail: data.manager.gmail,
            password,
          });
          setError(data.message || 'Your account is deactivated.');
          return;
        }

        throw new Error(data.message || 'Manager login failed.');
      }

      setActivationPrompt(null);
      onLoginSuccess?.(data);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Manager login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleActivateAccount = async () => {
    if (!activationPrompt) return;

    setActivationLoading(true);
    setError('');

    try {
      const activatedManager = await activateManagerAccount(activationPrompt.id);
      setActivationPrompt(null);
      onLoginSuccess?.(activatedManager);
    } catch (activateError) {
      setError(activateError instanceof Error ? activateError.message : 'Failed to activate manager account.');
    } finally {
      setActivationLoading(false);
    }
  };

  const handleForgot = async event => {
    event.preventDefault();
    setForgotLoading(true);
    setForgotMessage('');

    try {
      const response = await fetch('/api/manager/forgot/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail || managerEmail }),
      });
      const data = await readResponseData(response);

      setForgotMessage(data?.message || 'If the email matches the seeded manager, a reset link has been sent.');
    } catch (err) {
      setForgotMessage(err instanceof Error ? err.message : 'Failed to request password reset.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="manager-page animate-in">
      <div className="manager-hero">
        <div className="manager-badge">Manager Login</div>
        <h2>Sign in with a manager account</h2>
        <p>Enter a valid manager Gmail and password to open the manager dashboard.</p>
      </div>

      <form className="manager-card card" onSubmit={forgotMode ? handleForgot : handleLogin}>
        <div className="card-header">
          <div>
            <h3>Restricted Access</h3>
            <p>Manager credentials are validated against the backend</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <button type="button" className="action-btn" onClick={() => {
              const next = !forgotMode;
              setForgotMode(next);
              setForgotMessage('');
              setForgotEmail('');
            }}>
              {forgotMode ? 'Back to login' : 'Forgot password?'}
            </button>
          </div>
        </div>

        <div className="manager-form-grid">
          <div className="field">
            <label htmlFor="managerEmail">Manager Email</label>
            <input
              id="managerEmail"
              type="email"
              value={forgotMode ? forgotEmail : managerEmail}
              onChange={e => forgotMode ? setForgotEmail(e.target.value) : setManagerEmail(e.target.value)}
              placeholder="manager@fastforwardindia.org"
              autoComplete="email"
              required
            />
          </div>

          {!forgotMode && (
            <div className="field">
              <label htmlFor="managerPassword">Password</label>
              <input
                id="managerPassword"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter manager password"
                autoComplete="current-password"
                required
              />
            </div>
          )}

          {error && <div className="manager-error">{error}</div>}
          {forgotMessage && <div className="manager-info">{forgotMessage}</div>}
          {activationPrompt && (
            <div className="manager-activation-prompt">
              <div>
                <strong>This account is deactivated.</strong>
                <span>Activate {activationPrompt.gmail} to continue.</span>
              </div>
              <button type="button" className="btn btn-primary" onClick={handleActivateAccount} disabled={activationLoading}>
                {activationLoading ? '⏳ Activating…' : 'Activate Account'}
              </button>
            </div>
          )}

          <div className="manager-actions">
            <button type="submit" className="btn btn-primary" disabled={forgotMode ? forgotLoading : loading}>
              {forgotMode ? (forgotLoading ? '⏳ Sending…' : '📧 Send Reset Link') : (loading ? '⏳ Checking…' : '🔐 Login')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function ForgotPasswordPage() {
  const pathState = getPathState();
  const [token, setToken] = useState(pathState.token);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined' || !pathState.token) return;

    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('token');
    cleanUrl.searchParams.delete('resetToken');
    window.history.replaceState({}, '', `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
  }, [pathState.token]);

  useEffect(() => {
    setShowPassword(false);
    setShowConfirmPassword(false);
  }, []);

  const handleSubmit = async event => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setLoading(false);
      setError('Passwords do not match.');
      return;
    }

    try {
      const response = await fetch('/api/manager/forgot/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await readResponseData(response);

      if (!response.ok) {
        throw new Error(data.message || 'Reset failed.');
      }

      setMessage(data.message || 'Password updated. You can now sign in.');
      setPassword('');
      setConfirmPassword('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Reset failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="manager-page animate-in">
      <div className="manager-hero">
        <div className="manager-badge">Reset Password</div>
        <h2>Create a new manager password</h2>
        <p>Open the link from your email and choose a new password.</p>
      </div>

      <form className="manager-card card" onSubmit={handleSubmit}>
        <div className="card-header">
          <div>
            <h3>Forgot Password</h3>
            <p>Reset link for the seeded manager account</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <button type="button" className="action-btn" onClick={() => { window.location.href = '/'; }}>
              Back to login
            </button>
          </div>
        </div>

        <div className="manager-form-grid">
          {!token && (
            <div className="manager-info">
              The reset link is missing its token. Please open the link from your email again.
            </div>
          )}

          <div className="field">
            <label htmlFor="newPassword">New Password</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter a new password"
                autoComplete="new-password"
                required
                style={{ flex: 1 }}
              />
              <EyeToggleButton
                shown={showPassword}
                onClick={() => setShowPassword(current => !current)}
                label={showPassword ? 'Hide password' : 'Show password'}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat the new password"
                autoComplete="new-password"
                required
                style={{ flex: 1 }}
              />
              <EyeToggleButton
                shown={showConfirmPassword}
                onClick={() => setShowConfirmPassword(current => !current)}
                label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              />
            </div>
          </div>

          {error && <div className="manager-error">{error}</div>}
          {message && <div className="manager-info">{message}</div>}

          <div className="manager-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '⏳ Resetting…' : '🔁 Update Password'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ── App Shell ──────────────────────────────────────────────
export default function App() {
  const pathState = getPathState();
  const [view, setView] = useState(() => {
    if (pathState.view === 'manager') return 'manager';
    if (pathState.view === 'add-manager') return 'add-manager';
    return 'dashboard';
  });
  const [donors, setDonors] = useState(MOCK_DONORS);
  const [requests, setRequests] = useState(MOCK_REQUESTS);
  const [sheetMeta, setSheetMeta] = useState(null);
  const [whatsappAlertsEnabled, setWhatsAppAlertsEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;

    try {
      const stored = window.localStorage.getItem('manager-session');
      const parsed = stored ? JSON.parse(stored) : null;
      return parsed ? parsed.whatsapp_alerts_enabled !== false : true;
    } catch {
      return true;
    }
  });
  const [managerLogs, setManagerLogs] = useState(MANAGER_NOTIFICATION_LOGS);
  const [managerSession, setManagerSession] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = window.localStorage.getItem('manager-session');
      const parsed = stored ? JSON.parse(stored) : null;
      return parsed && parsed.id != null ? { ...parsed, whatsapp_alerts_enabled: parsed.whatsapp_alerts_enabled !== false } : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let active = true;

    const loadSheet = async () => {
      try {
        const store = await readPersistedSheet();
        if (!active) return;

        if (store && Array.isArray(store.donors) && store.donors.length > 0) {
          setDonors(store.donors);
          setSheetMeta(store.sheetMeta || null);
        } else {
          setDonors(MOCK_DONORS);
          setSheetMeta(null);
        }
      } catch (error) {
        if (active) {
          console.warn('Falling back to local donor defaults:', error);
          setDonors(MOCK_DONORS);
          setSheetMeta(null);
        }
      }
    };

    loadSheet();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (managerSession) {
      window.localStorage.setItem('manager-session', JSON.stringify(managerSession));
    } else {
      window.localStorage.removeItem('manager-session');
    }
  }, [managerSession]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.location.hash) return;

    const cleanUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState({}, '', cleanUrl);
  }, []);

  const PAGE_TITLES = {
    dashboard: { title: 'Operator Dashboard', sub: 'Real-time overview of all donation activity' },
    request:   { title: 'New Donation Request', sub: 'Submit or upload a blood requisition form' },
    recent:    { title: 'Recent Requests', sub: 'Browse the latest request statuses and matches' },
    donors:    { title: 'Donor Management', sub: 'Browse and notify eligible student donors' },
    logs:      { title: 'Notification Logs', sub: 'WhatsApp outreach status and donor replies' },
    manager:   { title: 'Manager Login', sub: 'Restricted access for the seeded manager account' },
    'add-manager': { title: 'Add Manager', sub: 'Create a new manager Gmail account' },
  };

  const activePage = view === 'manager'
    ? (managerSession
      ? { title: 'Manager Dashboard', sub: 'Add manager Gmail accounts and review access' }
      : { title: 'Manager Login', sub: 'Restricted access for manager accounts' })
    : PAGE_TITLES[view];
  const { title, sub } = activePage;
  const navItems = NAV.map(item => item.key === 'donors' ? { ...item, badge: String(donors.length) } : item);

  const handleCreateRequest = request => {
    setRequests(currentRequests => [request, ...currentRequests]);
  };

  const handleManagerLoginSuccess = nextManagerSession => {
    const normalizedSession = { ...nextManagerSession, whatsapp_alerts_enabled: nextManagerSession.whatsapp_alerts_enabled !== false };
    setManagerSession(normalizedSession);
    setWhatsAppAlertsEnabled(normalizedSession.whatsapp_alerts_enabled);
    setView('manager');
  };

  const handleManagerSessionUpdate = nextManagerSession => {
    const normalizedSession = { ...nextManagerSession, whatsapp_alerts_enabled: nextManagerSession.whatsapp_alerts_enabled !== false };
    setManagerSession(normalizedSession);
    setWhatsAppAlertsEnabled(normalizedSession.whatsapp_alerts_enabled);
  };

  const handleToggleWhatsAppAlerts = enabled => {
    setWhatsAppAlertsEnabled(enabled);
  };

  const handleRecordManagerAction = entry => {
    const nextLog = {
      id: Date.now(),
      donor: managerSession?.name || 'Manager',
      request: entry.request,
      status: entry.status || 'accepted',
      time: 'just now',
      msg: entry.msg,
    };

    setManagerLogs(current => [nextLog, ...current]);
  };

  const handleOpenAddManager = () => {
    if (!managerSession) return;
    setView('add-manager');
  };

  const handleBackToDashboard = () => {
    setView('manager');
  };

  const handleManagerLogout = () => {
    setManagerSession(null);
  };

  const [showWhatsAppAdmin, setShowWhatsAppAdmin] = useState(() => {
    try {
      if (typeof window === 'undefined') return false;
      const params = new URLSearchParams(window.location.search);
      return params.get('view') === 'whatsapp-admin';
    } catch (e) { return false; }
  });
  const [whStatus, setWhStatus] = useState(null);
  const [whEvents, setWhEvents] = useState([]);
  useEffect(() => {
    const handlePopState = () => setView(current => current);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'whatsapp-admin') {
        // debug auto-open
        // console.log intentionally left for local debugging
        setShowWhatsAppAdmin(true);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    const handlePopState = () => setView(current => current);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (typeof window !== 'undefined' && pathState.pathname === '/forgot-password') {
    return <ForgotPasswordPage />;
  }

  return (
    <div className="app">
      <div className="orb orb-1" />
      <div className="orb orb-2" />

      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img className="logo-image" src="https://res.cloudinary.com/dvjschjlg/image/upload/v1722862190/FFI/Logo/gpq3l0srvnvyyjzeg8k5.png" alt="Fast Forward India logo" />
          <div className="logo-text">
            <strong>Fast Forward India</strong>
            <span>NGO · IIT (ISM) Dhanbad</span>
          </div>
        </div>

        <span className="sidebar-section-label">Navigation</span>

        {navItems.map(n => (
          <button key={n.key} className={`nav-item ${view === n.key ? 'active' : ''}`} onClick={() => setView(n.key)}>
            <span className="nav-icon">{n.icon}</span>
            {n.label}
            {n.badge && <span className="nav-badge">{n.badge}</span>}
          </button>
        ))}

        <div className="sidebar-divider" />
        <span className="sidebar-section-label">System</span>

        <button className="nav-item">
          <span className="nav-icon">⚙️</span> Settings
        </button>
        <button className={`nav-item ${view === 'manager' ? 'active' : ''}`} onClick={() => setView('manager')}>
          <span className="nav-icon">🔒</span> Manager Login
        </button>

        <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
          <div className="sidebar-footer">
            <p>🟢 WhatsApp API <strong>Connected</strong><br />Last ping: 12s ago</p>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <h2>{title}</h2>
            <p>{sub}</p>
          </div>
          <div className="topbar-right">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-3)' }}>
              <div className="status-dot" /> Live
            </div>
            <button className="topbar-btn primary" onClick={() => setView('request')}>➕ New Request</button>
            <button className="topbar-btn" onClick={() => setView('donors')}>👥 Donors</button>
            <button className="topbar-btn" onClick={() => { console.log('WhatsApp Admin button clicked'); setShowWhatsAppAdmin(true); }}>📲 WhatsApp Admin</button>
          </div>
        </header>

        <div className={`content-area ${view === 'request' ? 'request-mode' : ''}`}>
          {view === 'dashboard' && <DashboardView donors={donors} requests={requests} onSeeAllNotifications={() => setView('logs')} onSeeAllRequests={() => setView('recent')} />}
          {view === 'request'   && <RequestView donors={donors} onCreateRequest={handleCreateRequest} />}
          {view === 'recent'    && <RecentRequestsView requests={requests} />}
          {view === 'donors' && <DonorsView donors={donors} setDonors={setDonors} sheetMeta={sheetMeta} setSheetMeta={setSheetMeta} whatsappAlertsEnabled={whatsappAlertsEnabled} />}
          {view === 'logs'      && <LogsView managerLogs={managerLogs} />}
          {view === 'manager'   && (managerSession
            ? <ManagerDashboardView managerSession={managerSession} onLogout={handleManagerLogout} onAddManager={handleOpenAddManager} onUpdateSession={handleManagerSessionUpdate} onRecordAction={handleRecordManagerAction} whatsappAlertsEnabled={whatsappAlertsEnabled} onToggleWhatsAppAlerts={handleToggleWhatsAppAlerts} />
            : <ManagerLoginView managerSession={managerSession} onLoginSuccess={handleManagerLoginSuccess} />
          )}
          {view === 'add-manager' && managerSession && (
            <ManagerAddAccountView managerSession={managerSession} onLogout={handleManagerLogout} onBackToDashboard={handleBackToDashboard} />
          )}
        </div>
        <WhatsAppAdminPanel open={showWhatsAppAdmin} onClose={() => setShowWhatsAppAdmin(false)} />
      </div>
    </div>
  );
}
