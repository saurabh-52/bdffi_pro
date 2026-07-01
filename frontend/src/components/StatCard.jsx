import React from 'react';

export default function StatCard({ value, label, icon, color, delta, deltaType, onSeeMore }) {
  return (
    <div className={`stat-card ${color} animate-in`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {delta && <div className={`stat-delta ${deltaType}`}>{delta}</div>}
      {onSeeMore && (
        <button type="button" className="stat-action red" onClick={onSeeMore} aria-label={`See more ${label}`}>
          See more ▶
        </button>
      )}
    </div>
  );
}
