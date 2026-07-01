import React, { useState, useEffect } from 'react';

export default function VolunteersModal({ open, onClose, volunteers = [], managers = [], onDeleteVolunteer, managerSession }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const contentArea = document.querySelector('.content-area');
    if (contentArea) {
      if (open) {
        contentArea.style.overflowY = 'hidden';
      } else {
        contentArea.style.overflowY = '';
      }
    }
    return () => {
      if (contentArea) {
        contentArea.style.overflowY = '';
      }
    };
  }, [open]);

  if (!open) return null;

  const handleDelete = async (volunteer) => {
    const confirmed = window.confirm(`Are you sure you want to remove volunteer "${volunteer.name}" (${volunteer.email})? They will no longer be able to log in, and an email notification will be sent to them.`);
    if (!confirmed) return;

    setLoading(true);
    setError('');
    try {
      await onDeleteVolunteer(volunteer.id, volunteer.name, volunteer.email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove volunteer account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="sheet-modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        zIndex: 9999,
      }}
    >
      <div
        className="sheet-modal card block-modal"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '520px',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid var(--border)',
          backgroundColor: '#fff',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          className="card-header"
          style={{
            borderBottom: '1px solid var(--border)',
            paddingBottom: '1rem',
            marginBottom: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              👥 Manage Volunteers
            </h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'var(--text-3)' }}>
              Remove existing volunteer accounts and send email notifications.
            </p>
          </div>
          <button
            type="button"
            className="modal-close-x"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: '1.5rem',
              color: 'var(--text-3)',
              cursor: 'pointer',
              padding: '0.5rem',
              lineHeight: 1,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            title="Close"
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'var(--bg-3)';
              e.currentTarget.style.color = 'var(--text-1)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-3)';
            }}
          >
            ✕
          </button>
        </div>

        {/* Warning Alert Banner */}
        <div
          style={{
            background: 'var(--amber-soft)',
            color: 'var(--amber)',
            border: '1px solid rgba(217, 119, 6, 0.2)',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            fontSize: '0.82rem',
            fontWeight: 500,
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>⚠️</span>
          <span>A manager can only remove a volunteer that is not a manager.</span>
        </div>

        {error && <div className="manager-error" style={{ marginBottom: '1rem' }}>{error}</div>}

        <div className="block-modal-content" style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '0.25rem' }}>
          <div className="manager-account-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {volunteers.map(v => {
              const isManager = managers.some(m => m.gmail.toLowerCase() === v.email.toLowerCase() && (m.is_primary || m.is_active));
              return (
                <div
                  key={v.id || v.email}
                  className="manager-account-item"
                  style={{
                    padding: '0.75rem 0.75rem',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderRadius: '8px',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-3)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--text-1)' }}>{v.name}</strong>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>{v.email}</span>
                  </div>
                  {isManager ? (
                    <span
                      style={{
                        padding: '0.3rem 0.75rem',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        background: 'var(--amber-soft)',
                        color: 'var(--amber)',
                        borderRadius: '6px',
                        border: '1px solid rgba(217, 119, 6, 0.2)',
                        whiteSpace: 'nowrap',
                        cursor: 'not-allowed',
                      }}
                      title="super admin (primary manager) needs to demote a manager first before removing as volunteer."
                    >
                      Manager
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="manager-deactivate-btn"
                      onClick={() => handleDelete(v)}
                      disabled={loading}
                      style={{
                        padding: '0.35rem 0.85rem',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        borderRadius: '6px',
                        background: 'var(--red-soft)',
                        color: 'var(--red)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        opacity: loading ? 0.7 : 1,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => {
                        if (!loading) {
                          e.currentTarget.style.backgroundColor = 'var(--red)';
                          e.currentTarget.style.color = '#fff';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!loading) {
                          e.currentTarget.style.backgroundColor = 'var(--red-soft)';
                          e.currentTarget.style.color = 'var(--red)';
                        }
                      }}
                    >
                      {loading ? '…' : 'Remove'}
                    </button>
                  )}
                </div>
              );
            })}
            {volunteers.length === 0 && (
              <div className="manager-empty-state" style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-3)' }}>
                <span className="manager-empty-state-icon" style={{ fontSize: '1.8rem', display: 'block', marginBottom: '0.5rem' }}>👤</span>
                No volunteer accounts found.
              </div>
            )}
          </div>
        </div>

        <div className="block-modal-footer" style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="action-btn notify"
            onClick={onClose}
            style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
