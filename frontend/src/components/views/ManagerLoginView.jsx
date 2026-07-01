import React, { useState, useEffect } from 'react';
import { activateManagerAccount } from '../../utils/api.js';

async function readResponseData(response) {
  const text = await response.text();

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export default function ManagerLoginView({ managerSession, onLoginSuccess }) {
  const [managerEmail, setManagerEmail] = useState(managerSession?.gmail ? String(managerSession.gmail) : '');
  const [password, setPassword] = useState('');
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activationPrompt, setActivationPrompt] = useState(null);
  const [activationLoading, setActivationLoading] = useState(false);

  useEffect(() => {
    setManagerEmail(managerSession?.gmail ? String(managerSession.gmail) : '');
    setPassword('');
  }, [managerSession?.gmail]);

  const handleLogin = async event => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/manager/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: managerEmail, password }),
      });
      const data = await readResponseData(response);

      if (!response.ok) {
        if (response.status === 423 && data?.inactive && data?.manager) {
          setActivationPrompt({
            id: data.manager.id,
            gmail: data.manager.gmail,
            password,
          });
          setError(data.message || 'Your account is deactivated.');
          return;
        }

        throw new Error(data.message || 'Manager login failed.');
      }

      setActivationPrompt(null);
      onLoginSuccess?.(data);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Manager login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleActivateAccount = async () => {
    if (!activationPrompt) return;

    setActivationLoading(true);
    setError('');

    try {
      const activatedManager = await activateManagerAccount(activationPrompt.id);
      setActivationPrompt(null);
      onLoginSuccess?.(activatedManager);
    } catch (activateError) {
      setError(activateError instanceof Error ? activateError.message : 'Failed to activate manager account.');
    } finally {
      setActivationLoading(false);
    }
  };

  const handleForgot = async event => {
    event.preventDefault();
    setForgotLoading(true);
    setForgotMessage('');

    try {
      const response = await fetch('/api/manager/forgot/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail || managerEmail }),
      });
      const data = await readResponseData(response);

      setForgotMessage(data?.message || 'If the email matches the seeded manager, a reset link has been sent.');
    } catch (err) {
      setForgotMessage(err instanceof Error ? err.message : 'Failed to request password reset.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="manager-page animate-in">
      <div className="manager-hero">
        <div className="manager-badge">Manager Login</div>
        <h2>Sign in with a manager account</h2>
        <p>Enter a valid manager Gmail and password to open the manager dashboard.</p>
      </div>

      <form className="manager-card card" onSubmit={forgotMode ? handleForgot : handleLogin}>
        <div className="card-header">
          <div>
            <h3>Restricted Access</h3>
            <p>Manager credentials are validated against the backend</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <button type="button" className="action-btn" onClick={() => {
              const next = !forgotMode;
              setForgotMode(next);
              setForgotMessage('');
              setForgotEmail('');
            }}>
              {forgotMode ? 'Back to login' : 'Forgot password?'}
            </button>
          </div>
        </div>

        <div className="manager-form-grid">
          <div className="field">
            <label htmlFor="managerEmail">Manager Email</label>
            <input
              id="managerEmail"
              type="email"
              value={forgotMode ? forgotEmail : managerEmail}
              onChange={e => forgotMode ? setForgotEmail(e.target.value) : setManagerEmail(e.target.value)}
              placeholder="manager@fastforwardindia.org"
              autoComplete="email"
              required
            />
          </div>

          {!forgotMode && (
            <div className="field">
              <label htmlFor="managerPassword">Password</label>
              <input
                id="managerPassword"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter manager password"
                autoComplete="current-password"
                required
              />
            </div>
          )}

          {error && <div className="manager-error">{error}</div>}
          {forgotMessage && <div className="manager-info">{forgotMessage}</div>}
          {activationPrompt && (
            <div className="manager-activation-prompt">
              <div>
                <strong>This account is deactivated.</strong>
                <span>Activate {activationPrompt.gmail} to continue.</span>
              </div>
              <button type="button" className="btn btn-primary" onClick={handleActivateAccount} disabled={activationLoading}>
                {activationLoading ? '⏳ Activating…' : 'Activate Account'}
              </button>
            </div>
          )}

          <div className="manager-actions">
            <button type="submit" className="btn btn-primary" disabled={forgotMode ? forgotLoading : loading}>
              {forgotMode ? (forgotLoading ? '⏳ Sending…' : '📧 Send Reset Link') : (loading ? '⏳ Checking…' : '🔐 Login')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
