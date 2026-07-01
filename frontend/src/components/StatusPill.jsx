import React from 'react';

export default function StatusPill({ status }) {
  const map = { pending: 'Pending', fulfilled: 'Fulfilled', active: 'Active' };
  return <span className={`status-pill ${status}`}>{map[status] || status}</span>;
}
