import React, { useState, useEffect, useMemo } from 'react';
import { extractAdmissionPrefix, extractBaseProgramme } from '../../utils/helpers.js';

export default function BlockFiltersModal({ open, onClose, donors = [], blockedFilters = { admissionPrefixes: [], programmes: [] }, onUpdateBlockedFilters }) {
  const [savingBlocks, setSavingBlocks] = useState(false);
  const [tempPrefixes, setTempPrefixes] = useState([]);
  const [tempProgrammes, setTempProgrammes] = useState([]);

  // Extract unique admission prefixes dynamically from donors
  const availablePrefixes = useMemo(() => {
    const prefixes = new Set();
    donors.forEach(d => {
      const prefix = extractAdmissionPrefix(d.admission);
      if (prefix) prefixes.add(prefix);
    });
    return Array.from(prefixes).sort();
  }, [donors]);

  // Extract unique programmes dynamically from donors, grouping by base degree type
  const availableProgrammes = useMemo(() => {
    const progs = new Set();
    donors.forEach(d => {
      const baseProg = extractBaseProgramme(d.programme);
      if (baseProg) progs.add(baseProg);
    });
    return Array.from(progs).sort();
  }, [donors]);

  useEffect(() => {
    if (open && blockedFilters) {
      setTempPrefixes(blockedFilters.admissionPrefixes || []);
      setTempProgrammes(blockedFilters.programmes || []);
    }
  }, [open, blockedFilters, donors]);

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

  const handleSaveBlocks = async () => {
    const confirmSave = window.confirm("Are you sure you want to save these block filters? This will update outreach eligibility for all matching student donors.");
    if (!confirmSave) return;

    setSavingBlocks(true);
    await onUpdateBlockedFilters({
      admissionPrefixes: tempPrefixes,
      programmes: tempProgrammes,
    });
    setSavingBlocks(false);
    onClose();
  };

  return (
    <div className="sheet-modal-backdrop" onClick={onClose}>
      <div className="sheet-modal card block-modal" onClick={e => e.stopPropagation()}>
        <div className="card-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>🚫 Manage Block Filters</h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: 'var(--text-3)' }}>Excludes matching donors from notifications and outreach campaigns</p>
          </div>
          <button
            type="button"
            className="modal-close-x"
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', fontSize: '1.45rem', color: 'var(--text-3)', cursor: 'pointer', padding: '0.25rem 0.5rem', lineHeight: 1, transition: 'color 0.2s' }}
            title="Close"
          >
            ✕
          </button>
        </div>

        <div className="block-modal-content">
          <div className="block-section">
            <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.85rem' }}>Admission Prefix</h4>
            <p className="block-section-desc">Block matching admission prefixes (e.g. 24je, 24dr, ism/2022)</p>
            <div className="block-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
              {availablePrefixes.length === 0 ? (
                <div className="block-empty-msg">No admission prefixes.</div>
              ) : (
                availablePrefixes.map(prefix => {
                  const count = donors.filter(d => extractAdmissionPrefix(d.admission) === prefix).length;
                  const isChecked = tempPrefixes.includes(prefix);
                  return (
                    <label key={prefix} className={`block-checkbox-label ${isChecked ? 'active' : ''}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={e => {
                          if (e.target.checked) {
                            setTempPrefixes(current => [...current, prefix]);
                          } else {
                            setTempPrefixes(current => current.filter(p => p !== prefix));
                          }
                        }}
                      />
                      <span className="block-checkbox-text">
                        <strong>{prefix.toUpperCase()}</strong>
                        <span className="block-count">{count} {count === 1 ? 'donor' : 'donors'}</span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="block-section" style={{ marginTop: '1.5rem' }}>
            <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.85rem' }}>Programme</h4>
            <p className="block-section-desc">Block matching academic programmes (e.g. B.Tech, B.Sc, M.Sc)</p>
            <div className="block-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
              {availableProgrammes.length === 0 ? (
                <div className="block-empty-msg">No programmes.</div>
              ) : (
                availableProgrammes.map(prog => {
                  const count = donors.filter(d => extractBaseProgramme(d.programme) === prog).length;
                  const isChecked = tempProgrammes.includes(prog);
                  return (
                    <label key={prog} className={`block-checkbox-label ${isChecked ? 'active' : ''}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={e => {
                          if (e.target.checked) {
                            setTempProgrammes(current => [...current, prog]);
                          } else {
                            setTempProgrammes(current => current.filter(p => p !== prog));
                          }
                        }}
                      />
                      <span className="block-checkbox-text">
                        <strong>{prog}</strong>
                        <span className="block-count">{count} {count === 1 ? 'donor' : 'donors'}</span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>
        <div className="block-modal-footer" style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setTempPrefixes([]);
              setTempProgrammes([]);
            }}
            disabled={savingBlocks || donors.length === 0}
          >
            Clear Selections
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSaveBlocks}
            disabled={savingBlocks || donors.length === 0}
          >
            {savingBlocks ? 'Saving…' : 'Save Block Filters'}
          </button>
        </div>
      </div>
    </div>
  );
}
