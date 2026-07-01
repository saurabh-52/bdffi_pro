import React, { useState, useEffect } from 'react';
import { formatDisplayPhone } from '../../utils/helpers.js';

export default function WhatsAppAlertModal({ open, onClose, donor, initialRequest, requests, whatsappStatus, onSend }) {
  const sortedRequests = requests.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const [selectedRequest, setSelectedRequest] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      if (initialRequest) {
        setSelectedRequest(String(initialRequest.id));
      } else {
        setSelectedRequest('');
      }
    }
  }, [open, initialRequest, requests]);

  if (!open || !donor) return null;

  const currentRequest = requests.find(r => String(r.id) === String(selectedRequest)) || null;

  // Build parameters for template blood_donation_request_
  const params = currentRequest ? [
    donor.name || 'Donor',
    currentRequest.blood || 'Unknown',
    currentRequest.patient || 'Patient',
    currentRequest.hospital || 'Hospital',
  ] : [];

  const activeTemplateName = whatsappStatus?.templateName || 'blood_donation_request_';
  const activeLanguageCode = whatsappStatus?.templateLanguageCode || 'en';

  const handleSend = async () => {
    const assocReqId = Number(selectedRequest);
    if (!assocReqId || !currentRequest) {
      setError('Please select an active blood request.');
      return;
    }
    setSending(true);
    setError('');
    try {
      const messageDesc = `Outreach for patient ${currentRequest.patient}`;
      await onSend(donor, messageDesc, activeTemplateName, activeLanguageCode, params, assocReqId);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to send WhatsApp alert.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="sheet-modal-backdrop" onClick={onClose}>
      <div className="sheet-modal card" onClick={e => e.stopPropagation()} style={{ width: '560px', maxHeight: '85vh', overflow: 'auto' }}>
        <div className="card-header">
          <div>
            <h3>Send WhatsApp Alert</h3>
            <p style={{ margin: 0 }}>Configure and send template message to {donor.name}</p>
          </div>
          <button className="action-btn" onClick={onClose}>Close</button>
        </div>
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

          {error && <div className="manager-error">{error}</div>}

          <div>
            <strong>Donor Details:</strong>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginTop: '0.4rem', fontSize: '0.85rem', background: 'var(--bg-3)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
              <div><strong>Name:</strong> {donor.name}</div>
              <div><strong>Blood Group:</strong> {donor.blood}</div>
              <div><strong>Phone:</strong> {formatDisplayPhone(donor.mobile)}</div>
              <div><strong>Programme:</strong> {donor.programme || '—'}</div>
            </div>
          </div>

          <div className="field">
            <label htmlFor="assoc-request" style={{ fontWeight: 600, color: 'var(--text-2)' }}>Associate with Blood Request:</label>
            <select
              id="assoc-request"
              value={selectedRequest}
              onChange={e => setSelectedRequest(e.target.value)}
            >
              <option value="">-- Choose a blood case --</option>
              {sortedRequests.map(r => (
                <option key={r.id} value={r.id}>
                  #{r.caseNumber} - [{r.blood}] {r.patient} at {r.hospital}
                </option>
              ))}
            </select>
          </div>

          <div className="form-actions" style={{ marginTop: '0.5rem' }}>
            <button className="btn btn-primary" onClick={handleSend} disabled={sending || !selectedRequest}>
              {sending ? '⏳ Sending…' : '📲 Send WhatsApp Message'}
            </button>
            <button className="btn btn-secondary" onClick={onClose} disabled={sending}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
