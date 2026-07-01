import React, { useState } from 'react';
import { BLOOD_GROUPS } from '../../utils/constants.js';
import { getBloodCounts } from '../../utils/helpers.js';

export default function RequestView({ donors = [], onCreateRequest }) {
  const emptyForm = { patientName: '', hospitalName: '', bloodGroup: 'A+', contactNo: '', unitsNeeded: '', urgency: 'normal', notes: '' };
  const [form, setForm] = useState(emptyForm);
  const [submitted, setSubmitted] = useState(false);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const bloodCounts = getBloodCounts(donors);
  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const handleFile = e => {
    const f = e.target.files[0];
    if (f) setFile(f);
  };
  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    setLoading(false);
    onCreateRequest?.({
      id: Date.now(),
      patient: form.patientName,
      hospital: form.hospitalName,
      blood: form.bloodGroup,
      contact: form.contactNo,
      status: 'pending',
      time: 'just now',
      donors: Number(form.unitsNeeded) || 0,
      createdAt: new Date().toISOString(),
      requisitionForm: file ? {
        name: file.name,
        url: URL.createObjectURL(file),
        type: file.type
      } : null
    });
    setSubmitted(true);
    setForm(emptyForm);
    setFile(null);
    setTimeout(() => setSubmitted(false), 5000);
  };

  return (
    <div className="form-page animate-in">
      <h2>New Donation Request</h2>
      <p className="page-sub">Upload a medical requisition form or fill in the details manually. Matched donors will be notified via WhatsApp automatically.</p>
      <div className="request-layout">
        <div className="form-card card form-card-full">
          {/* Upload zone */}
          <label
            className={`upload-zone ${file ? 'has-file' : ''}`}
            htmlFor="form-upload"
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
          >
            <div className="upload-icon">{file ? '✅' : '📄'}</div>
            {file
              ? <p><strong>{file.name}</strong><br />Ready for AI extraction</p>
              : <p><strong>Drop requisition form here</strong><br />or click to upload · PDF, JPG, PNG</p>
            }
            <input id="form-upload" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFile} />
          </label>

          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="field">
                <label htmlFor="patientName">Patient Name *</label>
                <input id="patientName" name="patientName" required value={form.patientName} onChange={handleChange} placeholder="Full patient name" />
              </div>
              <div className="field">
                <label htmlFor="hospitalName">Hospital / Clinic *</label>
                <input id="hospitalName" name="hospitalName" required value={form.hospitalName} onChange={handleChange} placeholder="Hospital name" />
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label htmlFor="bloodGroup">Required Blood Group *</label>
                <select id="bloodGroup" name="bloodGroup" value={form.bloodGroup} onChange={handleChange}>
                  {BLOOD_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="contactNo">Contact Number *</label>
                <input id="contactNo" name="contactNo" required value={form.contactNo} onChange={handleChange} placeholder="+91 XXXXXXXXXX" />
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label htmlFor="unitsNeeded">Number of Units Needed *</label>
                <input id="unitsNeeded" name="unitsNeeded" type="number" min="1" step="1" required value={form.unitsNeeded} onChange={handleChange} placeholder="e.g. 2" />
              </div>
              <div className="field">
                <label htmlFor="urgency">Urgency Level</label>
                <select id="urgency" name="urgency" value={form.urgency} onChange={handleChange}>
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                  <option value="critical">Critical — Immediate</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label htmlFor="notes">Additional Notes</label>
              <textarea id="notes" name="notes" value={form.notes} onChange={handleChange} placeholder="Optional: ward details, timing, doctor notes, or other context…" />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? '⏳ Submitting…' : '🩸 Submit & Notify Donors'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setForm(emptyForm)}>
                Clear
              </button>
            </div>

            {submitted && (
              <div className="success-banner">
                ✅ Request saved! Matched donors are being notified via WhatsApp.
              </div>
            )}
          </form>
        </div>

        <aside className="card donor-pool-panel">
          <div className="card-header donor-pool-header">
            <div>
              <h3>Donor Pool by Blood Group</h3>
              <p>Eligible donors currently in system</p>
            </div>
          </div>

          <div className="donor-pool-list">
            {BLOOD_GROUPS.map(group => (
              <div key={group} className="donor-pool-item">
                <div className="donor-pool-group">{group}</div>
                <div className="donor-pool-count">{bloodCounts[group]} donors</div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
