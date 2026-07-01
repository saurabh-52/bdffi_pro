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

export default function VolunteerForgotPasswordPage() {
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
      const response = await fetch('/api/volunteer/forgot/confirm', {
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
    <div className="volunteer-forgot-page">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="volunteer-login-container">
        <div className="volunteer-login-card">
          <div className="volunteer-login-logo">
            <img src="https://res.cloudinary.com/dvjschjlg/image/upload/v1722862190/FFI/Logo/gpq3l0srvnvyyjzeg8k5.png" alt="Fast Forward India logo" className="volunteer-logo-img" />
            <div className="volunteer-login-brand">
              <strong>Fast Forward India</strong>
              <span>Blood Donation Management System</span>
            </div>
          </div>

          <div className="volunteer-login-header">
            <div className="volunteer-badge">Password Reset</div>
            <h2>Create a New Password</h2>
            <p>Open the link from your email and choose a new password.</p>
          </div>

          <form onSubmit={handleSubmit}>
            {!token && (
              <div className="manager-info">
                The reset link is missing its token. Please open the link from your email again.
              </div>
            )}

            <div className="field">
              <label htmlFor="volNewPassword">New Password</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  id="volNewPassword"
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
              <label htmlFor="volConfirmPassword">Confirm Password</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  id="volConfirmPassword"
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

            <button type="submit" className="btn btn-primary volunteer-login-btn" disabled={loading}>
              {loading ? '⏳ Resetting…' : '🔁 Update Password'}
            </button>
          </form>

          <div className="volunteer-login-footer">
            <button type="button" className="volunteer-forgot-btn" onClick={() => { window.location.href = '/'; }}>
              ← Back to login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
