import { useState, useEffect } from 'react';
import { Save, X, Settings2, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { type CaseData } from '../types';

interface BulkEditSheetProps {
  cases: CaseData[];
  onSaveCase: (data: CaseData) => Promise<void>;
  onClose: () => void;
}

interface ColumnConfig {
  key: keyof CaseData;
  label: string;
  type: 'text' | 'number' | 'date' | 'time' | 'select';
  options?: string[];
}

const AVAILABLE_COLUMNS: ColumnConfig[] = [
  { key: 'patient_name', label: 'Patient Name', type: 'text' },
  { key: 'age', label: 'Age', type: 'number' },
  { key: 'date_of_admission', label: 'Date of Admission (DOA)', type: 'date' },
  { key: 'time_of_admission', label: 'Time of Admission (TOA)', type: 'time' },
  { key: 'date_of_delivery', label: 'Date of Delivery (DOD)', type: 'date' },
  { key: 'time_of_delivery', label: 'Time of Delivery (TOD)', type: 'time' },
  { key: 'lmp', label: 'LMP Date', type: 'date' },
  { key: 'edd', label: 'EDD Date', type: 'date' },
  { key: 'gestation_weeks', label: 'Period of Gestation', type: 'text' },
  { key: 'booking_status', label: 'Booking Status', type: 'select', options: ['booked', 'unbooked'] },
  { key: 'c_section_nature', label: 'C-Section Nature', type: 'select', options: ['elective', 'emergency'] },
  { key: 'c_section_indication', label: 'C-Section Indication', type: 'text' },
  { key: 'anesthesia_type', label: 'Anesthesia Type', type: 'select', options: ['spinal', 'general', 'other'] }
];

export function BulkEditSheet({ cases, onSaveCase, onClose }: BulkEditSheetProps) {
  const [selectedColumns, setSelectedColumns] = useState<(keyof CaseData)[]>([
    'patient_name',
    'time_of_admission',
    'time_of_delivery',
    'gestation_weeks'
  ]);
  const [isEditing, setIsEditing] = useState(false);
  const [editedCases, setEditedCases] = useState<CaseData[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize editable cases state
  useEffect(() => {
    setEditedCases(JSON.parse(JSON.stringify(cases))); // deep clone
  }, [cases]);

  // Handle column selection changes
  const toggleColumnSelection = (key: keyof CaseData) => {
    setSelectedColumns(prev => {
      if (prev.includes(key)) {
        if (prev.length <= 1) return prev; // Keep at least 1 column selected
        return prev.filter(c => c !== key);
      } else {
        if (prev.length >= 6) return prev; // Limit to max 6 columns
        return [...prev, key];
      }
    });
  };

  // Handle spreadsheet input changes
  const handleCellChange = (caseId: string, key: keyof CaseData, value: any) => {
    setEditedCases(prev => prev.map(c => {
      if (c.id !== caseId) return c;

      let updatedCase = { ...c, [key]: value };

      // Auto-calculate EDD from LMP
      if (key === 'lmp' && value && !updatedCase.edd) {
        try {
          const lmpDate = new Date(value);
          if (!isNaN(lmpDate.getTime())) {
            const eddDate = new Date(lmpDate.getTime());
            eddDate.setDate(eddDate.getDate() + 280);
            const yyyy = eddDate.getFullYear();
            const mm = String(eddDate.getMonth() + 1).padStart(2, '0');
            const dd = String(eddDate.getDate()).padStart(2, '0');
            updatedCase.edd = `${yyyy}-${mm}-${dd}`;
          }
        } catch {}
      }

      // Auto-calculate LMP from EDD (Reverse Naegele)
      if (key === 'edd' && value && !updatedCase.lmp) {
        try {
          const eddDate = new Date(value);
          if (!isNaN(eddDate.getTime())) {
            const lmpDate = new Date(eddDate.getTime());
            lmpDate.setDate(lmpDate.getDate() - 280);
            const yyyy = lmpDate.getFullYear();
            const mm = String(lmpDate.getMonth() + 1).padStart(2, '0');
            const dd = String(lmpDate.getDate()).padStart(2, '0');
            updatedCase.lmp = `${yyyy}-${mm}-${dd}`;
          }
        } catch {}
      }

      // Auto-calculate Period of Gestation (weeks) from LMP + Date of Delivery
      if ((key === 'lmp' || key === 'date_of_delivery') && updatedCase.lmp && updatedCase.date_of_delivery && !updatedCase.gestation_weeks) {
        try {
          const lmpDate = new Date(updatedCase.lmp);
          const deliveryDate = new Date(updatedCase.date_of_delivery);
          if (!isNaN(lmpDate.getTime()) && !isNaN(deliveryDate.getTime())) {
            const diffDays = Math.round((deliveryDate.getTime() - lmpDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays > 0) {
              const weeks = Math.floor(diffDays / 7);
              const days = diffDays % 7;
              updatedCase.gestation_weeks = days > 0 ? `${weeks}+${days}` : `${weeks}`;
            }
          }
        } catch {}
      }

      return updatedCase;
    }));
  };

  // Detect and save only modified cases to optimize DB updates
  const handleSaveAll = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    setSaveSuccess(false);

    const changedCases = editedCases.filter((ec) => {
      const original = cases.find(oc => oc.id === ec.id);
      if (!original) return false;
      return JSON.stringify(ec) !== JSON.stringify(original);
    });

    if (changedCases.length === 0) {
      setIsSaving(false);
      alert("No changes were made to save.");
      return;
    }

    setSaveProgress({ current: 0, total: changedCases.length });

    try {
      for (let i = 0; i < changedCases.length; i++) {
        await onSaveCase(changedCases[i]);
        setSaveProgress(prev => ({ ...prev, current: i + 1 }));
      }
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error("Bulk save failed:", err);
      setErrorMessage(err.message || "Bulk save failed. Some changes might not have been stored.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="card" style={{ padding: '24px', minHeight: '500px' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
        <div>
          <h3>Bulk Database Editor</h3>
          <p className="card-subtitle">Spreadsheet-style tool to quickly correct and fill fields for all saved cases.</p>
        </div>
        <button onClick={onClose} className="btn-icon" title="Close Bulk Editor" style={{ padding: '8px' }}>
          <X size={20} />
        </button>
      </div>

      {errorMessage && (
        <div className="validation-error-banner" style={{ marginBottom: '20px' }}>
          <AlertTriangle size={20} />
          <span>{errorMessage}</span>
        </div>
      )}

      {saveSuccess && (
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '12px 18px', borderRadius: '8px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', fontWeight: 600 }}>
          <CheckCircle2 size={20} />
          <span>All modified cases saved successfully! Reloading lists...</span>
        </div>
      )}

      {isSaving && (
        <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '16px 20px', borderRadius: '8px', color: 'var(--text-accent)', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
            <Loader2 className="animate-spin" size={18} />
            <span>Saving bulk updates: {saveProgress.current} of {saveProgress.total} cases saved...</span>
          </div>
          <div style={{ height: '4px', background: 'var(--border-color)', borderRadius: '2px', marginTop: '10px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--accent)', width: `${(saveProgress.current / saveProgress.total) * 100}%`, transition: 'width 0.15s ease' }}></div>
          </div>
        </div>
      )}

      {!isEditing ? (
        // Step 1: Column Picker Panel
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Settings2 size={18} className="text-accent" />
            <h4 style={{ margin: 0 }}>Step 1: Select up to 6 fields to edit</h4>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            {AVAILABLE_COLUMNS.map((col) => {
              const isSelected = selectedColumns.includes(col.key);
              return (
                <label
                  key={col.key}
                  className="checkbox-container"
                  style={{
                    padding: '12px 16px',
                    background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'var(--card-bg)',
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-color)'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleColumnSelection(col.key)}
                    style={{ cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, color: isSelected ? 'var(--text-main)' : 'var(--text-muted)', fontSize: '0.9rem' }}>
                      {col.label}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Type: {col.type.toUpperCase()}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
            <button
              onClick={() => setIsEditing(true)}
              className="btn btn-primary"
              disabled={selectedColumns.length === 0}
            >
              Start Bulk Editing ({editedCases.length} cases)
            </button>
            <button onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        // Step 2: Spreadsheet Editor Grid
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Selected columns: {selectedColumns.map(key => AVAILABLE_COLUMNS.find(c => c.key === key)?.label).join(', ')}
            </div>
            <button
              onClick={() => setIsEditing(false)}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            >
              Change Columns
            </button>
          </div>

          {/* Table Container with Horizontal Scrolling */}
          <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '24px', background: 'var(--card-bg)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'rgba(99, 102, 241, 0.05)', borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, borderRight: '1px solid var(--border-color)', width: '60px' }}>No.</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, borderRight: '1px solid var(--border-color)', minWidth: '100px' }}>Case/Reg</th>
                  {selectedColumns.map((key) => {
                    const col = AVAILABLE_COLUMNS.find(c => c.key === key);
                    return (
                      <th key={key} style={{ padding: '12px', textAlign: 'left', fontWeight: 600, borderRight: '1px solid var(--border-color)' }}>
                        {col?.label}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {editedCases.map((ec, idx) => {
                  const original = cases.find(oc => oc.id === ec.id);
                  const isModified = JSON.stringify(ec) !== JSON.stringify(original);

                  return (
                    <tr
                      key={ec.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        background: isModified ? 'rgba(99, 102, 241, 0.04)' : 'transparent',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <td style={{ padding: '10px 12px', borderRight: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: '10px 12px', borderRight: '1px solid var(--border-color)', fontWeight: 500 }}>
                        <div>{ec.case_no || 'N/A'}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{ec.reg_no || 'N/A'}</div>
                      </td>
                      {selectedColumns.map((key) => {
                        const col = AVAILABLE_COLUMNS.find(c => c.key === key);
                        const val = (ec[key] as any) ?? '';

                        return (
                          <td key={key} style={{ padding: '6px', borderRight: '1px solid var(--border-color)' }}>
                            {col?.type === 'select' ? (
                              <select
                                value={val}
                                onChange={(e) => handleCellChange(ec.id!, key, e.target.value)}
                                style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-main)', outline: 'none' }}
                              >
                                <option value="">-- Select --</option>
                                {col.options?.map(opt => (
                                  <option key={opt} value={opt}>{opt.toUpperCase()}</option>
                                ))}
                              </select>
                            ) : col?.type === 'date' ? (
                              <input
                                type="date"
                                value={val}
                                onChange={(e) => handleCellChange(ec.id!, key, e.target.value)}
                                style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-main)', outline: 'none' }}
                              />
                            ) : col?.type === 'time' ? (
                              <input
                                type="time"
                                value={val}
                                onChange={(e) => handleCellChange(ec.id!, key, e.target.value)}
                                style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-main)', outline: 'none' }}
                              />
                            ) : col?.type === 'number' ? (
                              <input
                                type="number"
                                value={val}
                                onChange={(e) => handleCellChange(ec.id!, key, e.target.value === '' ? '' : Number(e.target.value))}
                                style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-main)', outline: 'none' }}
                              />
                            ) : (
                              <input
                                type="text"
                                value={val}
                                onChange={(e) => handleCellChange(ec.id!, key, e.target.value)}
                                style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-main)', outline: 'none' }}
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleSaveAll}
              className="btn btn-primary"
              disabled={isSaving}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>Saving Updates...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>Save All Changes</span>
                </>
              )}
            </button>
            <button
              onClick={() => {
                if (window.confirm("Discard all unsaved edits and exit?")) {
                  onClose();
                }
              }}
              className="btn btn-secondary"
              disabled={isSaving}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
