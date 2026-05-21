import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';

// ── Mock data ─────────────────────────────────────────────
const MOCK_REQUESTS = [
  { id: 1, patient: 'Ravi Shankar', hospital: 'AIIMS Delhi', blood: 'B+', contact: '9876543210', status: 'pending', time: '2 min ago', donors: 6 },
  { id: 2, patient: 'Priya Mehta', hospital: 'Apollo, Mumbai', blood: 'O-', contact: '9123456789', status: 'active', time: '18 min ago', donors: 3 },
  { id: 3, patient: 'Arjun Das', hospital: 'Manipal Hospital', blood: 'A+', contact: '9988776655', status: 'fulfilled', time: '1 hr ago', donors: 8 },
  { id: 4, patient: 'Sunita Rao', hospital: 'KGH Vizag', blood: 'AB+', contact: '9765432100', status: 'pending', time: '3 hr ago', donors: 2 },
  { id: 5, patient: 'Mohit Gupta', hospital: 'PGIMER', blood: 'B-', contact: '9654321098', status: 'active', time: '5 hr ago', donors: 5 },
];

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

const ADMIN_NOTIFICATION_LOGS = [
  { id: 1, donor: 'Admin', request: 'Imported donor sheet', status: 'accepted', time: '5 min ago', msg: 'Active Excel sheet replaced and saved to backend.' },
  { id: 2, donor: 'Admin', request: 'Deleted donor sheet', status: 'declined', time: '18 min ago', msg: 'Current active sheet was cleared from backend storage.' },
  { id: 3, donor: 'Admin', request: 'Updated donor source', status: 'sent', time: '1 hr ago', msg: 'Fresh donor sheet synchronized for all users.' },
  { id: 4, donor: 'Admin', request: 'Opened sheet preview', status: 'pending', time: '2 hr ago', msg: 'Viewed the active donor sheet before export.' },
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
  { key: 'donors', label: 'Donors', icon: '👥', badge: '56' },
  { key: 'logs', label: 'Notifications', icon: '📲', badge: '3' },
];

// ── Sub-components ─────────────────────────────────────────

function StatCard({ value, label, icon, color, delta, deltaType }) {
  return (
    <div className={`stat-card ${color} animate-in`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {delta && <div className={`stat-delta ${deltaType}`}>{delta}</div>}
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

// ── Dashboard View ─────────────────────────────────────────
function DashboardView({ donors, onSeeAllNotifications }) {
  const eligibleCount = donors.filter(donor => donor.eligible).length;
  const bloodCounts = getBloodCounts(donors);
  const recentBloodNotifications = BLOOD_NOTIFICATION_LOGS.slice(0, 5);

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
                <span className="status-pill active">Live</span>
              </div>
            </div>
            <div className="request-list">
              {MOCK_REQUESTS.map(r => (
                <div key={r.id} className="request-row">
                  <BloodBadge type={r.blood} />
                  <div className="request-info">
                    <strong>{r.patient}</strong>
                    <span>{r.hospital} · {r.time}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{r.donors} matched</span>
                    <StatusPill status={r.status} />
                  </div>
                </div>
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
function RequestView() {
  const [form, setForm] = useState({ patientName: '', hospitalName: '', bloodGroup: 'A+', contactNo: '', urgency: 'normal', notes: '' });
  const [submitted, setSubmitted] = useState(false);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

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
    setSubmitted(true);
    setForm({ patientName: '', hospitalName: '', bloodGroup: 'A+', contactNo: '', urgency: 'normal', notes: '' });
    setFile(null);
    setTimeout(() => setSubmitted(false), 5000);
  };

  return (
    <div className="form-page animate-in">
      <h2>New Donation Request</h2>
      <p className="page-sub">Upload a medical requisition form or fill in the details manually. Matched donors will be notified via WhatsApp automatically.</p>

      <div className="form-card card">
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

          <div className="field">
            <label htmlFor="urgency">Urgency Level</label>
            <select id="urgency" name="urgency" value={form.urgency} onChange={handleChange}>
              <option value="normal">Normal</option>
              <option value="urgent">Urgent</option>
              <option value="critical">Critical — Immediate</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="notes">Additional Notes</label>
            <textarea id="notes" name="notes" value={form.notes} onChange={handleChange} placeholder="Specify units needed, ward details, or other context…" />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '⏳ Submitting…' : '🩸 Submit & Notify Donors'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setForm({ patientName: '', hospitalName: '', bloodGroup: 'A+', contactNo: '', urgency: 'normal', notes: '' })}>
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
    </div>
  );
}

// ── Donors View ────────────────────────────────────────────
function DonorsView({ donors, setDonors, sheetMeta, setSheetMeta }) {
  const [search, setSearch] = useState('');
  const [filterBG, setFilterBG] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [fileMessage, setFileMessage] = useState({ type: '', text: '' });
  const [showSheetPreview, setShowSheetPreview] = useState(false);
  const fileInputRef = useRef(null);

  const notify = id => setDonors(d => d.map(x => x.id === id ? { ...x, notified: true } : x));

  const triggerImport = () => fileInputRef.current?.click();

  const handleImport = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    try {
      setFileMessage({ type: 'info', text: `Reading ${file.name}...` });
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];

      if (!worksheet) {
        throw new Error('The workbook does not contain a readable sheet.');
      }

      const importedDonors = parseDonorsSheet(worksheet);

      if (!importedDonors.length) {
        throw new Error('No donor rows were found. Make sure the sheet includes the expected headers.');
      }

      const persistedSheet = await savePersistedSheet(importedDonors, {
        name: file.name,
        rows: importedDonors.length,
        importedAt: new Date().toISOString(),
      });

      setDonors(persistedSheet.donors || importedDonors);
      setSheetMeta(persistedSheet.sheetMeta || { name: file.name, rows: importedDonors.length, importedAt: new Date().toLocaleString() });
      setSearch('');
      setFilterBG('all');
      setFilterStatus('all');
      setFileMessage({ type: 'success', text: `Imported ${importedDonors.length} donors from ${file.name}.` });
      await sendBrowserNotification('Excel sheet imported', `${file.name} is now the active donor sheet with ${importedDonors.length} rows.`);
    } catch (error) {
      setFileMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to read the Excel file.' });
    }
  };

  const handleViewSheet = () => {
    if (!sheetMeta) {
      setFileMessage({ type: 'error', text: 'Import a sheet first to view its contents.' });
      return;
    }

    setShowSheetPreview(true);
  };

  const handleDeleteSheet = async () => {
    if (!sheetMeta) {
      setFileMessage({ type: 'error', text: 'No active sheet to delete.' });
      return;
    }

    const confirmed = window.confirm(`Delete the active sheet "${sheetMeta.name}" and clear the donor source data?`);
    if (!confirmed) return;

    const deletedName = sheetMeta.name;
    await deletePersistedSheet();
    setDonors([]);
    setSheetMeta(null);
    setSearch('');
    setFilterBG('all');
    setFilterStatus('all');
    setShowSheetPreview(false);
    setFileMessage({ type: 'success', text: `Deleted active sheet ${deletedName}.` });
    await sendBrowserNotification('Excel sheet deleted', `${deletedName} was removed from the active data source.`);
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
        <button type="button" className="btn btn-secondary import-btn danger" onClick={handleDeleteSheet} disabled={!sheetMeta}>
          🗑 Delete Sheet
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
function LogsView() {
  const iconMap = { sent: '📤', accepted: '✅', declined: '❌', pending: '⏳' };
  const [logType, setLogType] = useState('blood');

  const activeLogs = logType === 'blood' ? BLOOD_NOTIFICATION_LOGS : ADMIN_NOTIFICATION_LOGS;

  return (
    <div className="logs-page animate-in">
      <h2>Notification Log</h2>
      <p className="page-sub">Track blood-donation notifications and admin actions separately. Blood-donation activity is shown by default.</p>

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
          className={`log-toggle-btn ${logType === 'admin' ? 'active' : ''}`}
          onClick={() => setLogType('admin')}
        >
          Admin Action
        </button>
      </div>

      <div className="stats-row" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: '1.25rem' }}>
        <StatCard value="18" label="Sent" icon="📤" color="blue" />
        <StatCard value="9" label="Accepted" icon="✅" color="green" />
        <StatCard value="4" label="Declined" icon="❌" color="red" />
        <StatCard value="5" label="Awaiting" icon="⏳" color="amber" />
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

// ── App Shell ──────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState('dashboard');
  const [donors, setDonors] = useState(MOCK_DONORS);
  const [sheetMeta, setSheetMeta] = useState(null);

  useEffect(() => {
    let active = true;

    const loadSheet = async () => {
      try {
        const persistedSheet = await readPersistedSheet();
        if (!active) return;

        setDonors(Array.isArray(persistedSheet.donors) ? persistedSheet.donors : []);
        setSheetMeta(persistedSheet.sheetMeta || null);
      } catch (error) {
        if (active) {
          console.warn('Falling back to local donor defaults:', error);
        }
      }
    };

    loadSheet();

    return () => {
      active = false;
    };
  }, []);

  const PAGE_TITLES = {
    dashboard: { title: 'Operator Dashboard', sub: 'Real-time overview of all donation activity' },
    request:   { title: 'New Donation Request', sub: 'Submit or upload a blood requisition form' },
    donors:    { title: 'Donor Management', sub: 'Browse and notify eligible student donors' },
    logs:      { title: 'Notification Logs', sub: 'WhatsApp outreach status and donor replies' },
  };

  const { title, sub } = PAGE_TITLES[view];
  const navItems = NAV.map(item => item.key === 'donors' ? { ...item, badge: String(donors.length) } : item);

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
        <button className="nav-item">
          <span className="nav-icon">🔒</span> Admin Login
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
            <button className="topbar-btn" onClick={() => setView('donors')}>👥 Donors</button>
            <button className="topbar-btn primary" onClick={() => setView('request')}>➕ New Request</button>
          </div>
        </header>

        <div className="content-area">
          {view === 'dashboard' && <DashboardView donors={donors} onSeeAllNotifications={() => setView('logs')} />}
          {view === 'request'   && <RequestView />}
          {view === 'donors' && <DonorsView donors={donors} setDonors={setDonors} sheetMeta={sheetMeta} setSheetMeta={setSheetMeta} />}
          {view === 'logs'      && <LogsView />}
        </div>
      </div>
    </div>
  );
}
