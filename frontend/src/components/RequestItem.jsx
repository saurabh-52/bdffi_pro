import React from 'react';
import BloodBadge from './BloodBadge.jsx';
import StatusPill from './StatusPill.jsx';
import { formatISTDateTime } from '../utils/helpers.js';

export default function RequestItem({ request, onOpenDetailsModal }) {
  return (
    <div style={{ width: '100%' }}>
      <div
        className="request-row"
        onClick={() => onOpenDetailsModal?.(request)}
        style={{ cursor: 'pointer', transition: 'background-color 0.2s' }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-3)'}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
      >
        <BloodBadge type={request.blood} />
        <div className="request-info">
          <strong>#{request.caseNumber} - {request.patient}</strong>
          <span style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span>{request.hospital} · {formatISTDateTime(request.createdAt) || request.time}</span>
            <span style={{ color: 'var(--text-3)', fontSize: '0.78rem', fontStyle: 'italic' }}>· Tap to see details</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{request.donors} matched</span>
          <StatusPill status={request.status} />
        </div>
      </div>
    </div>
  );
}
