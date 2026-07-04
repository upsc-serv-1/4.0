import { useState, useEffect, type ChangeEvent } from 'react';
import { Save, RefreshCw, AlertTriangle } from 'lucide-react';
import { type CaseData } from '../types';

interface CaseFormProps {
  initialData: CaseData;
  onSave: (data: CaseData) => Promise<void>;
  onClear: () => void;
  isSaving: boolean;
}

type TabType = 'demographics' | 'history' | 'exam_surgery' | 'outcomes';

export function CaseForm({ initialData, onSave, onClear, isSaving }: CaseFormProps) {
  const [formData, setFormData] = useState<CaseData>(initialData);
  const [activeTab, setActiveTab] = useState<TabType>('demographics');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Sync state if initialData changes (e.g. from Auto-fill)
  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  // Handler for text / select / date inputs
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev: CaseData) => ({
      ...prev,
      [name]: value
    }));
  };

  // Handler for checkboxes (booleans)
  const handleCheckboxChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev: CaseData) => ({
      ...prev,
      [name]: checked
    }));
  };

  // Auto calculate EDD from LMP (LMP + 280 days / 9 months & 7 days)
  useEffect(() => {
    if (formData.lmp && !formData.edd) {
      try {
        const lmpDate = new Date(formData.lmp);
        if (!isNaN(lmpDate.getTime())) {
          const eddDate = new Date(lmpDate.getTime());
          eddDate.setDate(eddDate.getDate() + 280);
          const yyyy = eddDate.getFullYear();
          const mm = String(eddDate.getMonth() + 1).padStart(2, '0');
          const dd = String(eddDate.getDate()).padStart(2, '0');
          setFormData((prev: CaseData) => ({
            ...prev,
            edd: `${yyyy}-${mm}-${dd}`
          }));
        }
      } catch (err) {
        console.warn("Could not calculate EDD from LMP", err);
      }
    }
  }, [formData.lmp]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validation checks
    if (!formData.patient_name.trim()) {
      setValidationError("Patient Name is required.");
      setActiveTab('demographics');
      return;
    }
    if (formData.age !== '' && Number(formData.age) <= 0) {
      setValidationError("Age must be a positive integer.");
      setActiveTab('demographics');
      return;
    }

    try {
      await onSave(formData);
    } catch (err: any) {
      setValidationError(err.message || "An error occurred while saving the case.");
    }
  };

  // Real-time clinical warnings calculation
  const getFieldWarnings = () => {
    const fw: Record<string, boolean> = {};
    
    if (formData.age !== '') {
      const ageNum = Number(formData.age);
      if (isNaN(ageNum) || ageNum < 12 || ageNum > 55) {
        fw.age = true;
      }
    }
    
    const g = formData.gravida !== '' ? Number(formData.gravida) : 0;
    const p = formData.para !== '' ? Number(formData.para) : 0;
    const a = formData.abortion !== '' ? Number(formData.abortion) : 0;
    const l = formData.living !== '' ? Number(formData.living) : 0;
    
    if (formData.gravida !== '') {
      if (g <= 1) {
        fw.gravida = true;
      }
      if (formData.para !== '' && formData.abortion !== '' && g < p + a) {
        fw.gravida = true;
        fw.para = true;
        fw.abortion = true;
      }
    }
    
    if (formData.para !== '' && formData.living !== '' && p < l) {
      fw.para = true;
      fw.living = true;
    }
    
    if (formData.gestation_weeks !== '') {
      const gest = Number(formData.gestation_weeks);
      if (isNaN(gest) || gest < 20 || gest > 45) {
        fw.gestation_weeks = true;
      }
    }
    
    if (formData.lmp && formData.edd) {
      const lmpDate = new Date(formData.lmp);
      const eddDate = new Date(formData.edd);
      if (!isNaN(lmpDate.getTime()) && !isNaN(eddDate.getTime())) {
        const diffDays = Math.ceil((eddDate.getTime() - lmpDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays !== 280) {
          fw.lmp = true;
          fw.edd = true;
        }
      }
    }
    
    return fw;
  };

  const fieldWarnings = getFieldWarnings();
  const warningList = [];
  if (fieldWarnings.age) {
    warningList.push("Patient age is outside the expected obstetric range (12-55).");
  }
  if (formData.gravida !== '' && Number(formData.gravida) <= 1) {
    warningList.push("Study requires multigravida cases, but Gravida is 1 (primigravida).");
  }
  const gVal = formData.gravida !== '' ? Number(formData.gravida) : 0;
  const pVal = formData.para !== '' ? Number(formData.para) : 0;
  const aVal = formData.abortion !== '' ? Number(formData.abortion) : 0;
  const lVal = formData.living !== '' ? Number(formData.living) : 0;
  if (formData.gravida !== '' && formData.para !== '' && formData.abortion !== '' && gVal < pVal + aVal) {
    warningList.push(`Gravida (G:${gVal}) cannot be less than Para (P:${pVal}) + Abortion (A:${aVal}).`);
  }
  if (formData.para !== '' && formData.living !== '' && pVal < lVal) {
    warningList.push(`Para (P:${pVal}) cannot be less than Living children (L:${lVal}).`);
  }
  if (fieldWarnings.gestation_weeks) {
    warningList.push(`Period of gestation (${formData.gestation_weeks} weeks) is outside typical range (20-45).`);
  }
  if (fieldWarnings.lmp && fieldWarnings.edd) {
    const lmpDate = new Date(formData.lmp);
    const eddDate = new Date(formData.edd);
    const diffDays = Math.ceil((eddDate.getTime() - lmpDate.getTime()) / (1000 * 60 * 60 * 24));
    warningList.push(`EDD date is ${diffDays} days from LMP (standard human gestation is 280 days).`);
  }

  return (
    <form onSubmit={handleSubmit} className="case-form">
      {validationError && (
        <div className="validation-error-banner">
          <AlertTriangle size={20} />
          <span>{validationError}</span>
        </div>
      )}

      {warningList.length > 0 && (
        <div className="validation-warning-banner">
          <div className="warning-banner-title">
            <AlertTriangle size={18} />
            <span>Review Validation Flags ({warningList.length} anomalies detected)</span>
          </div>
          <ul className="warning-banner-list">
            {warningList.map((warning, idx) => (
              <li key={idx}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Tabs Selector */}
      <div className="tabs-container">
        <button
          type="button"
          onClick={() => setActiveTab('demographics')}
          className={`tab-btn ${activeTab === 'demographics' ? 'active' : ''}`}
        >
          1. Demographics & History
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
        >
          2. Presenting & Past History
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('exam_surgery')}
          className={`tab-btn ${activeTab === 'exam_surgery' ? 'active' : ''}`}
        >
          3. Examinations & C-Section
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('outcomes')}
          className={`tab-btn ${activeTab === 'outcomes' ? 'active' : ''}`}
        >
          4. Outcomes & Notes
        </button>
      </div>

      {/* Tab Contents */}
      <div className="tab-content-panel">
        
        {/* TAB 1: DEMOGRAPHICS & OBSTETRIC HISTORY */}
        {activeTab === 'demographics' && (
          <div className="form-section-grid">
            <div className="form-group-title col-span-2">Top Identification & Demographics</div>
            
            <div className="form-field">
              <label>Case No</label>
              <input type="text" name="case_no" value={formData.case_no} onChange={handleChange} placeholder="e.g. 104" />
            </div>

            <div className="form-field">
              <label>Registration No</label>
              <input type="text" name="reg_no" value={formData.reg_no} onChange={handleChange} placeholder="e.g. REG-8821" />
            </div>

            <div className="form-field">
              <label>Patient Name <span className="req">*</span></label>
              <input type="text" name="patient_name" value={formData.patient_name} onChange={handleChange} required placeholder="Enter full name" />
            </div>

            <div className="form-field">
              <label>W/O (Wife of) Name</label>
              <input type="text" name="wo_name" value={formData.wo_name} onChange={handleChange} placeholder="Enter partner name" />
            </div>

            <div className="form-field">
              <label className={fieldWarnings.age ? "text-red-danger font-semibold" : ""}>Age (years) {fieldWarnings.age && "⚠️"}</label>
              <input type="number" name="age" value={formData.age} onChange={handleChange} min="1" placeholder="e.g. 28" className={fieldWarnings.age ? "input-warning" : ""} />
            </div>

            <div className="form-field">
              <label>Religion</label>
              <input type="text" name="religion" value={formData.religion} onChange={handleChange} placeholder="e.g. Hindu / Muslim" />
            </div>

            <div className="form-field col-span-2">
              <label>Resident of (Residence)</label>
              <input type="text" name="residence" value={formData.residence} onChange={handleChange} placeholder="e.g. Sector-4, Dwarka, Delhi" />
            </div>

            <div className="form-field">
              <label>Date & Time of Admission (DOA)</label>
              <input type="datetime-local" name="date_of_admission" value={formData.date_of_admission} onChange={handleChange} />
            </div>

            <div className="form-field">
              <label>Date & Time of Delivery (DOD)</label>
              <input type="datetime-local" name="date_of_delivery" value={formData.date_of_delivery} onChange={handleChange} />
            </div>

            <div className="form-field">
              <label>Booking Status</label>
              <select name="booking_status" value={formData.booking_status} onChange={handleChange}>
                <option value="unbooked">Unbooked</option>
                <option value="booked">Booked</option>
              </select>
            </div>

            <div className="form-group-title col-span-2 mt-4">Obstetric History (G P A L)</div>

            <div className="form-gpal-grid col-span-2">
              <div className="form-field">
                <label className={fieldWarnings.gravida ? "text-red-danger font-semibold" : ""}>G (Gravida) {fieldWarnings.gravida && "⚠️"}</label>
                <input type="number" name="gravida" value={formData.gravida} onChange={handleChange} min="0" className={fieldWarnings.gravida ? "input-warning" : ""} />
              </div>
              <div className="form-field">
                <label className={fieldWarnings.para ? "text-red-danger font-semibold" : ""}>P (Para) {fieldWarnings.para && "⚠️"}</label>
                <input type="number" name="para" value={formData.para} onChange={handleChange} min="0" className={fieldWarnings.para ? "input-warning" : ""} />
              </div>
              <div className="form-field">
                <label className={fieldWarnings.abortion ? "text-red-danger font-semibold" : ""}>A (Abortion) {fieldWarnings.abortion && "⚠️"}</label>
                <input type="number" name="abortion" value={formData.abortion} onChange={handleChange} min="0" className={fieldWarnings.abortion ? "input-warning" : ""} />
              </div>
              <div className="form-field">
                <label className={fieldWarnings.living ? "text-red-danger font-semibold" : ""}>L (Live) {fieldWarnings.living && "⚠️"}</label>
                <input type="number" name="living" value={formData.living} onChange={handleChange} min="0" className={fieldWarnings.living ? "input-warning" : ""} />
              </div>
            </div>

            <div className="form-field col-span-2">
              <label>Details of Previous Pregnancies</label>
              <textarea name="prev_pregnancy_details" value={formData.prev_pregnancy_details} onChange={handleChange} placeholder="Summarize outcome, complications, weights of past pregnancies..." rows={2} />
            </div>

            <div className="form-field col-span-2">
              <label className="checkbox-section-label">Previous Mode(s) of Delivery</label>
              <div className="checkbox-row mt-2">
                <label className="checkbox-container">
                  <input type="checkbox" name="prev_delivery_vaginal" checked={formData.prev_delivery_vaginal} onChange={handleCheckboxChange} />
                  <span>Vaginal</span>
                </label>
                <label className="checkbox-container">
                  <input type="checkbox" name="prev_delivery_instrumental" checked={formData.prev_delivery_instrumental} onChange={handleCheckboxChange} />
                  <span>Instrumental</span>
                </label>
                <label className="checkbox-container">
                  <input type="checkbox" name="prev_delivery_lscs" checked={formData.prev_delivery_lscs} onChange={handleCheckboxChange} />
                  <span>LSCS (C-Section)</span>
                </label>
              </div>
              {formData.prev_delivery_lscs && (
                <div style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '10px 14px', borderRadius: '8px', marginTop: '10px', fontSize: '0.82rem', lineHeight: '1.4' }}>
                  ⚠️ <strong>Clinical Warning:</strong> You have selected "LSCS (C-Section)". Since this study is specifically on <strong>Primary C-Sections in Multigravidas</strong> (women whose prior deliveries were vaginal/NVD), selecting this indicates a repeat C-section. The dashboard calculator will automatically exclude this patient record from primary CS incidence rate statistics.
                </div>
              )}
            </div>

            <div className="form-field col-span-2 border-box-paired">
              <label className="checkbox-container">
                <input type="checkbox" name="prev_obstetric_complications" checked={formData.prev_obstetric_complications} onChange={handleCheckboxChange} />
                <span className="font-semibold text-accent">H/o Previous Obstetric Complications</span>
              </label>
              {formData.prev_obstetric_complications && (
                <div className="mt-2 animation-slide-down">
                  <textarea
                    name="prev_obstetric_complications_details"
                    value={formData.prev_obstetric_complications_details}
                    onChange={handleChange}
                    placeholder="Specify previous complications (e.g., Preeclampsia, PPH, Gestational Diabetes)..."
                    rows={4}
                    required
                  />
                </div>
              )}
            </div>

            <div className="form-group-title col-span-2 mt-4">Menstrual History</div>

            <div className="form-field">
              <label className={fieldWarnings.lmp ? "text-red-danger font-semibold" : ""}>LMP (Last Menstrual Period) {fieldWarnings.lmp && "⚠️"}</label>
              <input type="date" name="lmp" value={formData.lmp} onChange={handleChange} className={fieldWarnings.lmp ? "input-warning" : ""} />
            </div>

            <div className="form-field">
              <label className={fieldWarnings.edd ? "text-red-danger font-semibold" : ""}>EDD (Estimated Delivery Date) {fieldWarnings.edd && "⚠️"}</label>
              <input type="date" name="edd" value={formData.edd} onChange={handleChange} className={fieldWarnings.edd ? "input-warning" : ""} />
            </div>

            <div className="form-field">
              <label className={fieldWarnings.gestation_weeks ? "text-red-danger font-semibold" : ""}>Period of Gestation (weeks) {fieldWarnings.gestation_weeks && "⚠️"}</label>
              <input type="number" name="gestation_weeks" value={formData.gestation_weeks} onChange={handleChange} min="0" step="0.1" placeholder="e.g. 38.5" className={fieldWarnings.gestation_weeks ? "input-warning" : ""} />
            </div>

            <div className="form-field col-span-2">
              <label>Menstrual History Notes</label>
              <textarea name="menstrual_history_details" value={formData.menstrual_history_details} onChange={handleChange} placeholder="Notes on menstrual history (regularity, cycle length)..." rows={2} />
            </div>
          </div>
        )}

        {/* TAB 2: PRESENTING & PAST HISTORY */}
        {activeTab === 'history' && (
          <div className="form-section-grid">
            <div className="form-group-title col-span-2">Presenting Complaints</div>
            
            <div className="checkbox-grid col-span-2">
              <label className="checkbox-container">
                <input type="checkbox" name="complaint_labour_pains" checked={formData.complaint_labour_pains} onChange={handleCheckboxChange} />
                <span>Labour Pains</span>
              </label>
              <label className="checkbox-container">
                <input type="checkbox" name="complaint_leaking_pv" checked={formData.complaint_leaking_pv} onChange={handleCheckboxChange} />
                <span>Leaking p/v</span>
              </label>
              <label className="checkbox-container">
                <input type="checkbox" name="complaint_bleeding_pv" checked={formData.complaint_bleeding_pv} onChange={handleCheckboxChange} />
                <span>Bleeding p/v</span>
              </label>
              <label className="checkbox-container">
                <input type="checkbox" name="complaint_headache" checked={formData.complaint_headache} onChange={handleCheckboxChange} />
                <span>Headache</span>
              </label>
              <label className="checkbox-container">
                <input type="checkbox" name="complaint_blurring_vision" checked={formData.complaint_blurring_vision} onChange={handleCheckboxChange} />
                <span>Blurring of Vision</span>
              </label>
              <label className="checkbox-container">
                <input type="checkbox" name="complaint_epigastric_pain" checked={formData.complaint_epigastric_pain} onChange={handleCheckboxChange} />
                <span>Epigastric Pain</span>
              </label>
              <label className="checkbox-container">
                <input type="checkbox" name="complaint_nausea" checked={formData.complaint_nausea} onChange={handleCheckboxChange} />
                <span>Nausea</span>
              </label>
              <label className="checkbox-container">
                <input type="checkbox" name="complaint_vomiting" checked={formData.complaint_vomiting} onChange={handleCheckboxChange} />
                <span>Vomiting</span>
              </label>
            </div>

            <div className="form-field col-span-2 mt-2">
              <label>Other Presenting Complaints (Specify)</label>
              <textarea name="complaints_other" value={formData.complaints_other} onChange={handleChange} placeholder="Describe any other presenting symptoms..." rows={2} />
            </div>

            <div className="form-group-title col-span-2 mt-4">Past Medical History (H/O)</div>

            <div className="checkbox-grid col-span-2">
              <label className="checkbox-container">
                <input type="checkbox" name="past_history_htn" checked={formData.past_history_htn} onChange={handleCheckboxChange} />
                <span>Hypertension (HTN)</span>
              </label>
              <label className="checkbox-container">
                <input type="checkbox" name="past_history_tb" checked={formData.past_history_tb} onChange={handleCheckboxChange} />
                <span>Tuberculosis (TB)</span>
              </label>
              <label className="checkbox-container">
                <input type="checkbox" name="past_history_asthma" checked={formData.past_history_asthma} onChange={handleCheckboxChange} />
                <span>Asthma</span>
              </label>
              <label className="checkbox-container">
                <input type="checkbox" name="past_history_epilepsy" checked={formData.past_history_epilepsy} onChange={handleCheckboxChange} />
                <span>Epilepsy</span>
              </label>
              <label className="checkbox-container">
                <input type="checkbox" name="past_history_heart_disease" checked={formData.past_history_heart_disease} onChange={handleCheckboxChange} />
                <span>Heart Disease</span>
              </label>
              <label className="checkbox-container">
                <input type="checkbox" name="past_history_diabetes" checked={formData.past_history_diabetes} onChange={handleCheckboxChange} />
                <span>Diabetes Mellitus</span>
              </label>
            </div>

            {/* Paired surgery field */}
            <div className="form-field col-span-2 border-box-paired mt-2">
              <label className="checkbox-container">
                <input type="checkbox" name="past_history_surgery" checked={formData.past_history_surgery} onChange={handleCheckboxChange} />
                <span className="font-semibold text-accent">H/o Surgery / Hospitalization</span>
              </label>
              {formData.past_history_surgery && (
                <div className="mt-2 animation-slide-down">
                  <textarea
                    name="past_history_surgery_details"
                    value={formData.past_history_surgery_details}
                    onChange={handleChange}
                    placeholder="Provide details of past surgical procedures, indications, dates, or hospital stays..."
                    rows={4}
                    required
                  />
                </div>
              )}
            </div>

            {/* Paired infertility field */}
            <div className="form-field col-span-2 border-box-paired mt-2">
              <label className="checkbox-container">
                <input type="checkbox" name="past_history_infertility_treated" checked={formData.past_history_infertility_treated} onChange={handleCheckboxChange} />
                <span className="font-semibold text-accent">H/o Infertility Treated</span>
              </label>
              {formData.past_history_infertility_treated && (
                <div className="mt-2 animation-slide-down">
                  <textarea
                    name="infertility_treatment_details"
                    value={formData.infertility_treatment_details}
                    onChange={handleChange}
                    placeholder="Provide infertility treatment details (medications, ovulation induction, IVF, duration)..."
                    rows={4}
                    required
                  />
                </div>
              )}
            </div>

            <div className="form-group-title col-span-2 mt-4">Family & Personal History</div>
            
            <div className="form-field">
              <label>Family History</label>
              <textarea name="family_history" value={formData.family_history} onChange={handleChange} placeholder="Diabetes, Hypertension, Multiple births, congenital anomalies in family..." rows={2} />
            </div>

            <div className="form-field">
              <label>Personal History</label>
              <textarea name="personal_history" value={formData.personal_history} onChange={handleChange} placeholder="Diet, habits, sleep, allergy history..." rows={2} />
            </div>
          </div>
        )}

        {/* TAB 3: EXAMINATIONS & C-SECTION DETAILS */}
        {activeTab === 'exam_surgery' && (
          <div className="form-section-grid">
            <div className="form-group-title col-span-2">Examinations & Investigations</div>
            
            <div className="form-field col-span-2">
              <label>General Physical Examination</label>
              <textarea name="general_physical_examination" value={formData.general_physical_examination} onChange={handleChange} placeholder="Pulse, BP, Pallor, Edema, Icterus, Weight, Height..." rows={2} />
            </div>

            <div className="form-field">
              <label>Obstetric Examination: Per Abdomen (P/A)</label>
              <textarea name="exam_per_abdomen" value={formData.exam_per_abdomen} onChange={handleChange} placeholder="Fundal height, Lie, Presentation, Position, FHS..." rows={3} />
            </div>

            <div className="form-field">
              <label>Obstetric Examination: Per Vaginal (P/V)</label>
              <textarea name="exam_per_vaginal" value={formData.exam_per_vaginal} onChange={handleChange} placeholder="Cervical dilatation, Effacement, Station, Membranes, Presenting part..." rows={3} />
            </div>

            <div className="form-field col-span-2">
              <label>Investigations</label>
              <textarea name="investigations" value={formData.investigations} onChange={handleChange} placeholder="Blood group, Hemoglobin, HIV/HBsAg/VDRL, Urine analysis, Ultrasound details..." rows={2} />
            </div>

            <div className="form-group-title col-span-2 mt-4">Caesarean Section Details</div>

            <div className="form-field">
              <label>Type of Caesarean Section</label>
              <input type="text" name="c_section_type" value={formData.c_section_type} onChange={handleChange} placeholder="Primary LSCS" />
            </div>

            <div className="form-field">
              <label>Nature of Caesarean</label>
              <select name="c_section_nature" value={formData.c_section_nature} onChange={handleChange}>
                <option value="">-- Select Nature --</option>
                <option value="elective">Elective</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>

            <div className="form-field col-span-2">
              <label>Indication for Caesarean Section</label>
              <input type="text" name="c_section_indication" value={formData.c_section_indication} onChange={handleChange} placeholder="e.g., Fetal Distress / Breech presentation / Failed Induction" />
            </div>

            <div className="form-field">
              <label>Date & Time of Surgery</label>
              <input type="datetime-local" name="surgery_date_time" value={formData.surgery_date_time} onChange={handleChange} />
            </div>

            <div className="form-field">
              <label>Type of Anesthesia</label>
              <select name="anesthesia_type" value={formData.anesthesia_type} onChange={handleChange}>
                <option value="">-- Select Anesthesia --</option>
                <option value="spinal">Spinal</option>
                <option value="general">General</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="form-field">
              <label>Intra-operative Findings</label>
              <textarea name="intraoperative_findings" value={formData.intraoperative_findings} onChange={handleChange} placeholder="Uterine anomalies, liquor volume/color, placenta location, baby delivery presentation..." rows={3} />
            </div>

            <div className="form-field">
              <label>Intra-operative Complications (if any)</label>
              <textarea name="intraoperative_complications" value={formData.intraoperative_complications} onChange={handleChange} placeholder="Adhesions, bleeding, extension of incision, uterine rupture..." rows={3} />
            </div>
          </div>
        )}

        {/* TAB 4: OUTCOMES & NOTES */}
        {activeTab === 'outcomes' && (
          <div className="form-section-grid">
            <div className="form-group-title col-span-2">Maternal Outcome</div>
            
            <div className="checkbox-grid col-span-2">
              <label className="checkbox-container">
                <input type="checkbox" name="maternal_pph" checked={formData.maternal_pph} onChange={handleCheckboxChange} />
                <span>Postpartum Haemorrhage (PPH)</span>
              </label>
              <label className="checkbox-container">
                <input type="checkbox" name="maternal_blood_transfusion" checked={formData.maternal_blood_transfusion} onChange={handleCheckboxChange} />
                <span>Blood Transfusion Required</span>
              </label>
              <label className="checkbox-container">
                <input type="checkbox" name="maternal_wound_infection" checked={formData.maternal_wound_infection} onChange={handleCheckboxChange} />
                <span>Wound Infection</span>
              </label>
              <label className="checkbox-container">
                <input type="checkbox" name="maternal_puerperal_pyrexia" checked={formData.maternal_puerperal_pyrexia} onChange={handleCheckboxChange} />
                <span>Puerperal Pyrexia</span>
              </label>
              <label className="checkbox-container">
                <input type="checkbox" name="maternal_icu_admission" checked={formData.maternal_icu_admission} onChange={handleCheckboxChange} />
                <span>ICU Admission</span>
              </label>
              <label className="checkbox-container">
                <input type="checkbox" name="maternal_mortality" checked={formData.maternal_mortality} onChange={handleCheckboxChange} />
                <span className="text-red-danger font-semibold">Maternal Mortality (Death)</span>
              </label>
            </div>

            <div className="form-field">
              <label>Duration of Hospital Stay (days)</label>
              <input type="number" name="maternal_hospital_stay_days" value={formData.maternal_hospital_stay_days} onChange={handleChange} min="0" placeholder="e.g. 5" />
            </div>

            {/* Paired maternal morbidity field */}
            <div className="form-field col-span-2 border-box-paired mt-2">
              <label className="checkbox-container">
                <input type="checkbox" name="maternal_morbidity" checked={formData.maternal_morbidity} onChange={handleCheckboxChange} />
                <span className="font-semibold text-accent">Maternal Morbidity Recorded</span>
              </label>
              {formData.maternal_morbidity && (
                <div className="mt-2 animation-slide-down">
                  <textarea
                    name="maternal_morbidity_details"
                    value={formData.maternal_morbidity_details}
                    onChange={handleChange}
                    placeholder="Specify details of maternal morbidity..."
                    rows={4}
                    required
                  />
                </div>
              )}
            </div>

            <div className="form-group-title col-span-2 mt-4">Neonatal Outcome</div>

            <div className="form-field">
              <label>Number of Babies</label>
              <select name="neonatal_baby_count" value={formData.neonatal_baby_count} onChange={handleChange}>
                <option value="singleton">Singleton</option>
                <option value="multiple">Multiple</option>
              </select>
            </div>

            <div className="form-field">
              <label>Sex of Baby</label>
              <select name="neonatal_sex" value={formData.neonatal_sex} onChange={handleChange}>
                <option value="">-- Select Sex --</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            <div className="form-field">
              <label>Birth Weight (kg)</label>
              <input type="number" name="neonatal_birth_weight" value={formData.neonatal_birth_weight} onChange={handleChange} min="0" step="0.01" placeholder="e.g. 3.15" />
            </div>

            <div className="form-field">
              <label>Apgar Score (1 minute)</label>
              <input type="number" name="neonatal_apgar_1min" value={formData.neonatal_apgar_1min} onChange={handleChange} min="0" max="10" placeholder="0 - 10" />
            </div>

            <div className="form-field">
              <label>Apgar Score (5 minutes)</label>
              <input type="number" name="neonatal_apgar_5min" value={formData.neonatal_apgar_5min} onChange={handleChange} min="0" max="10" placeholder="0 - 10" />
            </div>

            <div className="form-field">
              <label className="checkbox-container mt-8">
                <input type="checkbox" name="neonatal_early_death" checked={formData.neonatal_early_death} onChange={handleCheckboxChange} />
                <span className="text-red-danger font-semibold">Early Neonatal Death</span>
              </label>
            </div>

            {/* Paired NICU admission field */}
            <div className="form-field col-span-2 border-box-paired mt-2">
              <label className="checkbox-container">
                <input type="checkbox" name="neonatal_nicu_admission" checked={formData.neonatal_nicu_admission} onChange={handleCheckboxChange} />
                <span className="font-semibold text-accent">NICU Admission Required</span>
              </label>
              {formData.neonatal_nicu_admission && (
                <div className="mt-2 animation-slide-down">
                  <input
                    type="text"
                    name="neonatal_nicu_indication"
                    value={formData.neonatal_nicu_indication}
                    onChange={handleChange}
                    placeholder="Enter indication for NICU admission (e.g. Respiratory distress, Low birth weight)..."
                    required
                  />
                </div>
              )}
            </div>

            <div className="form-field col-span-2">
              <label className="checkbox-section-label">Neonatal Complications</label>
              <div className="checkbox-row mt-2">
                <label className="checkbox-container">
                  <input type="checkbox" name="neonatal_comp_rds" checked={formData.neonatal_comp_rds} onChange={handleCheckboxChange} />
                  <span>RDS (Respiratory Distress)</span>
                </label>
                <label className="checkbox-container">
                  <input type="checkbox" name="neonatal_comp_sepsis" checked={formData.neonatal_comp_sepsis} onChange={handleCheckboxChange} />
                  <span>Sepsis</span>
                </label>
                <label className="checkbox-container">
                  <input type="checkbox" name="neonatal_comp_asphyxia" checked={formData.neonatal_comp_asphyxia} onChange={handleCheckboxChange} />
                  <span>Birth Asphyxia</span>
                </label>
              </div>
              <div className="mt-2">
                <input
                  type="text"
                  name="neonatal_comp_others"
                  value={formData.neonatal_comp_others}
                  onChange={handleChange}
                  placeholder="Specify other neonatal complications (if any)..."
                />
              </div>
            </div>

            <div className="form-group-title col-span-2 mt-4">Master Clinical Notes & Nuances</div>
            
            <div className="form-field col-span-2">
              <label>Additional Clinical Notes (Rare nuances, cooperation issues, unlisted observations...)</label>
              <textarea
                name="additional_clinical_notes"
                value={formData.additional_clinical_notes}
                onChange={handleChange}
                placeholder="Write any additional clinical context here..."
                rows={3}
              />
            </div>
          </div>
        )}

      </div>

      {/* Form Submission Actions */}
      <div className="form-footer-actions">
        <button
          type="button"
          onClick={onClear}
          className="btn btn-secondary"
          disabled={isSaving}
        >
          <RefreshCw size={18} />
          <span>Reset Form</span>
        </button>
        
        <button
          type="submit"
          className="btn btn-primary btn-save"
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <div className="spinner-loaderSmall" />
              <span>Saving Case...</span>
            </>
          ) : (
            <>
              <Save size={18} />
              <span>Save Case Record</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
