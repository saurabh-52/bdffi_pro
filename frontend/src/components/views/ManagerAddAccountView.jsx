import React, { useState, useEffect } from 'react';
import { readVolunteerAccounts, readManagerAccounts, createManagerAccount } from '../../utils/api.js';

export default function ManagerAddAccountView({ managerSession, onLogout, onBackToDashboard, onRecordAction }) {
  const [volunteers, setVolunteers] = useState([]);
  const [managers, setManagers] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState('');
  const [loadingInit, setLoadingInit] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reloadTrigger, setReloadTrigger] = useState(0);

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      setLoadingInit(true);
      setError('');
      try {
        const [vList, mList] = await Promise.all([
          readVolunteerAccounts(),
          readManagerAccounts()
        ]);
        if (!active) return;
        setVolunteers(Array.isArray(vList) ? vList : []);
        setManagers(Array.isArray(mList) ? mList : []);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load volunteer or manager accounts.');
        }
      } finally {
        if (active) setLoadingInit(false);
      }
    };
    fetchData();
    return () => { active = false; };
  }, [reloadTrigger]);

  const candidates = volunteers.filter(v =>
    !managers.some(m => m.gmail.toLowerCase() === v.email.toLowerCase() && (m.is_primary || m.is_active))
  );

  const handleSubmit = async event => {
    event.preventDefault();
    if (!selectedEmail) {
      setError('Please select a volunteer to promote.');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await createManagerAccount({ gmail: selectedEmail });
      const selectedVol = volunteers.find(v => v.email === selectedEmail);
      const volName = selectedVol ? selectedVol.name : 'Unknown';

      onRecordAction?.({
        request: 'Promoted Volunteer to Manager',
        status: 'accepted',
        msg: `Volunteer ${volName} (${selectedEmail}) was promoted to Manager by Manager ${managerSession?.name || 'Manager'} (${managerSession?.gmail || ''}).`,
      });

      setMessage(response.message || `Successfully promoted ${selectedEmail} to Manager.`);
      setSelectedEmail('');
      setReloadTrigger(prev => prev + 1);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to promote volunteer to manager.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="manager-page animate-in">
      <div className="manager-hero">
        <div className="manager-badge">Promote Volunteer</div>
        <h2>Promote Volunteer to Manager</h2>
        <p>Grant manager permissions to an existing volunteer. They will use their existing credentials to login.</p>
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
            <h3>Promotion Console</h3>
            <p>Select an existing volunteer from the dropdown to promote them to Manager</p>
          </div>
          <button type="button" className="action-btn" onClick={onBackToDashboard}>Back to dashboard</button>
        </div>

        <div className="manager-form-grid">
          {loadingInit ? (
            <div className="manager-info">⏳ Loading accounts and volunteers list...</div>
          ) : candidates.length === 0 ? (
            <div className="manager-info">
              ⚠️ No volunteers available for promotion. Either all volunteers are already managers or no volunteer accounts have been created yet.
            </div>
          ) : (
            <div className="field">
              <label htmlFor="promoteVolunteerSelect">Select Volunteer</label>
              <select
                id="promoteVolunteerSelect"
                value={selectedEmail}
                onChange={e => setSelectedEmail(e.target.value)}
                required
                style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg-3)', color: 'var(--text-1)', border: '1px solid var(--border)' }}
              >
                <option value="">-- Choose a Volunteer --</option>
                {candidates.map(c => (
                  <option key={c.id} value={c.email}>
                    {c.name} ({c.email})
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && <div className="manager-error">{error}</div>}
          {message && <div className="manager-info">{message}</div>}

          {!loadingInit && candidates.length > 0 && (
            <div className="manager-actions manager-actions-right">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? '⏳ Promoting…' : '🌟 Promote to Manager'}
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
