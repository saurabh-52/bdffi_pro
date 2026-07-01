import React, { useState, useEffect } from 'react';
import { getPathState } from '../../utils/helpers.js';
import EyeToggleButton from '../EyeToggleButton.jsx';

async function readResponseData(response) {
  const text = await response.text();

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export default function ForgotPasswordPage() {
  const pathState = getPathState();
  const [token, setToken] = useState(pathState.token);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined' || !pathState.token) return;

    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('token');
    cleanUrl.searchParams.delete('resetToken');
    window.history.replaceState({}, '', `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
  }, [pathState.token]);

  useEffect(() => {
    setShowPassword(false);
    setShowConfirmPassword(false);
  }, []);

  const handleSubmit = async event => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setLoading(false);
      setError('Passwords do not match.');
      return;
    }

    try {
      const response = await fetch('/api/manager/forgot/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await readResponseData(response);

      if (!response.ok) {
        throw new Error(data.message || 'Reset failed.');
      }

      setMessage(data.message || 'Password updated. You can now sign in.');
      setPassword('');
      setConfirmPassword('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Reset failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="manager-page animate-in">
      <div className="manager-hero">
        <div className="manager-badge">Reset Password</div>
        <h2>Create a new manager password</h2>
        <p>Open the link from your email and choose a new password.</p>
      </div>

      <form className="manager-card card" onSubmit={handleSubmit}>
        <div className="card-header">
          <div>
            <h3>Forgot Password</h3>
            <p>Reset link for the seeded manager account</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <button type="button" className="action-btn" onClick={() => { window.location.href = '/'; }}>
              Back to login
            </button>
          </div>
        </div>

        <div className="manager-form-grid">
          {!token && (
            <div className="manager-info">
              The reset link is missing its token. Please open the link from your email again.
            </div>
          )}

          <div className="field">
            <label htmlFor="newPassword">New Password</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter a new password"
                autoComplete="new-password"
                required
                style={{ flex: 1 }}
              />
              <EyeToggleButton
                shown={showPassword}
                onClick={() => setShowPassword(current => !current)}
                label={showPassword ? 'Hide password' : 'Show password'}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat the new password"
                autoComplete="new-password"
                required
                style={{ flex: 1 }}
              />
              <EyeToggleButton
                shown={showConfirmPassword}
                onClick={() => setShowConfirmPassword(current => !current)}
                label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              />
            </div>
          </div>

          {error && <div className="manager-error">{error}</div>}
          {message && <div className="manager-info">{message}</div>}

          <div className="manager-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '⏳ Resetting…' : '🔁 Update Password'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
