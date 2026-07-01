import React, { useState } from 'react';
import StatCard from '../StatCard.jsx';
import RequestItem from '../RequestItem.jsx';
import { getRequestPeriod, formatDisplayPhone, formatISTDateTime } from '../../utils/helpers.js';

export default function RecentRequestsView({ requests, onOpenDetailsModal, whatsappEvents = [] }) {
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

  const sentEvents = whatsappEvents.filter(e => e.status === 'sent' || e.status === 'delivered' || e.status === 'read');
  const acceptedEvents = whatsappEvents.filter(e => e.status === 'accepted');
  const declinedEvents = whatsappEvents.filter(e => e.status === 'declined' || e.status === 'failed');
  const pendingEvents = whatsappEvents.filter(e => e.status === 'pending');

  return (
    <div className="section-gap animate-in">
      <div style={{ marginBottom: '0.75rem' }}>
        <div className="stats-row" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
          <StatCard value={String(sentEvents.length)} label="Sent" icon="📤" color="blue" onSeeMore={() => setDetailsList(sentEvents)} />
          <StatCard value={String(acceptedEvents.length)} label="Accepted" icon="✅" color="green" onSeeMore={() => setDetailsList(acceptedEvents)} />
          <StatCard value={String(declinedEvents.length)} label="Declined" icon="❌" color="red" onSeeMore={() => setDetailsList(declinedEvents)} />
          <StatCard value={String(pendingEvents.length)} label="Awaiting" icon="⏳" color="amber" onSeeMore={() => setDetailsList(pendingEvents)} />
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
                  detailsList.map(e => (
                    <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px dashed var(--border)' }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{e.student_name || 'Donor'} ({formatDisplayPhone(e.student_phone)})</div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-3)' }}>
                          {e.response ? `Reply: ${e.response}` : (e.status === 'failed' ? `Error: ${e.last_error || 'unknown'}` : 'Awaiting response…')}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                          <span className={`status-pill ${e.status === 'accepted' ? 'fulfilled' : e.status === 'declined' || e.status === 'failed' ? 'declined' : 'active'}`}>
                            {e.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginTop: '0.2rem' }}>{formatISTDateTime(e.created_at)}</div>
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
            <RequestItem key={request.id} request={request} onOpenDetailsModal={onOpenDetailsModal} />
          ))}
        </div>
      </div>
    </div>
  );
}
