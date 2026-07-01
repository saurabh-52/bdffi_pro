import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { BLOOD_GROUPS, MOCK_DONORS } from '../../utils/constants.js';
import {
  parseDonorsSheet,
  isDonorInWhatsAppCooldown,
  extractAdmissionPrefix,
  extractBaseProgramme,
  formatShortDate,
  formatSheetTime,
  formatDisplayPhone
} from '../../utils/helpers.js';
import {
  savePersistedSheet,
  deletePersistedSheet,
  sendDonorWhatsAppAlert,
  sendBrowserNotification
} from '../../utils/api.js';

export default function DonorsView({
  donors,
  setDonors,
  sheetMeta,
  setSheetMeta,
  whatsappAlertsEnabled,
  onOpenOutreachModal,
  cooldowns = {},
  setCooldowns,
  onRecordAction,
  whatsappEvents = [],
  managerSession,
  volunteerSession,
  blockedFilters = { admissionPrefixes: [], programmes: [] },
  setBlockedFilters // Added to resolve scoping bug
}) {
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

      const store = await savePersistedSheet(parsedDonors, nextSheetMeta);
      setDonors(parsedDonors);
      setSheetMeta(nextSheetMeta);
      if (store && store.blockedFilters && setBlockedFilters) {
        setBlockedFilters(store.blockedFilters);
      }
      setFilterBG('all');
      setFilterStatus('all');
      setShowSheetPreview(false);
      setFileMessage({ type: 'success', text: `Imported ${parsedDonors.length} donors from ${file.name}.` });
      await sendBrowserNotification('Excel sheet imported', `${file.name} is now the active donor source.`);
      onRecordAction?.({
        request: 'Imported donor sheet',
        status: 'accepted',
        msg: `Active Excel sheet replaced with ${file.name} (${parsedDonors.length} rows) by Manager.`,
      });
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
      const store = await deletePersistedSheet();
      setDonors(MOCK_DONORS);
      setSheetMeta(null);
      if (store && store.blockedFilters && setBlockedFilters) {
        setBlockedFilters(store.blockedFilters);
      }
      setSearch('');
      setFilterBG('all');
      setFilterStatus('all');
      setShowSheetPreview(false);
      setFileMessage({ type: 'success', text: `Removed active sheet ${deletedName}.` });
      await sendBrowserNotification('Excel sheet removed', `${deletedName} was removed from the active data source.`);
      onRecordAction?.({
        request: 'Deleted donor sheet',
        status: 'declined',
        msg: `Current active sheet ${deletedName} was cleared from backend storage by Manager.`,
      });
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
      const sender = managerSession ? { name: managerSession.name, email: managerSession.gmail } : (volunteerSession ? { name: volunteerSession.name, email: volunteerSession.email } : null);
      const result = await sendDonorWhatsAppAlert(targetDonor, null, null, null, null, null, sender);
      setDonors(currentDonors => currentDonors.map(donor => (donor.id === donorId ? { ...donor, notified: true } : donor)));
      if (setCooldowns) setCooldowns(current => ({ ...current, [donorId]: 20 }));
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

    const prefix = extractAdmissionPrefix(d.admission);
    const isBlocked = blockedFilters && (
      (blockedFilters.admissionPrefixes || []).includes(prefix) ||
      (blockedFilters.programmes || []).includes(extractBaseProgramme(d.programme))
    );

    if (filterStatus === 'all') {
      return matchSearch && matchBG;
    } else if (filterStatus === 'eligible') {
      const cooldownInfo = isDonorInWhatsAppCooldown(d.mobile, whatsappEvents);
      const isWSCooldown = cooldownInfo.hasSelectedMonth && cooldownInfo.inCooldown;
      return matchSearch && matchBG && d.eligible && !isWSCooldown && !isBlocked;
    } else if (filterStatus === 'cooldown') {
      const cooldownInfo = isDonorInWhatsAppCooldown(d.mobile, whatsappEvents);
      return matchSearch && matchBG && cooldownInfo.hasSelectedMonth && cooldownInfo.inCooldown && !isBlocked;
    } else if (filterStatus === 'blocked') {
      return matchSearch && matchBG && isBlocked;
    }
    return false;
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
          <option value="blocked">Blocked</option>
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
            {filtered.map(d => {
              const cooldownInfo = isDonorInWhatsAppCooldown(d.mobile, whatsappEvents);
              const isWSCooldown = cooldownInfo.hasSelectedMonth && cooldownInfo.inCooldown;
              const prefix = extractAdmissionPrefix(d.admission);
              const isBlocked = blockedFilters && (
                (blockedFilters.admissionPrefixes || []).includes(prefix) ||
                (blockedFilters.programmes || []).includes(extractBaseProgramme(d.programme))
              );
              const isEligible = d.eligible && !isWSCooldown && !isBlocked;
              return (
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
                  <td style={{ color: 'var(--text-2)', fontFamily: 'monospace', fontSize: '0.82rem' }}>{formatDisplayPhone(d.mobile)}</td>
                  <td style={{ color: 'var(--text-3)', fontSize: '0.82rem' }}>
                    {cooldownInfo.hasSelectedMonth ? (
                      cooldownInfo.calculatedLastDon
                    ) : (
                      d.lastDon || 'Not known'
                    )}
                  </td>
                  <td>
                    {isBlocked ? (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span className="eligible-badge blocked-badge">
                          🚫 Blocked
                        </span>
                        <div className="cooldown-info-icon-wrapper">
                          <span className="cooldown-info-icon">i</span>
                          <div className="cooldown-info-tooltip">
                            This programme/admission number is blocked by a manager.
                          </div>
                        </div>
                      </div>
                    ) : !isEligible ? (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span className="eligible-badge no" title={isWSCooldown && cooldownInfo.expiryDate ? `Cooldown expires on ${formatShortDate(cooldownInfo.expiryDate)}` : undefined}>
                          ✗ Cooldown
                        </span>
                        <div className="cooldown-info-icon-wrapper">
                          <span className="cooldown-info-icon">i</span>
                          <div className="cooldown-info-tooltip">
                            Donor becomes eligible after passing the 3-month window after their last donation.
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className={`eligible-badge ${d.lastDon ? 'yes' : 'warn'}`}>
                        {d.lastDon ? '✓ Eligible' : '⚠ Eligible'}
                      </span>
                    )}
                  </td>
                  <td>
                    {isBlocked ? (
                      <button className="action-btn notify" disabled style={{ opacity: 0.6, cursor: 'not-allowed' }}>
                        Ineligible
                      </button>
                    ) : cooldowns[d.id] > 0 ? (
                      <span className="action-btn notified" style={{ opacity: 0.8, cursor: 'not-allowed' }}>
                        ⏳ Notified ({cooldowns[d.id]}s)
                      </span>
                    ) : (
                      <button
                        className="action-btn notify"
                        onClick={() => onOpenOutreachModal ? onOpenOutreachModal(d) : notify(d.id)}
                        disabled={!isEligible}
                      >
                        {isEligible ? 'Send Alert' : 'Ineligible'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
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
                      <td>{formatDisplayPhone(donor.mobile)}</td>
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
