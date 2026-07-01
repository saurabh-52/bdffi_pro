import React, { useState } from 'react';
import { createVolunteerAccount } from '../../utils/api.js';

export default function VolunteerAddAccountView({ managerSession, onLogout, onBackToDashboard, onRecordAction }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ name: '', email: '' });

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
      const createdVolunteer = await createVolunteerAccount(form);

      onRecordAction?.({
        request: 'Created Volunteer Account',
        status: 'accepted',
        msg: `Volunteer ${createdVolunteer.name} (${createdVolunteer.email}) was added by Manager ${managerSession?.name || 'Manager'} (${managerSession?.gmail || ''}).`,
      });

      setForm({ name: '', email: '' });
      setMessage(`Added ${createdVolunteer.email}. An activation email has been sent (valid for 7 days).`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create volunteer account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="manager-page animate-in">
      <div className="manager-hero">
        <div className="manager-badge">Add Volunteer</div>
        <h2>Create a new volunteer account</h2>
        <p>Add a volunteer login from this page. The volunteer will receive an activation email to set their password.</p>
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
            <h3>Volunteer Details</h3>
            <p>Enter the new volunteer name and email address to send them an activation link</p>
          </div>
          <button type="button" className="action-btn" onClick={onBackToDashboard}>Back to dashboard</button>
        </div>

        <div className="manager-form-grid">
          <div className="field">
            <label htmlFor="volunteerAddName">Volunteer Name</label>
            <input
              id="volunteerAddName"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              placeholder="Volunteer full name"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="volunteerAddEmail">Volunteer Email</label>
            <input
              id="volunteerAddEmail"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="volunteer@fastforwardindia.org"
              autoComplete="email"
              required
            />
          </div>

          {error && <div className="manager-error">{error}</div>}
          {message && <div className="manager-info">{message}</div>}

          <div className="manager-actions manager-actions-right">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '⏳ Saving…' : '➕ Add Volunteer'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
