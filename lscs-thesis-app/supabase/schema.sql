-- SQL schema for Thesis Data Collector
-- Target table: lscs_thesis_cases
-- Run this script in your Supabase SQL Editor (https://supabase.com)

CREATE TABLE IF NOT EXISTS lscs_thesis_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  -- Demographics
  case_no text,
  reg_no text,
  patient_name text,
  wo_name text, -- Wife of
  age integer,
  religion text,
  residence text,
  date_of_admission timestamp with time zone,
  date_of_delivery timestamp with time zone,
  booking_status text DEFAULT 'unbooked', -- 'booked' or 'unbooked'
  
  -- Presenting Complaints
  complaint_labour_pains boolean DEFAULT false,
  complaint_leaking_pv boolean DEFAULT false,
  complaint_bleeding_pv boolean DEFAULT false,
  complaint_headache boolean DEFAULT false,
  complaint_blurring_vision boolean DEFAULT false,
  complaint_epigastric_pain boolean DEFAULT false,
  complaint_nausea boolean DEFAULT false,
  complaint_vomiting boolean DEFAULT false,
  complaints_other text,
  
  -- Obstetric History
  gravida integer DEFAULT 0,
  para integer DEFAULT 0,
  abortion integer DEFAULT 0,
  living integer DEFAULT 0,
  prev_pregnancy_details text,
  prev_delivery_vaginal boolean DEFAULT false,
  prev_delivery_instrumental boolean DEFAULT false,
  prev_delivery_lscs boolean DEFAULT false,
  prev_obstetric_complications boolean DEFAULT false,
  prev_obstetric_complications_details text,
  
  -- Menstrual History
  lmp date,
  edd date,
  gestation_weeks numeric,
  menstrual_history_details text,
  
  -- Past History
  past_history_htn boolean DEFAULT false,
  past_history_tb boolean DEFAULT false,
  past_history_asthma boolean DEFAULT false,
  past_history_epilepsy boolean DEFAULT false,
  past_history_heart_disease boolean DEFAULT false,
  past_history_diabetes boolean DEFAULT false,
  past_history_surgery boolean DEFAULT false,
  past_history_surgery_details text,
  past_history_infertility_treated boolean DEFAULT false,
  infertility_treatment_details text,
  
  -- Family & Personal History
  family_history text,
  personal_history text,
  
  -- Physical Examination & Investigations
  general_physical_examination text,
  investigations text,
  
  -- Obstetric Examination
  exam_per_abdomen text,
  exam_per_vaginal text,
  
  -- Caesarean Section Details
  c_section_type text DEFAULT 'primary_lscs', -- default primary LSCS
  c_section_nature text, -- 'elective' or 'emergency'
  c_section_indication text,
  surgery_date_time timestamp with time zone,
  anesthesia_type text DEFAULT 'spinal', -- 'spinal', 'general', 'other'
  intraoperative_findings text,
  intraoperative_complications text,
  
  -- Maternal Outcome
  maternal_pph boolean DEFAULT false,
  maternal_blood_transfusion boolean DEFAULT false,
  maternal_wound_infection boolean DEFAULT false,
  maternal_puerperal_pyrexia boolean DEFAULT false,
  maternal_icu_admission boolean DEFAULT false,
  maternal_hospital_stay_days integer,
  maternal_morbidity boolean DEFAULT false,
  maternal_morbidity_details text,
  maternal_mortality boolean DEFAULT false,
  
  -- Neonatal Outcome
  neonatal_baby_count text DEFAULT 'singleton', -- 'singleton' or 'multiple'
  neonatal_sex text, -- 'male' or 'female'
  neonatal_birth_weight numeric,
  neonatal_apgar_1min integer,
  neonatal_apgar_5min integer,
  neonatal_nicu_admission boolean DEFAULT false,
  neonatal_nicu_indication text,
  neonatal_comp_rds boolean DEFAULT false,
  neonatal_comp_sepsis boolean DEFAULT false,
  neonatal_comp_asphyxia boolean DEFAULT false,
  neonatal_comp_others text,
  neonatal_early_death boolean DEFAULT false,
  
  -- Master Clinical Notes
  additional_clinical_notes text
);

-- Enable Row Level Security (optional, let's keep it simple for local clinical work or enable standard access)
ALTER TABLE lscs_thesis_cases ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all actions for simplicity in this dedicated database client setup
CREATE POLICY "Allow public access to all cases" ON lscs_thesis_cases
  FOR ALL USING (true) WITH CHECK (true);

-- Create settings table for dynamic configuration (e.g. Master Prompt)
CREATE TABLE IF NOT EXISTS lscs_thesis_settings (
  id TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on settings table
ALTER TABLE lscs_thesis_settings ENABLE ROW LEVEL SECURITY;

-- Allow public access to settings table
CREATE POLICY "Allow public access to settings" ON lscs_thesis_settings
  FOR ALL USING (true) WITH CHECK (true);

-- Insert the default master prompt
INSERT INTO lscs_thesis_settings (id, value)
VALUES ('master_prompt', $$You are a medical transcription assistant. Read the following natural language description of a multigravida caesarean section case and extract all values into a single JSON object. Follow these strict rules:

RULES:
1. Output the final JSON inside a standard markdown code block (using ```json and ```) so it renders with a 'Copy' button in the chat interface.
2. If NO patient description or transcription is appended to this initial prompt, do not generate a blank JSON. Instead, reply with exactly: "Understood. Please provide the patient case description or voice dictation."
3. In the JSON schema below, all booleans default to false. You MUST change the boolean value to true if the symptom, history, or outcome is mentioned as present/positive in the description.
4. For unspecified numbers (like age or baby weight) use null. For unspecified strings use "".
5. Parse GPA/GPAL shorthand directly (e.g. G3 P2 A0 L2 maps to gravida: 3, para: 2, abortion: 0, living: 2).
6. Parse dates/times to ISO format "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM:SS".

EXAMPLE TRANSCRIPTION:
"Patient Rita, age 29, admitted with leaking p/v. LMP was Oct 1 2025. G2 P1. Delivered baby girl of 3.2 kg today under spinal anesthesia. No PPH."

EXAMPLE OUTPUT:
```json
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
```

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
  "investigations": "",
  
  "exam_per_abdomen": "",
  "exam_per_vaginal": "",
  
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
}$$)
ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value;
