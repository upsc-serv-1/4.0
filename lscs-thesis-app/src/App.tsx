import { useState, useEffect } from 'react';
import { Sun, Moon, BarChart3, Database, AlertCircle, Clipboard, Check, Edit3, Save, X, FileText, Settings2 } from 'lucide-react';
import { IntakeVault } from './components/IntakeVault';
import { CaseForm } from './components/CaseForm';
import { CaseList } from './components/CaseList';
import { DataExporter } from './components/DataExporter';
import { fetchCases, saveCaseToSupabase, deleteCaseFromSupabase, fetchMasterPrompt, saveMasterPrompt } from './supabaseClient';
import { type CaseData } from './types';
import { Dashboard } from './components/Dashboard';
import { BulkEditSheet } from './components/BulkEditSheet';

const DEFAULT_CASE_STATE: CaseData = {
  case_no: '',
  reg_no: '',
  patient_name: '',
  wo_name: '',
  age: '',
  religion: '',
  residence: '',
  date_of_admission: '',
  time_of_admission: '',
  date_of_delivery: '',
  time_of_delivery: '',
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

const DEFAULT_STATIC_PROMPT = `You are a medical transcription assistant. Read the following natural language description of a multigravida caesarean section case and extract all values into a single JSON object. Follow these strict rules:

RULES:
1. Output the final JSON inside a standard markdown code block (using \`\`\`json and \`\`\`) so it renders with a 'Copy' button in the chat interface.
2. If NO patient description or transcription is appended to this initial prompt, do not generate a blank JSON. Instead, reply with exactly: "Understood. Please provide the patient case description or voice dictation."
3. In the JSON schema below, all booleans default to false. You MUST change the boolean value to true ONLY if the symptom, history, or outcome is EXPLICITLY mentioned as present/positive in the description.
4. CRITICAL: If a boolean condition is NOT mentioned at all in the description, you MUST output it as false. Silence = negative. For example: if hypertension is not mentioned → "past_history_htn": false. If PPH is not mentioned → "maternal_pph": false. Do NOT omit any boolean field — every boolean in the schema must appear in the output.
5. For unspecified numbers (like age or baby weight) use null. For unspecified strings use "".
6. Parse GPA/GPAL shorthand directly (e.g. G3 P2 A0 L2 maps to gravida: 3, para: 2, abortion: 0, living: 2).
7. ⚠️ DATE & TIME RULE (STRICT): For dates (date_of_admission, date_of_delivery, lmp, edd): output ONLY the date in "YYYY-MM-DD" format (e.g. "2026-04-04"). For times (time_of_admission, time_of_delivery): if the user explicitly mentions a time of admission or delivery, output it in "HH:MM" 24-hour format (e.g. "17:49"). If NO time is mentioned, output "" (empty string). NEVER invent, assume, or guess a time.
8. Always output ALL fields from the JSON schema below — never skip or omit any field, even if its value is false, null, or empty string.

EXAMPLE TRANSCRIPTION:
"Patient Rita, age 29, admitted with leaking p/v. LMP was Oct 1 2025. G2 P1. Delivered baby girl of 3.2 kg today under spinal anesthesia. No PPH."

EXAMPLE OUTPUT:
\`\`\`json
{
  "patient_name": "Rita",
  "age": 29,
  "complaint_leaking_pv": true,
  "complaint_labour_pains": false,
  "lmp": "2025-10-01",
  "date_of_admission": "",
  "time_of_admission": "",
  "date_of_delivery": "2025-10-01",
  "time_of_delivery": "",
  "gravida": 2,
  "para": 1,
  "abortion": 0,
  "living": 1,
  "neonatal_sex": "female",
  "neonatal_birth_weight": 3.2,
  "anesthesia_type": "spinal",
  "maternal_pph": false
}
\`\`\`

JSON SCHEMA:
{
  "case_no": "",
  "reg_no": "",
  "patient_name": "",
  "wo_name": "",
  "age": null,
  "religion": "",
  "residence": "",
  "date_of_admission": "YYYY-MM-DD",
  "time_of_admission": "HH:MM",
  "date_of_delivery": "YYYY-MM-DD",
  "time_of_delivery": "HH:MM",
  "booking_status": "booked / unbooked",
  
  "complaint_labour_pains": false,
  "complaint_leaking_pv": false,
  "complaint_bleeding_pv": false,
  "complaint_headache": false,
  "complaint_blurring_vision": false,
  "complaint_epigastric_pain": false,
  "complaint_nausea": false,
  "complaint_vomiting": false,
  "complaints_other": "",
  
  "gravida": null,
  "para": null,
  "abortion": null,
  "living": null,
  "prev_pregnancy_details": "",
  "prev_delivery_vaginal": false,
  "prev_delivery_instrumental": false,
  "prev_delivery_lscs": false,
  "prev_obstetric_complications": false,
  "prev_obstetric_complications_details": "",
  
  "lmp": "",
  "edd": "",
  "gestation_weeks": null,
  "menstrual_history_details": "",
  
  "past_history_htn": false,
  "past_history_tb": false,
  "past_history_asthma": false,
  "past_history_epilepsy": false,
  "past_history_heart_disease": false,
  "past_history_diabetes": false,
  "past_history_surgery": false,
  "past_history_surgery_details": "",
  "past_history_infertility_treated": false,
  "infertility_treatment_details": "",
  
  "family_history": "",
  "personal_history": "",
  
  "general_physical_examination": "",
  "investigations": "",
  
  "exam_per_abdomen": "",
  "exam_per_vaginal": "",
  
  "c_section_type": "primary_lscs",
  "c_section_nature": "elective / emergency",
  "c_section_indication": "",
  "anesthesia_type": "spinal / general",
  "intraoperative_findings": "",
  "intraoperative_complications": "",
  
  "maternal_pph": false,
  "maternal_blood_transfusion": false,
  "maternal_wound_infection": false,
  "maternal_puerperal_pyrexia": false,
  "maternal_icu_admission": false,
  "maternal_hospital_stay_days": null,
  "maternal_morbidity": false,
  "maternal_morbidity_details": "",
  "maternal_mortality": false,
  
  "neonatal_baby_count": "singleton / multiple",
  "neonatal_sex": "male / female",
  "neonatal_birth_weight": null,
  "neonatal_apgar_1min": null,
  "neonatal_apgar_5min": null,
  "neonatal_nicu_admission": false,
  "neonatal_nicu_indication": "",
  "neonatal_comp_rds": false,
  "neonatal_comp_sepsis": false,
  "neonatal_comp_asphyxia": false,
  "neonatal_comp_others": "",
  "neonatal_early_death": false,
  
  "additional_clinical_notes": ""
}`;

export default function App() {
  const [cases, setCases] = useState<CaseData[]>([]);
  const [currentCase, setCurrentCase] = useState<CaseData>(DEFAULT_CASE_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeClosing, setWelcomeClosing] = useState(false);
  const [workspaceView, setWorkspaceView] = useState<'dashboard' | 'entry' | 'reports' | 'bulk'>('dashboard');
  const [masterPrompt, setMasterPrompt] = useState<string>('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [editingPromptText, setEditingPromptText] = useState('');
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [savePromptSuccess, setSavePromptSuccess] = useState(false);

  // Load Saved Cases from Supabase
  const loadCases = async () => {
    const hasDbKeys = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
    if (!hasDbKeys) {
      setIsLoading(false);
      return;
    }
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
    
    // Load dynamic prompt guidelines from database
    const loadPrompt = async () => {
      try {
        const dbPrompt = await fetchMasterPrompt();
        if (dbPrompt) {
          setMasterPrompt(dbPrompt);
        } else {
          setMasterPrompt(DEFAULT_STATIC_PROMPT);
        }
      } catch (err) {
        console.warn("Error fetching prompt from settings:", err);
        setMasterPrompt(DEFAULT_STATIC_PROMPT);
      }
    };
    loadPrompt();

    // Trigger welcome toast for Dr. Rupam if database keys are present
    const hasDbKeys = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
    if (hasDbKeys) {
      const showTimer = setTimeout(() => {
        setShowWelcome(true);
        
        const closeTimer = setTimeout(() => {
          setWelcomeClosing(true);
          setTimeout(() => {
            setShowWelcome(false);
          }, 500);
        }, 5000);
        
        return () => clearTimeout(closeTimer);
      }, 1000);
      
      return () => clearTimeout(showTimer);
    }
  }, []);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(masterPrompt).then(() => {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 3000);
    });
  };

  const handleStartEditPrompt = () => {
    setEditingPromptText(masterPrompt);
    setIsEditingPrompt(true);
    setSavePromptSuccess(false);
  };

  const handleSavePrompt = async () => {
    setSavingPrompt(true);
    try {
      const success = await saveMasterPrompt(editingPromptText);
      if (success) {
        setMasterPrompt(editingPromptText);
        setIsEditingPrompt(false);
        setSavePromptSuccess(true);
        setTimeout(() => setSavePromptSuccess(false), 3000);
      } else {
        alert("Failed to save master prompt to database.");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving prompt.");
    } finally {
      setSavingPrompt(false);
    }
  };

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
    // Switch to entry tab so the form is visible immediately
    setWorkspaceView('entry');
    // Smooth scroll to top of form
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const hasDbKeys = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

  if (!hasDbKeys) {
    return (
      <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '20px' }}>
        <div className="card text-center" style={{ maxWidth: '500px', padding: '40px', borderRadius: '16px', border: '1px solid rgba(239, 68, 68, 0.2)', boxShadow: 'var(--shadow-lg)', background: 'var(--bg-card)' }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
            <AlertCircle size={32} />
          </div>
          <h2 style={{ marginBottom: '12px', color: 'var(--text-main)', fontSize: '1.4rem' }}>Database Keys Required</h2>
          <p className="text-muted" style={{ fontSize: '0.92rem', lineHeight: '1.6', marginBottom: '24px' }}>
            Your thesis website has successfully deployed to Netlify! However, it cannot connect to your database because the environment variables are not yet configured on Netlify.
          </p>
          <div style={{ textAlign: 'left', background: 'rgba(0,0,0,0.12)', padding: '20px', borderRadius: '12px', fontSize: '0.85rem', color: 'var(--text-muted)', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
            <strong style={{ color: 'var(--text-main)' }}>How to configure on Netlify:</strong>
            <ol style={{ marginTop: '8px', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: '1.4' }}>
              <li>Go to your Netlify dashboard for this site (<code>lscs-thesis.netlify.app</code>).</li>
              <li>Navigate to <strong>Site configuration</strong> &gt; <strong>Environment variables</strong>.</li>
              <li>Add the following two variables (copy values from your local <code>.env.local</code>):
                <ul style={{ listStyleType: 'disc', marginTop: '6px', paddingLeft: '18px', color: 'var(--text-accent)', fontWeight: 600 }}>
                  <li><code>VITE_SUPABASE_URL</code></li>
                  <li><code>VITE_SUPABASE_ANON_KEY</code></li>
                </ul>
              </li>
              <li>Go to the **Deploys** tab and click **Trigger deploy** &gt; **Clear cache and deploy site** for the changes to take effect.</li>
            </ol>
          </div>
          <p className="text-small" style={{ color: 'var(--text-accent)', fontStyle: 'italic' }}>
            Refresh this page once you have configured the keys in Netlify!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Welcome Toast for Dr. Rupam */}
      {showWelcome && (
        <div className={`welcome-toast ${welcomeClosing ? 'welcome-toast-exit' : ''}`}>
          <div className="welcome-toast-avatar">
            🩺
          </div>
          <div>
            <h4 className="welcome-toast-title">Welcome back, Dr. Rupam! The LSCS Thesis Vault is primed.</h4>
            <p className="welcome-toast-subtitle">
              Your command center is live. Ready to uncover the data and make obstetric history today?
            </p>
          </div>
        </div>
      )}
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
          onClick={() => setWorkspaceView('dashboard')}
          className={`btn ${workspaceView === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '10px 20px', borderRadius: '8px' }}
        >
          <BarChart3 size={16} />
          <span>Thesis Live Stats Dashboard</span>
        </button>
        <button
          onClick={() => setWorkspaceView('entry')}
          className={`btn ${workspaceView === 'entry' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '10px 20px', borderRadius: '8px' }}
        >
          <Database size={16} />
          <span>New Case Entry</span>
        </button>
        <button
          onClick={() => setWorkspaceView('reports')}
          className={`btn ${workspaceView === 'reports' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '10px 20px', borderRadius: '8px' }}
        >
          <FileText size={16} />
          <span>Database & Reports</span>
        </button>
        <button
          onClick={() => setWorkspaceView('bulk')}
          className={`btn ${workspaceView === 'bulk' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '10px 20px', borderRadius: '8px' }}
        >
          <Settings2 size={16} />
          <span>Bulk Edit Panel</span>
        </button>
      </div>

      {workspaceView === 'dashboard' && (
        <Dashboard cases={cases} />
      )}

      {workspaceView === 'entry' && (
        <div className="workspace-main-panel animation-slide-down">
          {/* Sleek Prompt Header Panel with Toggle-able Editor */}
          <div style={{ background: 'var(--bg-card)', padding: '20px 24px', borderRadius: '16px', border: '1px solid var(--border-color)', marginBottom: '24px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)' }}>Workflow A: Voice Dictation Intake</h3>
                <p className="card-subtitle" style={{ margin: '2px 0 0 0' }}>Prime ChatGPT or Gemini to automatically parse case sheets</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleCopyPrompt}
                  className={`btn ${copiedPrompt ? 'btn-success' : 'btn-primary'}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '8px', fontWeight: 600, fontSize: '0.88rem' }}
                >
                  {copiedPrompt ? <Check size={16} /> : <Clipboard size={16} />}
                  <span>{copiedPrompt ? 'Copied Guidelines!' : '📋 Copy Master Prompt'}</span>
                </button>
                <button
                  onClick={isEditingPrompt ? () => setIsEditingPrompt(false) : handleStartEditPrompt}
                  className="btn btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '8px', fontWeight: 600, fontSize: '0.88rem' }}
                >
                  {isEditingPrompt ? <X size={16} /> : <Edit3 size={16} />}
                  <span>{isEditingPrompt ? 'Close Editor' : 'Edit Prompt'}</span>
                </button>
              </div>
            </div>

            {savePromptSuccess && (
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '10px 16px', borderRadius: '8px', marginTop: '16px', fontSize: '0.85rem', fontWeight: 600 }}>
                ✓ Guidelines successfully saved to Supabase settings! Future copies will use this updated prompt.
              </div>
            )}

            {isEditingPrompt && (
              <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <textarea
                  value={editingPromptText}
                  onChange={(e) => setEditingPromptText(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: '280px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                    borderRadius: '8px',
                    padding: '16px',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    lineHeight: '1.5',
                    resize: 'vertical',
                    outline: 'none',
                    marginBottom: '12px'
                  }}
                />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={handleSavePrompt}
                    className="btn btn-primary"
                    disabled={savingPrompt}
                    style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem' }}
                  >
                    <Save size={16} />
                    <span>{savingPrompt ? 'Saving...' : 'Save to Database'}</span>
                  </button>
                  <button
                    onClick={() => setIsEditingPrompt(false)}
                    className="btn btn-secondary"
                    disabled={savingPrompt}
                    style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem' }}
                  >
                    <X size={16} />
                    <span>Cancel</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Intake Vault Paste Box */}
          <IntakeVault
            defaultCaseState={DEFAULT_CASE_STATE}
            onAutoFill={(mappedData) => setCurrentCase(mappedData as CaseData)}
          />

          {/* Main Case Proforma Form */}
          <div className="card mt-6">
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
        </div>
      )}

      {workspaceView === 'reports' && (
        <div className="workspace-main-panel animation-slide-down">
          {/* Export Controls */}
          <DataExporter cases={cases} />

          {/* Saved Case Records List */}
          <CaseList
            cases={cases}
            onSelect={handleSelectCase}
            onDelete={handleDeleteCase}
            isLoading={isLoading}
          />
        </div>
      )}

      {workspaceView === 'bulk' && (
        <div className="workspace-main-panel animation-slide-down">
          <BulkEditSheet
            cases={cases}
            onSaveCase={saveCaseToSupabase}
            onClose={() => {
              setWorkspaceView('reports');
              loadCases(); // Refresh list to get all latest values
            }}
          />
        </div>
      )}
    </div>
  );
}
