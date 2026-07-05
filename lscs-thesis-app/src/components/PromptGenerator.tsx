import { useState, useEffect } from 'react';
import { Clipboard, Check, Edit3, Save, X } from 'lucide-react';
import { fetchMasterPrompt, saveMasterPrompt } from '../supabaseClient';

export function PromptGenerator() {
  const [copied, setCopied] = useState(false);
  const [fetchedPrompt, setFetchedPrompt] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingText, setEditingText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    async function loadPrompt() {
      try {
        const dbPrompt = await fetchMasterPrompt();
        if (dbPrompt) {
          setFetchedPrompt(dbPrompt);
        }
      } catch (err) {
        console.warn("Failed to load prompt from Supabase settings:", err);
      }
    }
    loadPrompt();
  }, []);

  const masterPrompt = `You are a medical transcription assistant. Read the following natural language description of a multigravida caesarean section case and extract all values into a single JSON object. Follow these strict rules:

RULES:
1. Output the final JSON inside a standard markdown code block (using \`\`\`json and \`\`\`) so it renders with a 'Copy' button in the chat interface.
2. If NO patient description or transcription is appended to this initial prompt, do not generate a blank JSON. Instead, reply with exactly: "Understood. Please provide the patient case description or voice dictation."
3. In the JSON schema below, all booleans default to false. You MUST change the boolean value to true if the symptom, history, or outcome is mentioned as present/positive in the description.
4. For unspecified numbers (like age or baby weight) use null. For unspecified strings use "".
5. Parse GPA/GPAL shorthand directly (e.g. G3 P2 A0 L2 maps to gravida: 3, para: 2, abortion: 0, living: 2).
7. ⚠️ DATE & TIME RULE (STRICT): For dates (date_of_admission, date_of_delivery, lmp, edd): output ONLY the date in "YYYY-MM-DD" format (e.g. "2026-04-04"). For times (time_of_admission, time_of_delivery): if the user explicitly mentions a time of admission or delivery, output it in "HH:MM" 24-hour format (e.g. "17:49"). If NO time is mentioned, output "" (empty string). NEVER invent, assume, or guess a time.

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
  "exam_per_abdomen": "",
  "exam_per_vaginal": "",
  "investigations": "",
  
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

  const activePrompt = fetchedPrompt || masterPrompt;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(activePrompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  };

  const handleStartEdit = () => {
    setEditingText(activePrompt);
    setIsEditing(true);
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const success = await saveMasterPrompt(editingText);
      if (success) {
        setFetchedPrompt(editingText);
        setIsEditing(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert("Failed to save prompt to database settings table.");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving prompt.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="card prompt-card">
      <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3>AI Prompt Generator & Editor</h3>
          <p className="card-subtitle">
            {fetchedPrompt 
              ? 'Using dynamic guidelines configured in Supabase settings table' 
              : 'Use this prompt to prime ChatGPT or Gemini for voice dictation transcription'
            }
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!isEditing ? (
            <>
              <button 
                onClick={handleStartEdit} 
                className="btn btn-secondary"
                style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem' }}
              >
                <Edit3 size={16} />
                <span>Edit Prompt</span>
              </button>
              <button 
                onClick={copyToClipboard} 
                className={`btn-action btn-copy-prompt ${copied ? 'success' : ''}`}
                aria-label="Copy prompt to clipboard"
              >
                {copied ? <Check size={18} /> : <Clipboard size={18} />}
                <span>{copied ? 'Copied!' : 'Copy Master Prompt'}</span>
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={handleSave} 
                className="btn btn-primary"
                disabled={isSaving}
                style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem' }}
              >
                <Save size={16} />
                <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
              </button>
              <button 
                onClick={() => setIsEditing(false)} 
                className="btn btn-secondary"
                disabled={isSaving}
                style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem' }}
              >
                <X size={16} />
                <span>Cancel</span>
              </button>
            </>
          )}
        </div>
      </div>

      {saveSuccess && (
        <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '12px 16px', borderRadius: '8px', margin: '0 24px 16px 24px', fontSize: '0.85rem', fontWeight: 600 }}>
          ✓ Master prompt saved to database settings successfully! Next copy will use updated guidelines.
        </div>
      )}

      <div className="prompt-preview-container">
        {isEditing ? (
          <textarea
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            style={{
              width: '100%',
              minHeight: '450px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)',
              borderRadius: '8px',
              padding: '16px',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              lineHeight: '1.5',
              resize: 'vertical',
              outline: 'none'
            }}
          />
        ) : (
          <pre className="prompt-preview">
            {activePrompt}
          </pre>
        )}
      </div>
    </div>
  );
}
