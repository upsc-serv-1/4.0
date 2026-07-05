import { useState } from 'react';
import { Edit, Trash2, Search, UserRound, Eye } from 'lucide-react';
import { type CaseData } from '../types';

interface CaseListProps {
  cases: CaseData[];
  onSelect: (caseRecord: CaseData) => void;
  onDelete: (id: string) => Promise<void>;
  isLoading: boolean;
}

export function CaseList({ cases, onSelect, onDelete, isLoading }: CaseListProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCases = cases.filter((c) => {
    const search = searchTerm.toLowerCase();
    return (
      (c.patient_name || '').toLowerCase().includes(search) ||
      (c.case_no || '').toLowerCase().includes(search) ||
      (c.reg_no || '').toLowerCase().includes(search) ||
      (c.residence || '').toLowerCase().includes(search)
    );
  });

  return (
    <div className="card list-card">
      <div className="card-header list-header">
        <div>
          <h3>Saved Case Records</h3>
          <p className="card-subtitle">Showing {filteredCases.length} cases stored in your Supabase database</p>
        </div>
        <div className="search-bar-container">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search by Name, Case No, Reg No..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="loading-state-container">
          <div className="spinner-loader" />
          <p>Retrieving case records from Supabase...</p>
        </div>
      ) : filteredCases.length === 0 ? (
        <div className="empty-state-container">
          <UserRound size={48} className="empty-icon" />
          <p>{searchTerm ? 'No matching case records found.' : 'No cases recorded yet. Fill out the form above or paste voice notes to start.'}</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="cases-table">
            <thead>
              <tr>
                <th>Case / Reg No</th>
                <th>Patient Details</th>
                <th>Obstetric History</th>
                <th>Delivery Details</th>
                <th>Maternal / Neonatal</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.map((c) => {
                const id = (c as any).id;
                return (
                  <tr key={id} className="case-row-item">
                    <td>
                      <div className="font-semibold text-accent">Case: {c.case_no || 'N/A'}</div>
                      <div className="text-small text-muted">Reg: {c.reg_no || 'N/A'}</div>
                    </td>
                    <td>
                      <div className="font-bold">{c.patient_name}</div>
                      <div className="text-small text-muted">{c.age ? `${c.age} yrs` : ''} | {c.residence || 'No Residence'}</div>
                    </td>
                    <td>
                      <div className="gpal-badge">G{c.gravida || 0} P{c.para || 0} A{c.abortion || 0} L{c.living || 0}</div>
                      <div className="text-small text-muted mt-1">Gest: {c.gestation_weeks ? `${c.gestation_weeks} wks` : 'N/A'}</div>
                    </td>
                    <td>
                      <div className="text-capitalize text-small font-semibold">
                        {c.c_section_nature || 'N/A'} LSCS
                      </div>
                      <div className="text-small text-muted truncate max-w-xs" title={c.c_section_indication}>
                        Indication: {c.c_section_indication || 'N/A'}
                      </div>
                    </td>
                    <td>
                      <div className="outcome-badges">
                        {c.maternal_pph && <span className="badge warning">M: PPH</span>}
                        {c.maternal_wound_infection && <span className="badge warning">M: Infection</span>}
                        {c.neonatal_nicu_admission && <span className="badge warning">N: NICU</span>}
                        {c.neonatal_early_death && <span className="badge danger">N: Death</span>}
                        {!c.maternal_pph && !c.maternal_wound_infection && !c.neonatal_nicu_admission && !c.neonatal_early_death && (
                          <span className="badge success">Healthy Outcomes</span>
                        )}
                      </div>
                    </td>
                    <td className="text-right">
                      <div className="action-buttons-group">
                        <button
                          onClick={() => window.open(`?preview=${id}`, '_blank')}
                          className="btn-icon btn-preview"
                          title="Preview Case (opens in new tab)"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => onSelect(c)}
                          className="btn-icon btn-edit"
                          title="Edit Case"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm("Are you sure you want to delete this case record? This cannot be undone.")) {
                              onDelete(id);
                            }
                          }}
                          className="btn-icon btn-delete"
                          title="Delete Case"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
