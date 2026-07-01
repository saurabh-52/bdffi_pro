import React, { useState, useEffect } from 'react';
import {
  readManagerAccounts,
  deactivateManagerAccount,
  demoteManagerAccount,
  updateGlobalWhatsAppAlerts
} from '../../utils/api.js';

export default function ManagerDashboardView({
  managerSession,
  onLogout,
  onAddManager,
  onAddVolunteer,
  onUpdateSession,
  onRecordAction,
  onRefreshLogs,
  onSeeAllActivity,
  whatsappAlertsEnabled,
  onToggleWhatsAppAlerts,
  donors = [],
  volunteers = [],
  whatsappEvents = [],
  onOpenWhatsAppAdmin,
  onManageDonors,
  onOpenBlockFilters,
  onOpenVolunteers,
  managers,
  setManagers
}) {
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

  const handleDemote = async manager => {
    const confirmed = window.confirm(`Remove ${manager.name} (${manager.gmail}) from Managers? They will be demoted back to a Volunteer.`);
    if (!confirmed) {
      return;
    }

    setActionLoadingId(manager.id);
    setError('');

    try {
      await demoteManagerAccount(manager.id);
      setManagers(current => current.filter(item => item.id !== manager.id));

      onRecordAction?.({
        request: 'Demoted Manager',
        status: 'declined',
        msg: `Manager ${manager.name} (${manager.gmail}) was demoted back to a Volunteer by Manager ${managerSession?.name} (${managerSession?.gmail}).`,
      });
    } catch (demoteError) {
      setError(demoteError instanceof Error ? demoteError.message : 'Failed to demote manager account.');
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
        msg: `Manager ${managerSession?.name || updatedManager.name || 'Manager'} (${managerSession?.gmail || ''}) turned ${updatedManager.whatsapp_alerts_enabled ? 'on' : 'off'} WhatsApp alerts for all users.`,
      });
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Failed to update WhatsApp alerts setting.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Derived data for stats
  const totalDonors = donors.length;
  const eligibleDonors = donors.filter(d => d.eligible).length;
  const totalEvents = whatsappEvents.length;
  const sentEvents = whatsappEvents.filter(e => e.status === 'sent' || e.status === 'delivered' || e.status === 'read').length;
  const failedEvents = whatsappEvents.filter(e => e.status === 'failed').length;
  const recentEvents = whatsappEvents.slice(0, 6);

  // Manager initials for avatar
  const managerInitials = (managerSession?.name || 'M')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Greeting based on time of day
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="manager-page animate-in">
      {/* ── Glassmorphism Hero ── */}
      <div className="manager-hero-glass">
        <div className="manager-hero-top">
          <div className="manager-hero-greeting">
            <div className="manager-badge">Manager Dashboard</div>
            <h2>{greeting}, {managerSession?.name?.split(' ')[0] || 'Manager'} 👋</h2>
            <p>Manage accounts, monitor WhatsApp outreach, and oversee your donor network from one place.</p>
          </div>
          <div className="manager-hero-controls">
            <div className={`alert-status-chip ${whatsappAlertsEnabled ? 'alert-active' : 'alert-paused'}`}>
              <span className="alert-chip-icon">{whatsappAlertsEnabled ? '✅' : '⏸️'}</span>
              <div className="alert-chip-text">
                <span className="alert-chip-title">{whatsappAlertsEnabled ? 'Active' : 'Paused'}</span>
                <span className="alert-chip-label">Alerts</span>
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
              </div>
            </div>
          </div>
        </div>
        <div className="manager-hero-session">
          <div className="manager-hero-session-info">
            <div className="manager-avatar">{managerInitials}</div>
            <div className="manager-avatar-details">
              <span className="manager-avatar-name">{managerSession?.name || 'Manager'}</span>
              <span className="manager-avatar-email">{managerSession?.gmail || 'No session'}</span>
            </div>
          </div>
          <div className="manager-hero-actions">
            <div className="session-status-badge">
              <div className="status-dot" />
              Session Active
            </div>
          </div>
        </div>
      </div>

      {/* ── System Overview Stats ── */}
      <div className="manager-overview-stats">
        <div className="manager-stat-card accent-red stagger-1">
          <div className="manager-stat-icon">👥</div>
          <div className="manager-stat-value">{activeManagers.length}</div>
          <div className="manager-stat-label">Active Managers</div>
          <div className="manager-stat-sub neutral">{managers.length} total</div>
        </div>
        <div className="manager-stat-card accent-amber stagger-1">
          <div className="manager-stat-icon">👤</div>
          <div className="manager-stat-value">{volunteers.length}</div>
          <div className="manager-stat-label">Active Volunteers</div>
          <div className="manager-stat-sub neutral">{volunteers.length} total</div>
          <button
            type="button"
            className="manager-stat-action-btn"
            onClick={onOpenVolunteers}
          >
            Manage Volunteers ↗
          </button>
        </div>
        <div className="manager-stat-card accent-green stagger-2">
          <div className="manager-stat-icon">🩸</div>
          <div className="manager-stat-value">{totalDonors}</div>
          <div className="manager-stat-label">Registered Donors</div>
          <div className="manager-stat-sub positive">{eligibleDonors} eligible</div>
          <button
            type="button"
            className="manager-stat-action-btn"
            onClick={onOpenBlockFilters}
          >
            Manage Donors ↗
          </button>
        </div>
        <div
          className="manager-stat-card accent-blue stagger-3"
        >
          <div className="manager-stat-icon">📲</div>
          <div className="manager-stat-value">{totalEvents}</div>
          <div className="manager-stat-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            WhatsApp Events
          </div>
          <div className={`manager-stat-sub ${failedEvents > 0 ? 'warning' : 'positive'}`}>
            {sentEvents} sent{failedEvents > 0 ? ` · ${failedEvents} failed` : ''}
          </div>
          <button
            type="button"
            className="manager-stat-action-btn"
            onClick={onOpenWhatsAppAdmin}
          >
            Show All ↗
          </button>
        </div>
      </div>

      {error && <div className="manager-error">{error}</div>}

      {/* ── Two-Column Content ── */}
      <div className="manager-two-col-grid">
        {/* Left Column: Account Management */}
        <div className="section-gap">
          {/* Active Accounts */}
          <div className="manager-card card">
            <div className="card-header">
              <div>
                <h3>Active Manager Accounts</h3>
                <p>{loading ? 'Loading accounts…' : `${activeManagers.length} active account${activeManagers.length === 1 ? '' : 's'}`}</p>
              </div>
              <button type="button" className="btn btn-primary manager-card-action" onClick={onAddManager}>
                ➕ Add Manager
              </button>
            </div>

            <div className="manager-account-list" style={{ maxHeight: '580px', overflowY: 'auto', paddingRight: '0.25rem' }}>
              {activeManagers.map(manager => (
                <div key={manager.id || manager.gmail} className="manager-account-item">
                  <div>
                    <strong>{manager.name}</strong>
                    <span>{manager.gmail}</span>
                  </div>
                  <div className="manager-account-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {!manager.is_primary && managerSession?.is_primary && (
                      <button
                        type="button"
                        className="manager-deactivate-btn"
                        disabled={actionLoadingId === manager.id}
                        onClick={() => handleDemote(manager)}
                        style={{
                          padding: '0.25rem 0.55rem',
                          fontSize: '0.72rem',
                          background: 'var(--red-soft)',
                          color: 'var(--red)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: 600,
                          transition: 'all 0.2s',
                          marginRight: '0.25rem',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--red)'; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--red-soft)'; e.currentTarget.style.color = 'var(--red)'; }}
                      >
                        {actionLoadingId === manager.id ? '…' : 'Demote'}
                      </button>
                    )}
                    <div className={`manager-account-badge ${manager.is_primary ? 'primary' : ''}`}>
                      {manager.is_primary ? 'Primary' : 'Manager'}
                    </div>
                  </div>
                </div>
              ))}
              {!loading && activeManagers.length === 0 && (
                <div className="manager-empty-state">
                  <span className="manager-empty-state-icon">👤</span>
                  No manager accounts found yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Activity + Health */}
        <div className="section-gap">
          {/* Active Volunteers List */}
          <div className="manager-card card">
            <div className="card-header">
              <div>
                <h3>Active Volunteers</h3>
                <p>{loading ? 'Loading volunteers…' : `${volunteers.length} volunteer${volunteers.length === 1 ? '' : 's'} registered`}</p>
              </div>
              <button
                type="button"
                className="btn btn-primary manager-card-action"
                onClick={onAddVolunteer}
              >
                ➕ Add Volunteer
              </button>
            </div>

            <div className="manager-activity-mini" style={{ maxHeight: '580px', overflowY: 'auto' }}>
              {volunteers.length > 0 ? volunteers.map(v => {
                const isManager = managers.some(m => m.gmail.toLowerCase() === v.email.toLowerCase() && (m.is_primary || m.is_active));
                return (
                  <div key={v.id || v.email} className="manager-activity-item" style={{ padding: '0.65rem 0.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                      <div className="manager-activity-dot green" style={{ marginTop: 0 }} />
                      <div className="manager-activity-content" style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        <strong style={{ fontSize: '0.88rem' }}>{v.name}</strong>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-3)' }}>{v.email}</span>
                      </div>
                    </div>
                    {isManager && (
                      <span
                        className="manager-account-badge"
                        style={{
                          padding: '0.18rem 0.5rem',
                          fontSize: '0.68rem',
                          fontWeight: 600,
                          background: 'var(--amber-soft)',
                          color: 'var(--amber)',
                          borderRadius: '4px',
                          border: '1px solid rgba(217, 119, 6, 0.2)',
                          whiteSpace: 'nowrap',
                          marginRight: '0.25rem',
                        }}
                      >
                        Manager
                      </span>
                    )}
                  </div>
                );
              }) : (
                <div className="manager-empty-state">
                  <span className="manager-empty-state-icon">👤</span>
                  No active volunteers found.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
