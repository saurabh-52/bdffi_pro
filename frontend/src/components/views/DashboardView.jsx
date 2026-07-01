import React from 'react';
import RequestItem from '../RequestItem.jsx';
import { BLOOD_GROUPS } from '../../utils/constants.js';
import { getBloodCounts, formatDisplayPhone, formatISTDateTime } from '../../utils/helpers.js';

export default function DashboardView({
  donors,
  requests,
  onSeeAllNotifications,
  onSeeAllRequests,
  onOpenDetailsModal,
  whatsappEvents = [],
  volunteerSession,
  managers = []
}) {
  const eligibleCount = donors.filter(donor => donor.eligible).length;
  const bloodCounts = getBloodCounts(donors);
  const recentBloodNotifications = whatsappEvents.slice(0, 5);
  const recentRequests = requests.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

  const userManager = managers.find(m => m.gmail.toLowerCase() === volunteerSession?.email?.toLowerCase());
  const roles = ['Volunteer'];
  if (userManager) {
    if (userManager.is_primary) {
      roles.push('Primary Manager');
    } else if (userManager.is_active) {
      roles.push('Manager');
    }
  }

  return (
    <div className="section-gap">
      {/* Current Session Big Long Card */}
      <div className="manager-hero-glass animate-in" style={{ padding: '1.25rem 1.5rem', display: 'block', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)',
              overflow: 'hidden',
              border: '2px solid var(--red)'
            }}>
              <img
                src="https://res.cloudinary.com/dvjschjlg/image/upload/v1722862190/FFI/Logo/gpq3l0srvnvyyjzeg8k5.png"
                alt="FFI Logo"
                style={{ width: '80%', height: '80%', objectFit: 'contain' }}
              />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
              </div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-1)' }}>{volunteerSession?.name || 'Operator'}</h3>
              <p style={{ margin: '0.1rem 0 0', fontSize: '0.8rem', color: 'var(--text-3)' }}>{"Current Session : " + (volunteerSession?.email || '')}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-3)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assigned Role</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', alignItems: 'flex-end', marginTop: '0.15rem' }}>
                {roles.map(r => (
                  <span key={r} style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-1)' }}>
                    {r}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
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
                  <button type="button" className="show-all-btn" onClick={onSeeAllRequests}>
                    Show All ↗
                  </button>
                </div>
              </div>
            </div>
            <div className="request-list">
              {recentRequests.map(r => (
                <RequestItem key={r.id} request={r} onOpenDetailsModal={onOpenDetailsModal} />
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
        <div className="card" style={{ padding: '1.25rem', alignSelf: 'start', display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <div><h3>Live Activity</h3><p>Latest blood donation notifications</p></div>
            <button type="button" className="show-all-btn" onClick={onSeeAllNotifications}>
              Show All ↗
            </button>
          </div>
          <div className="activity-feed" style={{ maxHeight: '600px', overflowY: 'auto', paddingRight: '0.25rem' }}>
            {recentBloodNotifications.map(e => {
              const caseObj = e.request_id && requests.find(r => r.id === e.request_id);
              return (
                <div
                  key={e.id}
                  className="activity-item"
                  onClick={() => caseObj && onOpenDetailsModal(caseObj)}
                  style={{
                    cursor: caseObj ? 'pointer' : 'default',
                    transition: 'background-color 0.2s',
                    padding: '0.8rem 0.5rem',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                  }}
                  onMouseEnter={e => {
                    if (caseObj) e.currentTarget.style.backgroundColor = 'var(--bg-3)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = '';
                  }}
                >
                  <div className={`activity-dot ${e.status === 'accepted' ? 'green' : e.status === 'declined' || e.status === 'failed' ? 'red' : 'amber'}`} style={{ marginTop: '4px' }} />
                  <div className="activity-text" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.86rem' }}>
                        {e.student_name || 'Donor'} ({formatDisplayPhone(e.student_phone)}) {caseObj ? `[#${caseObj.caseNumber}]` : ''}
                      </strong>
                      {caseObj && (
                        <span style={{ fontStyle: 'italic', fontSize: '0.82rem', color: 'var(--blue)', fontWeight: 600 }}>
                          Tap to view case
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-2)', display: 'block' }}>
                      {e.response ? `Reply: ${e.response}` : (e.status === 'failed' ? `Failed: ${e.last_error || 'Unknown error'}` : 'Awaiting reply…')}
                    </span>
                    <time className="activity-time">{formatISTDateTime(e.created_at)}</time>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
