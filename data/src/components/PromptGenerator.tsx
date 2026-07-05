import { useState } from 'react';
import { Clipboard, Check } from 'lucide-react';

export function PromptGenerator() {
  const [copied, setCopied] = useState(false);

  const masterPrompt = `You are a medical transcription assistant. Read the following natural language description of a multigravida caesarean section case and extract all values into a single JSON object. Follow these strict rules:

RULES:
1. Output the final JSON inside a standard markdown code block (using \`\`\`json and \`\`\`) so it renders with a 'Copy' button in the chat interface.
2. If NO patient description or transcription is appended to this initial prompt, do not generate a blank JSON. Instead, reply with exactly: "Understood. Please provide the patient case description or voice dictation."
3. In the JSON schema below, all booleans default to false. You MUST change the boolean value to true ONLY if the symptom, history, or outcome is EXPLICITLY mentioned as present/positive in the description.
4. CRITICAL RULE - Silence means Negative: If a boolean condition is NOT mentioned at all in the description, output it as false. Do NOT omit any boolean field. Every boolean in the schema MUST appear in your output with a value of true or false. Examples: if hypertension is not mentioned → "past_history_htn": false. If PPH is not mentioned → "maternal_pph": false. If NICU is not mentioned → "neonatal_nicu_admission": false.
5. For unspecified numbers (like age or baby weight) use null. For unspecified strings use "".
6. Parse GPA/GPAL shorthand directly (e.g. G3 P2 A0 L2 maps to gravida: 3, para: 2, abortion: 0, living: 2).
7. Parse dates/times to ISO format "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM:SS".
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
  "date_of_admission": "",
  "date_of_delivery": "",
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
  "surgery_date_time": "",
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

  const copyToClipboard = () => {
    navigator.clipboard.writeText(masterPrompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  };

  return (
    <div className="card prompt-card">
      <div className="card-header">
        <div>
          <h3>AI Prompt Generator</h3>
          <p className="card-subtitle">Use this prompt to prime ChatGPT or Gemini for voice dictation transcription</p>
        </div>
        <button 
          onClick={copyToClipboard} 
          className={`btn-action btn-copy-prompt ${copied ? 'success' : ''}`}
          aria-label="Copy prompt to clipboard"
        >
          {copied ? <Check size={18} /> : <Clipboard size={18} />}
          <span>{copied ? 'Copied!' : 'Copy Master Prompt'}</span>
        </button>
      </div>
      <div className="prompt-preview-container">
        <pre className="prompt-preview">
          {masterPrompt}
        </pre>
      </div>
    </div>
  );
}
