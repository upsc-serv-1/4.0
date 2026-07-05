# [FR-003] Prompt Generator

## Labels
`MUS`, `enhancement`, `prompt`

## User Story
As a clinical researcher, I want to click a button to copy a master AI prompt to my clipboard, so that I can paste it into Gemini/ChatGPT to instruct the AI on how to transcribe my clinical voice notes into the exact JSON format required by the website.

## Proposed Solution

### Overview
We will create a component `PromptGenerator` that holds the master prompt template and copy button. When clicked, it copies the instructions to the user's clipboard using the browser's clipboard API (`navigator.clipboard.writeText`) and displays a success notification.

### Implementation Flow
1. Design the Master Prompt template. It must list all variable names, data types, and formatting guidelines (e.g., ISO dates, boolean flags, numbers).
2. Create a layout card featuring the prompt text (scrollable preview) and a prominent "Copy Master Prompt" button.
3. Integrate clipboard API with a fallback for older browser environments.
4. Show a visual confirmation (e.g., green checkmark, toast message) upon successful copy.

### Technical Approach (The Master Prompt Content)
The copied prompt will instruct the LLM:
- *"You are a medical transcription assistant. Read the following natural language description of a multigravida caesarean section case and extract all values into a single JSON object. Follow these strict rules:"*
- **Rules:**
  1. Output **ONLY** a valid JSON object. Do not include markdown code fences (like ` ```json `), preambles, or postambles.
  2. Map values to these exact keys:
     - **Demographics:** `case_no`, `reg_no`, `patient_name`, `wo_name`, `age`, `religion`, `residence`, `date_of_admission`, `date_of_delivery`, `booking_status`.
     - **Complaints:** `complaint_labour_pains`, `complaint_leaking_pv`, `complaint_bleeding_pv`, `complaint_headache`, `complaint_blurring_vision`, `complaint_epigastric_pain`, `complaint_nausea`, `complaint_vomiting`, `complaints_other`.
     - **Obstetric & Menstrual History:** `gravida`, `para`, `abortion`, `living`, `prev_pregnancy_details`, `prev_delivery_vaginal`, `prev_delivery_instrumental`, `prev_delivery_lscs`, `prev_obstetric_complications` (bool), `prev_obstetric_complications_details`, `lmp`, `edd`, `gestation_weeks`, `menstrual_history_details`.
     - **Past History:** `past_history_htn`, `past_history_tb`, `past_history_asthma`, `past_history_epilepsy`, `past_history_heart_disease`, `past_history_diabetes`, `past_history_surgery` (bool), `past_history_surgery_details`, `past_history_infertility_treated` (bool), `infertility_treatment_details`.
     - **Exam & Surgery Details:** `family_history`, `personal_history`, `general_physical_examination`, `investigations`, `exam_per_abdomen`, `exam_per_vaginal`, `c_section_type`, `c_section_nature`, `c_section_indication`, `surgery_date_time`, `anesthesia_type`, `intraoperative_findings`, `intraoperative_complications`.
     - **Outcomes:** `maternal_pph`, `maternal_blood_transfusion`, `maternal_wound_infection`, `maternal_puerperal_pyrexia`, `maternal_icu_admission`, `maternal_hospital_stay_days`, `maternal_morbidity` (bool), `maternal_morbidity_details`, `maternal_mortality`, `neonatal_baby_count`, `neonatal_sex`, `neonatal_birth_weight`, `neonatal_apgar_1min`, `neonatal_apgar_5min`, `neonatal_nicu_admission` (bool), `neonatal_nicu_indication`, `neonatal_comp_rds`, `neonatal_comp_sepsis`, `neonatal_comp_asphyxia`, `neonatal_comp_others`, `neonatal_early_death`.
     - **Clinical Notes:** `additional_clinical_notes`.
  3. If a value is mentioned as present, set the boolean flag to `true`. If absent, set to `false`. If unspecified, default to `false` for booleans or `""` for text.
  4. Make sure dates are parsed to `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM:SS`.

## Acceptance Criteria
- [ ] UI shows a clean, styled widget displaying the master prompt.
- [ ] Clicking the copy button copies the prompt text to the clipboard.
- [ ] Standard browser alerts are avoided; custom toast alerts are used.
- [ ] The copy utility is responsive on mobile and desktop browsers.
