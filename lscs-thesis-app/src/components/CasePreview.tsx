import { useEffect, useState } from 'react';
import { Printer, X, CheckSquare, Square, FileText } from 'lucide-react';
import { fetchCaseById } from '../supabaseClient';
import { type CaseData } from '../types';

interface CasePreviewProps {
  id: string;
}

export function CasePreview({ id }: CasePreviewProps) {
  const [caseRecord, setCaseRecord] = useState<CaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCase() {
      try {
        setLoading(true);
        const data = await fetchCaseById(id);
        setCaseRecord(data as unknown as CaseData);
      } catch (err: any) {
        console.error(err);
        setError("Failed to retrieve the clinical case from the database.");
      } finally {
        setLoading(false);
      }
    }
    loadCase();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  const handleClose = () => {
    window.close();
  };

  if (loading) {
    return (
      <div className="preview-loading-container">
        <div className="spinner-loader" />
        <p>Loading clinical report case sheet...</p>
      </div>
    );
  }

  if (error || !caseRecord) {
    return (
      <div className="preview-error-container">
        <div className="card text-center" style={{ maxWidth: '500px', margin: '80px auto' }}>
          <h3>Error Loading Preview</h3>
          <p className="text-muted mt-2">{error || "Case record not found."}</p>
          <button onClick={handleClose} className="btn btn-secondary mt-4">Close Window</button>
        </div>
      </div>
    );
  }

  const c = caseRecord;

  // Formatting date strings helper
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateOnly = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { dateStyle: 'medium' });
    } catch {
      return dateStr;
    }
  };

  // Helper checkmark renderer
  const renderBooleanValue = (val: boolean) => {
    return val ? (
      <span className="bool-check yes"><CheckSquare size={16} /> Yes</span>
    ) : (
      <span className="bool-check no"><Square size={16} /> No</span>
    );
  };

  return (
    <div className="preview-page-container">
      {/* Header controls (hidden on printing) */}
      <div className="preview-navbar-controls">
        <div className="nav-title">
          <FileText size={20} className="text-accent" />
          <span>Case Report Summary (Case No: {c.case_no || 'N/A'})</span>
        </div>
        <div className="nav-actions">
          <button onClick={handlePrint} className="btn btn-primary">
            <Printer size={16} />
            <span>Print Case / Save PDF</span>
          </button>
          <button onClick={handleClose} className="btn btn-secondary">
            <X size={16} />
            <span>Close Preview</span>
          </button>
        </div>
      </div>

      {/* Main clinical sheet layout */}
      <div className="clinical-sheet">
        <div className="sheet-header">
          <div className="hospital-brand">TERTIARY CARE OBSTETRICS & GYNAECOLOGY DEPT</div>
          <h2>LSCS CASE PROFORMA</h2>
          <p className="thesis-topic">Thesis Study: Primary Caesarean Section Outcomes in Multigravida</p>
        </div>

        <div className="sheet-grid-3">
          <div><strong>Case Number:</strong> {c.case_no || 'N/A'}</div>
          <div><strong>Registration Number:</strong> {c.reg_no || 'N/A'}</div>
          <div><strong>Booking Status:</strong> <span className="text-capitalize">{c.booking_status || 'N/A'}</span></div>
        </div>

        {/* Section 1: Demographics */}
        <div className="sheet-section-title">1. Patient Identification & Demographics</div>
        <div className="sheet-grid-2">
          <div><strong>Patient Name:</strong> {c.patient_name || 'N/A'}</div>
          <div><strong>Wife of (W/O):</strong> {c.wo_name || 'N/A'}</div>
          <div><strong>Age:</strong> {c.age ? `${c.age} years` : 'N/A'}</div>
          <div><strong>Religion:</strong> {c.religion || 'N/A'}</div>
          <div className="col-span-2"><strong>Residence:</strong> {c.residence || 'N/A'}</div>
          <div><strong>Date & Time of Admission (DOA):</strong> {formatDate(c.date_of_admission)}</div>
          <div><strong>Date & Time of Delivery (DOD):</strong> {formatDate(c.date_of_delivery)}</div>
        </div>

        {/* Section 2: Obstetric & Menstrual History */}
        <div className="sheet-section-title">2. Obstetric & Menstrual History</div>
        <div className="gpal-preview-strip">
          <div className="gpal-preview-box">
            <span className="gpal-num">{c.gravida ?? 0}</span>
            <span className="gpal-lbl">Gravida (G)</span>
          </div>
          <div className="gpal-preview-box">
            <span className="gpal-num">{c.para ?? 0}</span>
            <span className="gpal-lbl">Para (P)</span>
          </div>
          <div className="gpal-preview-box">
            <span className="gpal-num">{c.abortion ?? 0}</span>
            <span className="gpal-lbl">Abortion (A)</span>
          </div>
          <div className="gpal-preview-box">
            <span className="gpal-num">{c.living ?? 0}</span>
            <span className="gpal-lbl">Living (L)</span>
          </div>
        </div>

        <div className="sheet-grid-2 mt-4">
          <div><strong>Last Menstrual Period (LMP):</strong> {formatDateOnly(c.lmp)}</div>
          <div><strong>Estimated Delivery Date (EDD):</strong> {formatDateOnly(c.edd)}</div>
          <div><strong>Period of Gestation (weeks):</strong> {c.gestation_weeks ? `${c.gestation_weeks} weeks` : 'N/A'}</div>
          <div><strong>Previous Mode of Delivery:</strong> {c.prev_delivery_vaginal && "Vaginal "} {c.prev_delivery_instrumental && "Instrumental "} {c.prev_delivery_lscs && "LSCS "} {!c.prev_delivery_vaginal && !c.prev_delivery_instrumental && !c.prev_delivery_lscs && "None"}</div>
          <div className="col-span-2"><strong>Previous Pregnancies Details:</strong> {c.prev_pregnancy_details || 'No previous pregnancy details recorded.'}</div>
          <div className="col-span-2 border-box-paired-preview">
            <strong>Previous Obstetric Complications:</strong> {renderBooleanValue(c.prev_obstetric_complications)}
            {c.prev_obstetric_complications && (
              <p className="mt-2 text-small-italic">Details: {c.prev_obstetric_complications_details || 'N/A'}</p>
            )}
          </div>
        </div>

        {/* Section 3: History and Complaints */}
        <div className="sheet-section-title">3. Clinical History & Complaints</div>
        <div className="sheet-grid-2">
          <div className="col-span-2">
            <strong>Presenting Complaints:</strong>
            <div className="symptom-checklist-preview">
              <div>{renderBooleanValue(c.complaint_labour_pains)} Labour pains</div>
              <div>{renderBooleanValue(c.complaint_leaking_pv)} Leaking P/V</div>
              <div>{renderBooleanValue(c.complaint_bleeding_pv)} Bleeding P/V</div>
              <div>{renderBooleanValue(c.complaint_headache)} Headache</div>
              <div>{renderBooleanValue(c.complaint_blurring_vision)} Blurring of vision</div>
              <div>{renderBooleanValue(c.complaint_epigastric_pain)} Epigastric pain</div>
              <div>{renderBooleanValue(c.complaint_nausea)} Nausea</div>
              <div>{renderBooleanValue(c.complaint_vomiting)} Vomiting</div>
            </div>
            {c.complaints_other && (
              <p className="mt-2"><strong>Other Presentation details:</strong> {c.complaints_other}</p>
            )}
          </div>

          <div className="col-span-2 border-box-preview-sub">
            <strong>Medical Comorbidities (Past History):</strong>
            <div className="symptom-checklist-preview mt-2">
              <div>{renderBooleanValue(c.past_history_htn)} Hypertension</div>
              <div>{renderBooleanValue(c.past_history_tb)} Tuberculosis (TB)</div>
              <div>{renderBooleanValue(c.past_history_asthma)} Asthma</div>
              <div>{renderBooleanValue(c.past_history_epilepsy)} Epilepsy</div>
              <div>{renderBooleanValue(c.past_history_heart_disease)} Heart Disease</div>
              <div>{renderBooleanValue(c.past_history_diabetes)} Diabetes Mellitus</div>
            </div>
          </div>

          <div className="col-span-2 border-box-paired-preview">
            <strong>Past Surgical History:</strong> {renderBooleanValue(c.past_history_surgery)}
            {c.past_history_surgery && (
              <p className="mt-2 text-small-italic">Surgical Details: {c.past_history_surgery_details || 'N/A'}</p>
            )}
          </div>

          <div className="col-span-2 border-box-paired-preview">
            <strong>Infertility Treatment History:</strong> {renderBooleanValue(c.past_history_infertility_treated)}
            {c.past_history_infertility_treated && (
              <p className="mt-2 text-small-italic">Treatment Details: {c.infertility_treatment_details || 'N/A'}</p>
            )}
          </div>
          
          <div className="col-span-2"><strong>Family History:</strong> {c.family_history || 'N/A'}</div>
          <div className="col-span-2"><strong>Personal History:</strong> {c.personal_history || 'N/A'}</div>
        </div>

        {/* Section 4: Examinations */}
        <div className="sheet-section-title">4. Examinations & Investigations</div>
        <div className="sheet-grid-1">
          <div><strong>General Physical Examination:</strong> {c.general_physical_examination || 'N/A'}</div>
          <div><strong>Per Abdomen Examination:</strong> {c.exam_per_abdomen || 'N/A'}</div>
          <div><strong>Per Vaginal Examination:</strong> {c.exam_per_vaginal || 'N/A'}</div>
          <div><strong>Investigations & Lab Work:</strong> {c.investigations || 'N/A'}</div>
        </div>

        {/* Section 5: Caesarean Surgery */}
        <div className="sheet-section-title">5. Caesarean Section Surgical Record</div>
        <div className="sheet-grid-2">
          <div><strong>Type of C-Section:</strong> <span className="text-capitalize">{c.c_section_type ? c.c_section_type.replace('_', ' ') : 'N/A'}</span></div>
          <div><strong>Nature of Surgery:</strong> <span className="text-capitalize">{c.c_section_nature || 'N/A'}</span></div>
          <div className="col-span-2"><strong>Indication for Caesarean:</strong> {c.c_section_indication || 'N/A'}</div>
          <div><strong>Date & Time of Surgery:</strong> {formatDate(c.surgery_date_time)}</div>
          <div><strong>Anesthesia Administered:</strong> <span className="text-capitalize">{c.anesthesia_type || 'N/A'}</span></div>
          <div className="col-span-2"><strong>Intraoperative Findings:</strong> {c.intraoperative_findings || 'N/A'}</div>
          <div className="col-span-2"><strong>Intraoperative Complications:</strong> {c.intraoperative_complications || 'N/A'}</div>
        </div>

        {/* Section 6: Maternal & Neonatal Outcomes */}
        <div className="sheet-section-title">6. Maternal & Neonatal Outcomes</div>
        <div className="sheet-grid-2">
          <div className="border-box-preview-sub">
            <strong>Maternal Morbidity checklist:</strong>
            <div className="symptom-checklist-preview mt-2">
              <div>{renderBooleanValue(c.maternal_pph)} Postpartum Hemorrhage (PPH)</div>
              <div>{renderBooleanValue(c.maternal_blood_transfusion)} Blood Transfusion Required</div>
              <div>{renderBooleanValue(c.maternal_wound_infection)} Wound Infection</div>
              <div>{renderBooleanValue(c.maternal_puerperal_pyrexia)} Puerperal Pyrexia</div>
              <div>{renderBooleanValue(c.maternal_icu_admission)} Maternal ICU Admission</div>
            </div>
            <div className="mt-2"><strong>Maternal Mortality:</strong> {renderBooleanValue(c.maternal_mortality)}</div>
            <div className="mt-2"><strong>Hospital Stay Duration:</strong> {c.maternal_hospital_stay_days ? `${c.maternal_hospital_stay_days} days` : 'N/A'}</div>
            
            <div className="border-box-paired-preview mt-2">
              <strong>Maternal Morbidity Recorded:</strong> {renderBooleanValue(c.maternal_morbidity)}
              {c.maternal_morbidity && (
                <p className="mt-2 text-small-italic">Maternal Morbidity Details: {c.maternal_morbidity_details || 'N/A'}</p>
              )}
            </div>
          </div>

          <div className="border-box-preview-sub">
            <strong>Neonatal Details:</strong>
            <p className="mt-2"><strong>Baby Count:</strong> <span className="text-capitalize">{c.neonatal_baby_count || 'N/A'}</span></p>
            <p><strong>Baby Sex:</strong> <span className="text-capitalize">{c.neonatal_sex || 'N/A'}</span></p>
            <p><strong>Birth Weight:</strong> {c.neonatal_birth_weight ? `${c.neonatal_birth_weight} kg` : 'N/A'}</p>
            <p><strong>Apgar Score:</strong> 1 min: {c.neonatal_apgar_1min ?? 'N/A'} | 5 min: {c.neonatal_apgar_5min ?? 'N/A'}</p>
            <p className="mt-2"><strong>Early Neonatal Death:</strong> {renderBooleanValue(c.neonatal_early_death)}</p>
            
            <div className="border-box-paired-preview mt-2">
              <strong>NICU Admission:</strong> {renderBooleanValue(c.neonatal_nicu_admission)}
              {c.neonatal_nicu_admission && (
                <p className="mt-2 text-small-italic">Indication: {c.neonatal_nicu_indication || 'N/A'}</p>
              )}
            </div>
            
            <div className="mt-2 font-semibold">Neonatal Complications:</div>
            <div className="symptom-checklist-preview mt-1">
              <div>{renderBooleanValue(c.neonatal_comp_rds)} RDS</div>
              <div>{renderBooleanValue(c.neonatal_comp_sepsis)} Sepsis</div>
              <div>{renderBooleanValue(c.neonatal_comp_asphyxia)} Birth Asphyxia</div>
            </div>
            {c.neonatal_comp_others && (
              <p className="mt-2 text-small"><strong>Other Complications:</strong> {c.neonatal_comp_others}</p>
            )}
          </div>
          
          <div className="col-span-2 mt-2">
            <strong>Additional Clinical Notes / Rare Nuances:</strong>
            <p className="clinical-notes-block">{c.additional_clinical_notes || 'No additional clinical observations or notes recorded.'}</p>
          </div>
        </div>

        <div className="sheet-footer">
          <div className="signature-area">
            <div className="sig-line">Candidate Signature</div>
            <div className="sig-line">Guide / Head of Dept Signature</div>
          </div>
        </div>
      </div>
    </div>
  );
}
