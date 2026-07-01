import React, { useState } from 'react';
import { getEventSender, formatDisplayPhone, formatISTDateTime } from '../../utils/helpers.js';

export default function LogsView({ managerLogs, whatsappEvents = [], onRefresh, requests = [], onOpenDetailsModal }) {
  const iconMap = { sent: '📤', accepted: '✅', declined: '❌', pending: '⏳', failed: '❌' };
  const [logType, setLogType] = useState('blood');

  return (
    <div className="logs-page animate-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
        <h2 style={{ margin: 0 }}>Notification Log</h2>
        <button type="button" className="topbar-btn" onClick={onRefresh}>
          🔄 Refresh
        </button>
      </div>
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
          className={`log-toggle-btn ${logType === 'manager' ? 'active' : ''}`}
          onClick={() => setLogType('manager')}
        >
          Admin Action
        </button>
      </div>

      <div className="card">
        <div className="log-list">
          {logType === 'blood' ? (
            whatsappEvents.map(e => {
              const sender = getEventSender(e) || { name: 'Volunteer', email: 'volunteer@fastforwardindia.org' };
              const caseObj = e.request_id && requests.find(r => r.id === e.request_id);
              const caseNumText = caseObj ? `#${caseObj.caseNumber}` : 'General';

              let actionText = '';
              if (e.status === 'accepted') {
                actionText = `Received outreach confirmation from ${e.student_name || 'Donor'} (${formatDisplayPhone(e.student_phone)})`;
              } else if (e.status === 'declined') {
                actionText = `Outreach declined by ${e.student_name || 'Donor'} (${formatDisplayPhone(e.student_phone)})`;
              } else if (e.status === 'failed') {
                actionText = `Outreach failed for ${e.student_name || 'Donor'} (${formatDisplayPhone(e.student_phone)})`;
              } else {
                actionText = `Sent WhatsApp alert to ${e.student_name || 'Donor'} (${formatDisplayPhone(e.student_phone)})`;
              }

              return (
                <div
                  key={e.id}
                  className="log-row"
                  onClick={() => caseObj && onOpenDetailsModal?.(caseObj)}
                  style={{
                    cursor: caseObj ? 'pointer' : 'default',
                    transition: 'background-color 0.2s',
                    padding: '0.75rem 0.5rem',
                    borderRadius: '6px',
                  }}
                  onMouseEnter={e => {
                    if (caseObj) e.currentTarget.style.backgroundColor = 'var(--bg-3)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = '';
                  }}
                >
                  <div className={`log-icon ${e.status === 'accepted' ? 'accepted' : e.status === 'declined' || e.status === 'failed' ? 'declined' : 'sent'}`}>
                    {iconMap[e.status === 'accepted' ? 'accepted' : e.status === 'declined' || e.status === 'failed' ? 'declined' : 'sent'] || '📲'}
                  </div>
                  <div className="log-info" style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <strong>
                        Case {caseNumText} — {sender.name} ({sender.email})
                      </strong>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{actionText}</span>
                    </div>
                    {caseObj && (
                      <span style={{ fontStyle: 'italic', fontSize: '0.82rem', color: 'var(--blue)', fontWeight: 600, marginLeft: '1rem', whiteSpace: 'nowrap' }}>
                        Tap to view case
                      </span>
                    )}
                  </div>
                  <span className="log-time" style={{ marginLeft: '1rem' }}>{formatISTDateTime(e.created_at)}</span>
                </div>
              );
            })
          ) : (
            managerLogs.map(l => (
              <div key={l.id} className="log-row">
                <div className="log-icon" style={{ background: 'var(--blue-soft)' }}>🔔</div>
                <div className="log-info">
                  <strong>{l.donor}</strong>
                  <span>{l.request} — {l.msg}</span>
                </div>
                <span className="log-time">{l.time}</span>
              </div>
            ))
          )}
          {logType === 'blood' && whatsappEvents.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-3)' }}>No blood outreach events found in database.</div>
          )}
          {logType === 'manager' && managerLogs.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-3)' }}>No admin action records found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
