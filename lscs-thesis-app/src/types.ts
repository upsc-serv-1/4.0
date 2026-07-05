export interface CaseData {
  id?: string;
  created_at?: string;
  updated_at?: string;
  
  case_no: string;
  reg_no: string;
  patient_name: string;
  wo_name: string;
  age: number | '';
  religion: string;
  residence: string;
  date_of_admission: string;
  time_of_admission: string;
  date_of_delivery: string;
  time_of_delivery: string;
  booking_status: 'booked' | 'unbooked';
  
  // Presenting Complaints
  complaint_labour_pains: boolean;
  complaint_leaking_pv: boolean;
  complaint_bleeding_pv: boolean;
  complaint_headache: boolean;
  complaint_blurring_vision: boolean;
  complaint_epigastric_pain: boolean;
  complaint_nausea: boolean;
  complaint_vomiting: boolean;
  complaints_other: string;
  
  // Obstetric History
  gravida: number | '';
  para: number | '';
  abortion: number | '';
  living: number | '';
  prev_pregnancy_details: string;
  prev_delivery_vaginal: boolean;
  prev_delivery_instrumental: boolean;
  prev_delivery_lscs: boolean;
  prev_obstetric_complications: boolean;
  prev_obstetric_complications_details: string;
  
  // Menstrual History
  lmp: string;
  edd: string;
  gestation_weeks: string;
  menstrual_history_details: string;
  
  // Past History
  past_history_htn: boolean;
  past_history_tb: boolean;
  past_history_asthma: boolean;
  past_history_epilepsy: boolean;
  past_history_heart_disease: boolean;
  past_history_diabetes: boolean;
  past_history_surgery: boolean;
  past_history_surgery_details: string;
  past_history_infertility_treated: boolean;
  infertility_treatment_details: string;
  
  // History & Examination
  family_history: string;
  personal_history: string;
  general_physical_examination: string;
  investigations: string;
  exam_per_abdomen: string;
  exam_per_vaginal: string;
  
  // C-Section Details
  c_section_type: string;
  c_section_nature: 'elective' | 'emergency' | '';
  c_section_indication: string;
  anesthesia_type: 'spinal' | 'general' | 'other' | '';
  intraoperative_findings: string;
  intraoperative_complications: string;
  
  // Maternal Outcome
  maternal_pph: boolean;
  maternal_blood_transfusion: boolean;
  maternal_wound_infection: boolean;
  maternal_puerperal_pyrexia: boolean;
  maternal_icu_admission: boolean;
  maternal_hospital_stay_days: number | '';
  maternal_morbidity: boolean;
  maternal_morbidity_details: string;
  maternal_mortality: boolean;
  
  // Neonatal Outcome
  neonatal_baby_count: 'singleton' | 'multiple' | '';
  neonatal_sex: 'male' | 'female' | '';
  neonatal_birth_weight: number | '';
  neonatal_apgar_1min: number | '';
  neonatal_apgar_5min: number | '';
  neonatal_nicu_admission: boolean;
  neonatal_nicu_indication: string;
  neonatal_comp_rds: boolean;
  neonatal_comp_sepsis: boolean;
  neonatal_comp_asphyxia: boolean;
  neonatal_comp_others: string;
  neonatal_early_death: boolean;
  
  // Master Clinical Notes
  additional_clinical_notes: string;
}
