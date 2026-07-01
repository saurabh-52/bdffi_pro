import React from 'react';
import {
  isDonorInWhatsAppCooldown,
  extractAdmissionPrefix,
  extractBaseProgramme,
  formatISTDateTime,
  formatDisplayPhone
} from '../../utils/helpers.js';

export default function RequestDetailsModal({
  open,
  onClose,
  request,
  donors = [],
  cooldowns = {},
  whatsappEvents = [],
  onOpenOutreachModal,
  blockedFilters = { admissionPrefixes: [], programmes: [] }
}) {
  if (!open || !request) return null;

  const requestEvents = whatsappEvents.filter(e => Number(e.request_id) === Number(request.id));
  const eligibleDonors = donors.filter(d => {
    if (d.blood !== request.blood) return false;
    if (!d.eligible) return false;

    // Cooldown check (similar to DonorsView table check)
    const cooldownInfo = isDonorInWhatsAppCooldown(d.mobile, whatsappEvents);
    const isWSCooldown = cooldownInfo.hasSelectedMonth && cooldownInfo.inCooldown;
    if (isWSCooldown) return false;

    // Blocked check
    const prefix = extractAdmissionPrefix(d.admission);
    const isBlocked = blockedFilters && (
      (blockedFilters.admissionPrefixes || []).includes(prefix) ||
      (blockedFilters.programmes || []).includes(extractBaseProgramme(d.programme))
    );
    if (isBlocked) return false;

    return true;
  });
  const acceptedCount = requestEvents.filter(e => e.status === 'accepted').length;
  const declinedCount = requestEvents.filter(e => e.status === 'declined' || e.status === 'failed').length;
  const pendingCount = requestEvents.filter(e => e.status !== 'accepted' && e.status !== 'declined' && e.status !== 'failed').length;

  return (
    <div className="rdm-backdrop" onClick={onClose}>
      <div className="rdm-container animate-in" onClick={e => e.stopPropagation()}>

        {/* ── Hero Header ── */}
        <div className="rdm-header">
          <div className="rdm-header-left">
            <div className="rdm-blood-badge">{request.blood}</div>
            <div className="rdm-header-text">
              <h3 className="rdm-title">Case #{request.caseNumber}</h3>
              <p className="rdm-subtitle">{request.patient} · {request.hospital}</p>
            </div>
          </div>
          <div className="rdm-header-actions">
            {request.requisitionForm ? (
              <a
                href={request.requisitionForm.url || '#'}
                target="_blank"
                rel="noreferrer"
                className="rdm-req-link"
              >
                📄 View Requisition Form
              </a>
            ) : (
              <span className="rdm-req-unavailable">
                📄 Requisition form not available
              </span>
            )}
          </div>
          <button className="rdm-close-btn" onClick={onClose} title="Close">
            <span>✕</span>
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="rdm-body">

          {/* ── Quick Stats Strip ── */}
          <div className="rdm-stats-strip">
            <div className="rdm-stat">
              <span className="rdm-stat-value">{request.donors}</span>
              <span className="rdm-stat-label">Units Needed</span>
            </div>
            <div className="rdm-stat-divider" />
            <div className="rdm-stat">
              <span className="rdm-stat-value">{requestEvents.length}</span>
              <span className="rdm-stat-label">Notified</span>
            </div>
            <div className="rdm-stat-divider" />
            <div className="rdm-stat">
              <span className="rdm-stat-value rdm-stat-green">{acceptedCount}</span>
              <span className="rdm-stat-label">Accepted</span>
            </div>
            <div className="rdm-stat-divider" />
            <div className="rdm-stat">
              <span className="rdm-stat-value rdm-stat-red">{declinedCount}</span>
              <span className="rdm-stat-label">Declined</span>
            </div>
            {pendingCount > 0 && <>
              <div className="rdm-stat-divider" />
              <div className="rdm-stat">
                <span className="rdm-stat-value rdm-stat-amber">{pendingCount}</span>
                <span className="rdm-stat-label">Pending</span>
              </div>
            </>}
          </div>

          <div className="rdm-grid">
            <div className="rdm-left-panel">
              {/* ── Specifications ── */}
              <div className="rdm-section">
                <div className="rdm-section-header">
                  <span className="rdm-section-icon">📋</span>
                  <span className="rdm-section-title">Specifications</span>
                </div>
                <div className="rdm-spec-grid">
                  <div className="rdm-spec-item">
                    <span className="rdm-spec-label">Patient</span>
                    <span className="rdm-spec-value">{request.patient}</span>
                  </div>
                  <div className="rdm-spec-item">
                    <span className="rdm-spec-label">Hospital</span>
                    <span className="rdm-spec-value">{request.hospital}</span>
                  </div>
                  <div className="rdm-spec-item">
                    <span className="rdm-spec-label">Blood Group</span>
                    <span className="rdm-spec-value rdm-blood-text">{request.blood}</span>
                  </div>
                  <div className="rdm-spec-item">
                    <span className="rdm-spec-label">Contact</span>
                    <span className="rdm-spec-value">{request.contact || '—'}</span>
                  </div>
                  <div className="rdm-spec-item">
                    <span className="rdm-spec-label">Units Needed</span>
                    <span className="rdm-spec-value">{request.donors}</span>
                  </div>
                  <div className="rdm-spec-item">
                    <span className="rdm-spec-label">Submitted</span>
                    <span className="rdm-spec-value">{formatISTDateTime(request.createdAt) || request.time}</span>
                  </div>
                </div>
              </div>

              {/* ── Eligible Donors (Horizontal) ── */}
              <div className="rdm-section" style={{ marginTop: '1.25rem' }}>
                <div className="rdm-section-header">
                  <span className="rdm-section-icon">🩸</span>
                  <span className="rdm-section-title">Top Eligible Donors</span>
                </div>
                {eligibleDonors.length === 0 ? (
                  <div className="rdm-empty">
                    <span className="rdm-empty-icon">🔍</span>
                    <span>No eligible donors found in the database for {request.blood}.</span>
                  </div>
                ) : (
                  <div className="rdm-donor-chips-horizontal">
                    {eligibleDonors.slice(0, 4).map(d => (
                      <div key={d.id} className="rdm-donor-chip-horizontal">
                        <div className="rdm-donor-avatar">{d.blood}</div>
                        <div className="rdm-donor-chip-info">
                          <span className="rdm-donor-chip-name">{d.name}</span>
                          <span className="rdm-donor-chip-prog">{d.programme || 'Student'}</span>
                        </div>
                        {cooldowns[d.id] > 0 ? (
                          <span className="rdm-cooldown-badge">⏳ {cooldowns[d.id]}s</span>
                        ) : (
                          <button
                            type="button"
                            className="rdm-notify-btn"
                            onClick={() => { onOpenOutreachModal?.(d, request); onClose(); }}
                          >
                            Notify
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rdm-right-panel">
              {/* ── Outreach Activity ── */}
              <div className="rdm-section">
                <div className="rdm-section-header">
                  <span className="rdm-section-icon">📲</span>
                  <span className="rdm-section-title">Outreach Activity</span>
                  <span className="rdm-section-count">{requestEvents.length}</span>
                </div>
                {requestEvents.length === 0 ? (
                  <div className="rdm-empty">
                    <span className="rdm-empty-icon">📭</span>
                    <span>No notifications sent for this case yet.</span>
                  </div>
                ) : (
                  <div className="rdm-activity-list" style={{ maxHeight: '420px' }}>
                    {requestEvents.map(e => {
                      const statusClass = e.status === 'accepted' ? 'green' : (e.status === 'declined' || e.status === 'failed') ? 'red' : (e.status === 'sent' || e.status === 'delivered') ? 'blue' : 'amber';
                      return (
                        <div key={e.id} className="rdm-activity-item">
                          <div className={`rdm-activity-dot ${statusClass}`} />
                          <div className="rdm-activity-info">
                            <div className="rdm-activity-name">{e.student_name || 'Donor'}</div>
                            <div className="rdm-activity-phone">{formatDisplayPhone(e.student_phone)}</div>
                            {e.response ? (
                              <div className="rdm-activity-reply">
                                <span className="rdm-reply-icon">💬</span> {e.response}
                              </div>
                            ) : e.status === 'failed' ? (
                              <div className="rdm-activity-error">⚠ {e.last_error || 'Unknown error'}</div>
                            ) : (
                              <div className="rdm-activity-waiting">Awaiting reply…</div>
                            )}
                          </div>
                          <div className="rdm-activity-meta">
                            <span className={`status-pill ${e.status === 'accepted' ? 'fulfilled' : e.status === 'declined' || e.status === 'failed' ? 'declined' : 'active'}`}>
                              {e.status}
                            </span>
                            <span className="rdm-activity-time">{formatISTDateTime(e.created_at)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
