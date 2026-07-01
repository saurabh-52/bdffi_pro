import React, { useState } from 'react';

async function readResponseData(response) {
  const text = await response.text();

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export default function VolunteerLoginView({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async event => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/volunteer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await readResponseData(response);

      if (!response.ok) {
        throw new Error(data.message || 'Login failed.');
      }

      onLoginSuccess?.(data);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async event => {
    event.preventDefault();
    setForgotLoading(true);
    setForgotMessage('');

    try {
      const response = await fetch('/api/volunteer/forgot/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail || email }),
      });
      const data = await readResponseData(response);
      setForgotMessage(data?.message || 'If the email matches a volunteer account, a reset link has been sent.');
    } catch (err) {
      setForgotMessage(err instanceof Error ? err.message : 'Failed to request password reset.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="volunteer-login-page">
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
            <div className="volunteer-badge">Volunteer Portal</div>
            <h2>{forgotMode ? 'Reset Password' : 'Welcome Back'}</h2>
            <p>{forgotMode ? 'Enter your email to receive a password reset link' : 'Sign in to access the blood donation dashboard'}</p>
          </div>

          <form onSubmit={forgotMode ? handleForgot : handleLogin}>
            <div className="field">
              <label htmlFor="volunteerEmail">Email Address</label>
              <input
                id="volunteerEmail"
                type="email"
                value={forgotMode ? forgotEmail : email}
                onChange={e => forgotMode ? setForgotEmail(e.target.value) : setEmail(e.target.value)}
                placeholder="volunteer@fastforwardindia.org"
                autoComplete="email"
                required
              />
            </div>

            {!forgotMode && (
              <div className="field">
                <label htmlFor="volunteerPassword">Password</label>
                <input
                  id="volunteerPassword"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
              </div>
            )}

            {error && <div className="manager-error">{error}</div>}
            {forgotMessage && <div className="manager-info">{forgotMessage}</div>}

            <button type="submit" className="btn btn-primary volunteer-login-btn" disabled={forgotMode ? forgotLoading : loading}>
              {forgotMode
                ? (forgotLoading ? '⏳ Sending…' : '📧 Send Reset Link')
                : (loading ? '⏳ Signing in…' : '🔐 Sign In')
              }
            </button>
          </form>

          <div className="volunteer-login-footer">
            <button type="button" className="volunteer-forgot-btn" onClick={() => {
              setForgotMode(!forgotMode);
              setForgotMessage('');
              setError('');
            }}>
              {forgotMode ? '← Back to login' : 'Forgot password?'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
