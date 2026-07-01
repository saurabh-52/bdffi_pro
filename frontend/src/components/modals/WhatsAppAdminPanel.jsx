import React, { useState, useEffect } from 'react';
import { formatDisplayPhone, formatISTDateTime } from '../../utils/helpers.js';

export default function WhatsAppAdminPanel({ open, onClose, requests = [] }) {
  const [status, setStatus] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [retryingId, setRetryingId] = useState(null);
  const [filter, setFilter] = useState('all');

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
    setRetryingId(id);
    try {
      const res = await fetch(`/api/admin/whatsapp/events/${id}/retry`, { method: 'POST' });
      const data = await res.json();
      await fetchEvents();
      await fetchStatus();
      alert(data.ok ? 'Retry succeeded' : `Retry failed: ${data.error || 'unknown'}`);
    } catch (err) {
      alert('Retry request failed: ' + err.message);
    } finally {
      setRetryingId(null);
    }
  }

  useEffect(() => { if (open) { fetchStatus(); fetchEvents(); } }, [open]);

  if (!open) return null;

  const sentCount = events.filter(e => e.status === 'sent' || e.status === 'delivered' || e.status === 'read').length;
  const failedCount = events.filter(e => e.status === 'failed').length;
  const acceptedCount = events.filter(e => e.status === 'accepted').length;
  const pendingCount = events.filter(e => e.status === 'pending').length;

  const filteredEvents = filter === 'all' ? events : events.filter(e => {
    if (filter === 'failed') return e.status === 'failed';
    if (filter === 'sent') return e.status === 'sent' || e.status === 'delivered' || e.status === 'read';
    if (filter === 'accepted') return e.status === 'accepted';
    if (filter === 'pending') return e.status === 'pending';
    return true;
  });

  const getEventStatusColor = (s) => {
    if (s === 'accepted') return 'fulfilled';
    if (s === 'failed' || s === 'declined') return 'declined';
    if (s === 'sent' || s === 'delivered' || s === 'read') return 'active';
    return 'pending';
  };

  return (
    <div className="sheet-modal-backdrop" onClick={onClose}>
      <div className="wa-admin-modal card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="wa-admin-header">
          <div className="wa-admin-header-left">
            <div className="wa-admin-logo">📲</div>
            <div>
              <h3>WhatsApp Admin Console</h3>
              <p>Monitor outreach health, retry failed messages, and review event history</p>
            </div>
          </div>
          <div className="wa-admin-header-actions">
            <button className="hero-action-btn" onClick={() => { fetchStatus(); fetchEvents(); }} disabled={loading}>
              {loading ? '⏳' : '🔄'} Refresh
            </button>
            <button className="hero-action-btn" onClick={onClose}>✕ Close</button>
          </div>
        </div>

        {/* Status Overview Cards */}
        <div className="wa-admin-stats">
          <div className="wa-stat-card">
            <div className="wa-stat-indicator">
              <div className={`health-dot ${status?.hasConfig ? 'healthy' : 'error'}`} />
            </div>
            <div className="wa-stat-info">
              <div className="wa-stat-value">{status?.hasConfig ? 'Connected' : 'Missing Config'}</div>
              <div className="wa-stat-label">API Status</div>
            </div>
          </div>
          <div className="wa-stat-card">
            <div className="wa-stat-indicator">
              <span style={{ fontSize: '1.1rem' }}>📄</span>
            </div>
            <div className="wa-stat-info">
              <div className="wa-stat-value">{status?.templateName || 'hello_world'}</div>
              <div className="wa-stat-label">Active Template</div>
            </div>
          </div>
          <div className="wa-stat-card">
            <div className="wa-stat-indicator">
              <span style={{ fontSize: '1.1rem' }}>📤</span>
            </div>
            <div className="wa-stat-info">
              <div className="wa-stat-value">{sentCount}</div>
              <div className="wa-stat-label">Messages Sent</div>
            </div>
          </div>
          <div className="wa-stat-card">
            <div className="wa-stat-indicator">
              <div className={`health-dot ${(status?.failed || 0) === 0 ? 'healthy' : 'error'}`} />
            </div>
            <div className="wa-stat-info">
              <div className="wa-stat-value" style={{ color: failedCount > 0 ? 'var(--red)' : 'inherit' }}>{status?.failed || 0}</div>
              <div className="wa-stat-label">Failed Events</div>
            </div>
          </div>
        </div>

        {/* Missing Config Warning */}
        {status && !status.hasConfig && status.missing && status.missing.length > 0 && (
          <div className="wa-admin-warning">
            <strong>⚠️ Missing Configuration:</strong> {status.missing.join(', ')}
          </div>
        )}

        {/* Event Filter & Table */}
        <div className="wa-admin-events-section">
          <div className="wa-events-toolbar">
            <h4>Event History</h4>
            <div className="wa-filter-pills">
              <button className={`wa-filter-pill ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
                All ({events.length})
              </button>
              <button className={`wa-filter-pill ${filter === 'sent' ? 'active' : ''}`} onClick={() => setFilter('sent')}>
                Sent ({sentCount})
              </button>
              <button className={`wa-filter-pill ${filter === 'accepted' ? 'active' : ''}`} onClick={() => setFilter('accepted')}>
                Accepted ({acceptedCount})
              </button>
              <button className={`wa-filter-pill ${filter === 'failed' ? 'active' : ''}`} onClick={() => setFilter('failed')}>
                Failed ({failedCount})
              </button>
              <button className={`wa-filter-pill ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>
                Pending ({pendingCount})
              </button>
            </div>
          </div>

          <div className="wa-events-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>Status</th>
                  <th>Message ID</th>
                  <th>Attempts</th>
                  <th>Reply</th>
                  <th>Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map(ev => (
                  <tr key={ev.id}>
                    <td>
                      <div className="wa-recipient">
                        <strong>
                          {ev.student_name || 'Unknown'}{' '}
                          {ev.request_id && requests.find(r => r.id === ev.request_id)
                            ? `[#${requests.find(r => r.id === ev.request_id).caseNumber}]`
                            : ''}
                        </strong>
                        <span className="wa-phone">{formatDisplayPhone(ev.student_phone)}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`status-pill ${getEventStatusColor(ev.status)}`}>
                        {ev.status}
                      </span>
                    </td>
                    <td>
                      <span className="wa-msg-id">{ev.message_id ? ev.message_id.slice(0, 16) + '…' : '—'}</span>
                    </td>
                    <td>
                      <span className="wa-attempt-badge">{ev.attempt_count}</span>
                    </td>
                    <td>
                      {ev.response ? (
                        <span style={{ color: 'var(--green)', fontWeight: 600, fontSize: '0.82rem' }}>{ev.response}</span>
                      ) : (
                        <span style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>
                          {ev.status === 'failed' ? (ev.last_error ? ev.last_error.slice(0, 30) + '…' : 'Error') : '—'}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="wa-event-time">{formatISTDateTime(ev.created_at)}</span>
                    </td>
                    <td>
                      {ev.student_phone ? (
                        <button
                          className={`action-btn ${ev.status === 'failed' ? 'notify' : ''}`}
                          onClick={() => retryEvent(ev.id)}
                          disabled={retryingId === ev.id}
                        >
                          {retryingId === ev.id ? '⏳' : ev.status === 'failed' ? '🔄 Retry' : '↻ Resend'}
                        </button>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
                {filteredEvents.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <div className="manager-empty-state">
                        <span className="manager-empty-state-icon">📭</span>
                        {filter === 'all' ? 'No WhatsApp events recorded yet.' : `No ${filter} events found.`}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
