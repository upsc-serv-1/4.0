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
  date_of_admission date,
  time_of_admission text,
  date_of_delivery date,
  time_of_delivery text,
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
