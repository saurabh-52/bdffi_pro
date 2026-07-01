import React from 'react';

export default function EyeToggleButton({ shown, onClick, label }) {
  return (
    <button
      type="button"
      className="action-btn"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{ minWidth: '3.5rem' }}
    >
      <span aria-hidden="true" style={{ fontSize: '1rem' }}>{shown ? '🙈' : '👁'}</span>
    </button>
  );
}
