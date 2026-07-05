import { useState, useEffect } from 'react';
import { Sun, Moon, BarChart3, Database } from 'lucide-react';
import { PromptGenerator } from './components/PromptGenerator';
import { IntakeVault } from './components/IntakeVault';
import { CaseForm } from './components/CaseForm';
import { CaseList } from './components/CaseList';
import { DataExporter } from './components/DataExporter';
import { fetchCases, saveCaseToSupabase, deleteCaseFromSupabase } from './supabaseClient';
import { type CaseData } from './types';
import { Dashboard } from './components/Dashboard';

const DEFAULT_CASE_STATE: CaseData = {
  case_no: '',
  reg_no: '',
  patient_name: '',
  wo_name: '',
  age: '',
  religion: '',
  residence: '',
  date_of_admission: '',
  date_of_delivery: '',
  booking_status: 'unbooked',
  
  complaint_labour_pains: false,
  complaint_leaking_pv: false,
  complaint_bleeding_pv: false,
  complaint_headache: false,
  complaint_blurring_vision: false,
  complaint_epigastric_pain: false,
  complaint_nausea: false,
  complaint_vomiting: false,
  complaints_other: '',
  
  gravida: '',
  para: '',
  abortion: '',
  living: '',
  prev_pregnancy_details: '',
  prev_delivery_vaginal: false,
  prev_delivery_instrumental: false,
  prev_delivery_lscs: false,
  prev_obstetric_complications: false,
  prev_obstetric_complications_details: '',
  
  lmp: '',
  edd: '',
  gestation_weeks: '',
  menstrual_history_details: '',
  
  past_history_htn: false,
  past_history_tb: false,
  past_history_asthma: false,
  past_history_epilepsy: false,
  past_history_heart_disease: false,
  past_history_diabetes: false,
  past_history_surgery: false,
  past_history_surgery_details: '',
  past_history_infertility_treated: false,
  infertility_treatment_details: '',
  
  family_history: '',
  personal_history: '',
  
  general_physical_examination: '',
  exam_per_abdomen: '',
  exam_per_vaginal: '',
  investigations: '',
  
  c_section_type: 'primary_lscs',
  c_section_nature: '',
  c_section_indication: '',
  surgery_date_time: '',
  anesthesia_type: '',
  intraoperative_findings: '',
  intraoperative_complications: '',
  
  maternal_pph: false,
  maternal_blood_transfusion: false,
  maternal_wound_infection: false,
  maternal_puerperal_pyrexia: false,
  maternal_icu_admission: false,
  maternal_hospital_stay_days: '',
  maternal_morbidity: false,
  maternal_morbidity_details: '',
  maternal_mortality: false,
  
  neonatal_baby_count: 'singleton',
  neonatal_sex: '',
  neonatal_birth_weight: '',
  neonatal_apgar_1min: '',
  neonatal_apgar_5min: '',
  neonatal_nicu_admission: false,
  neonatal_nicu_indication: '',
  neonatal_comp_rds: false,
  neonatal_comp_sepsis: false,
  neonatal_comp_asphyxia: false,
  neonatal_comp_others: '',
  neonatal_early_death: false,
  
  additional_clinical_notes: ''
};

export default function App() {
  const [cases, setCases] = useState<CaseData[]>([]);
  const [currentCase, setCurrentCase] = useState<CaseData>(DEFAULT_CASE_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [workspaceView, setWorkspaceView] = useState<'portal' | 'dashboard'>('portal');

  // Load Saved Cases from Supabase
  const loadCases = async () => {
    setIsLoading(true);
    try {
      const data = await fetchCases();
      setCases(data as unknown as CaseData[]);
    } catch (error) {
      console.error("Error loading cases from Supabase:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, []);

  // Theme Toggler
  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  // Form Save
  const handleSave = async (data: CaseData) => {
    setIsSaving(true);
    try {
      await saveCaseToSupabase(data);
      // Success toast trigger
      alert(data.id ? "Case record successfully updated!" : "New case record successfully saved to Supabase!");
      setCurrentCase(DEFAULT_CASE_STATE);
      loadCases(); // Refresh list
    } catch (error) {
      console.error("Error saving case:", error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  // Form Reset / Clear
  const handleClear = () => {
    if (window.confirm("Are you sure you want to discard changes and reset the form?")) {
      setCurrentCase(DEFAULT_CASE_STATE);
    }
  };

  // Case Selection for Editing
  const handleSelectCase = (caseRecord: CaseData) => {
    setCurrentCase(caseRecord);
    // Switch to portal view where the form lives
    setWorkspaceView('portal');
    // Scroll to form after a short delay to allow tab switch to render
    setTimeout(() => {
      const formEl = document.getElementById('case-form-top');
      if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 80);
  };

  // Case Deletion
  const handleDeleteCase = async (id: string) => {
    try {
      await deleteCaseFromSupabase(id);
      alert("Case record successfully deleted.");
      // If currently editing the deleted case, clear the form
      if ((currentCase as any).id === id) {
        setCurrentCase(DEFAULT_CASE_STATE);
      }
      loadCases(); // Refresh list
    } catch (error) {
      console.error("Failed to delete case record:", error);
      alert("Error: Failed to delete case record.");
    }
  };

  return (
    <div className="container">
      {/* Title & Theme Panel */}
      <header className="header-panel">
        <div className="title-area">
          <h1>LSCS Clinical Thesis Manager</h1>
          <p>Study of incidence of primary c section and maternal fetal outcomes in multigravida at tertiary care centre</p>
        </div>
        <div className="header-actions">
          <button onClick={toggleTheme} className="btn btn-secondary" aria-label="Toggle Theme">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>
      </header>

      {/* View Switcher Tabs (Hidden on print) */}
      <div className="workspace-tabs-container" style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={() => setWorkspaceView('portal')}
          className={`btn ${workspaceView === 'portal' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '10px 20px', borderRadius: '8px' }}
        >
          <Database size={16} />
          <span>Case Entry Portal</span>
        </button>
        <button
          onClick={() => setWorkspaceView('dashboard')}
          className={`btn ${workspaceView === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '10px 20px', borderRadius: '8px' }}
        >
          <BarChart3 size={16} />
          <span>Thesis Live Stats Dashboard</span>
        </button>
      </div>

      {workspaceView === 'dashboard' ? (
        <Dashboard cases={cases} />
      ) : (
        <>
          {/* Exporters and Prompt Generators Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '24px' }}>
            <PromptGenerator />
            <DataExporter cases={cases} />
          </div>

          {/* Smart Intake Paste Box */}
          <IntakeVault
            defaultCaseState={DEFAULT_CASE_STATE}
            onAutoFill={(mappedData) => setCurrentCase(mappedData as CaseData)}
          />

          {/* Main Case Proforma Form */}
          <div className="card" id="case-form-top">
            <div className="card-header">
              <div>
                <h3>{currentCase.id ? 'Edit Case Record' : 'Workflow B: Medical Case Entry Form'}</h3>
                <p className="card-subtitle">
                  {currentCase.id 
                    ? `Modifying saved record (ID: ${(currentCase as any).id.slice(0, 8)}...)` 
                    : 'Enter clinical details manually or check values populated by the Intake Vault.'
                  }
                </p>
              </div>
            </div>
            <CaseForm
              initialData={currentCase}
              onSave={handleSave}
              onClear={handleClear}
              isSaving={isSaving}
            />
          </div>

          {/* Saved Database Log List */}
          <CaseList
            cases={cases}
            onSelect={handleSelectCase}
            onDelete={handleDeleteCase}
            isLoading={isLoading}
          />
        </>
      )}
    </div>
  );
}
