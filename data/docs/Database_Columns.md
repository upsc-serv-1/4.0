# Database Columns Reference Sheet

This document lists all database columns created in the `lscs_thesis_cases` table in Supabase. These columns are mapped directly to individual fields in the Clinical Case Proforma.

---

## 1. Primary Metadata
These columns are automatically generated for system records.

| Database Column | SQL Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key (auto-generated UUID) |
| `created_at` | `timestamp with time zone` | Record creation timestamp |
| `updated_at` | `timestamp with time zone` | Record modification timestamp |

---

## 2. Demographics & Admission Info
Mapped to the first two cards on the proforma page.

| Database Column | SQL Type | Proforma Label / Description |
| :--- | :--- | :--- |
| `case_no` | `text` | Case No. |
| `reg_no` | `text` | Reg No. |
| `patient_name` | `text` | Name |
| `wo_name` | `text` | W/O (Wife of) Name |
| `age` | `integer` | Age |
| `religion` | `text` | Religion |
| `residence` | `text` | Resident of |
| `date_of_admission` | `timestamp with time zone` | Date & Time of Admission (DOA) |
| `date_of_delivery` | `timestamp with time zone` | Date & Time of Delivery (DOD) |
| `booking_status` | `text` | Booking status ('booked' or 'unbooked') |

---

## 3. Presenting Complaints
Mapped as individual boolean indicators to enable SPSS frequency counts.

| Database Column | SQL Type | Proforma Label / Description |
| :--- | :--- | :--- |
| `complaint_labour_pains` | `boolean` | Labour pains (Yes/No) |
| `complaint_leaking_pv` | `boolean` | Leaking p/v (Yes/No) |
| `complaint_bleeding_pv` | `boolean` | Bleeding p/v (Yes/No) |
| `complaint_headache` | `boolean` | Headache (Yes/No) |
| `complaint_blurring_vision` | `boolean` | Blurring of vision (Yes/No) |
| `complaint_epigastric_pain` | `boolean` | Epigastric pain (Yes/No) |
| `complaint_nausea` | `boolean` | Nausea (Yes/No) |
| `complaint_vomiting` | `boolean` | Vomiting (Yes/No) |
| `complaints_other` | `text` | Other complaints (Free text description) |

---

## 4. Obstetric History
Details regarding previous pregnancies.

| Database Column | SQL Type | Proforma Label / Description |
| :--- | :--- | :--- |
| `gravida` | `integer` | Gravida (G) |
| `para` | `integer` | Para (P) |
| `abortion` | `integer` | Abortion (A) |
| `living` | `integer` | Living (L) |
| `prev_pregnancy_details` | `text` | Details of Previous Pregnancies |
| `prev_delivery_vaginal` | `boolean` | Previous delivery: Vaginal (Yes/No) |
| `prev_delivery_instrumental` | `boolean` | Previous delivery: Instrumental (Yes/No) |
| `prev_delivery_lscs` | `boolean` | Previous delivery: LSCS (Yes/No) |
| `prev_obstetric_complications` | `boolean` | Previous obstetric complications indicator (Yes/No) |
| `prev_obstetric_complications_details` | `text` | Details of previous obstetric complications |

---

## 5. Menstrual History

| Database Column | SQL Type | Proforma Label / Description |
| :--- | :--- | :--- |
| `lmp` | `date` | LMP (Last Menstrual Period) |
| `edd` | `date` | EDD (Estimated Date of Delivery) |
| `gestation_weeks` | `numeric` | Period of gestation at admission (in weeks) |
| `menstrual_history_details` | `text` | Menstrual history notes (regularity, duration) |

---

## 6. Past History
Clinical past history medical conditions mapped to separate columns.

| Database Column | SQL Type | Proforma Label / Description |
| :--- | :--- | :--- |
| `past_history_htn` | `boolean` | H/o HTN (Hypertension) |
| `past_history_tb` | `boolean` | H/o TB (Tuberculosis) |
| `past_history_asthma` | `boolean` | H/o Asthma |
| `past_history_epilepsy` | `boolean` | H/o Epilepsy |
| `past_history_heart_disease` | `boolean` | H/o Heart disease |
| `past_history_diabetes` | `boolean` | H/o Diabetes mellitus |
| `past_history_surgery` | `boolean` | H/o any surgery / hospitalization indicator (Yes/No) |
| `past_history_surgery_details` | `text` | Surgery/hospitalization details |
| `past_history_infertility_treated` | `boolean` | H/o infertility treated indicator (Yes/No) |
| `infertility_treatment_details` | `text` | Infertility treatment details |

---

## 7. History & Physical Examinations

| Database Column | SQL Type | Proforma Label / Description |
| :--- | :--- | :--- |
| `family_history` | `text` | Family History |
| `personal_history` | `text` | Personal History |
| `general_physical_examination` | `text` | General Physical Examination findings |
| `investigations` | `text` | Laboratory/Radiology Investigations |
| `exam_per_abdomen` | `text` | Obstetric Exam: Per Abdomen (P/A) |
| `exam_per_vaginal` | `text` | Obstetric Exam: Per Vaginal (P/V) |

---

## 8. Caesarean Section Details

| Database Column | SQL Type | Proforma Label / Description |
| :--- | :--- | :--- |
| `c_section_type` | `text` | Type of Caesarean Section (e.g. Primary LSCS) |
| `c_section_nature` | `text` | Nature of Caesarean (Elective / Emergency) |
| `c_section_indication` | `text` | Indication for Caesarean section |
| `surgery_date_time` | `timestamp with time zone` | Date & Time of Surgery |
| `anesthesia_type` | `text` | Type of Anesthesia (Spinal / General / Other) |
| `intraoperative_findings` | `text` | Intra-operative findings |
| `intraoperative_complications` | `text` | Intra-operative complications (if any) |

---

## 9. Maternal Outcomes

| Database Column | SQL Type | Proforma Label / Description |
| :--- | :--- | :--- |
| `maternal_pph` | `boolean` | Postpartum haemorrhage (Yes/No) |
| `maternal_blood_transfusion` | `boolean` | Blood transfusion required (Yes/No) |
| `maternal_wound_infection` | `boolean` | Wound infection (Yes/No) |
| `maternal_puerperal_pyrexia` | `boolean` | Puerperal pyrexia (Yes/No) |
| `maternal_icu_admission` | `boolean` | ICU admission (Yes/No) |
| `maternal_hospital_stay_days` | `integer` | Duration of hospital stay (days) |
| `maternal_morbidity` | `boolean` | Maternal morbidity indicator (Yes/No) |
| `maternal_morbidity_details` | `text` | Maternal morbidity details |
| `maternal_mortality` | `boolean` | Maternal mortality (Yes/No) |

---

## 10. Neonatal Outcomes

| Database Column | SQL Type | Proforma Label / Description |
| :--- | :--- | :--- |
| `neonatal_baby_count` | `text` | Number of babies (Singleton / Multiple) |
| `neonatal_sex` | `text` | Sex of baby (Male / Female) |
| `neonatal_birth_weight` | `numeric` | Birth weight (kg) |
| `neonatal_apgar_1min` | `integer` | Apgar score at 1 minute |
| `neonatal_apgar_5min` | `integer` | Apgar score at 5 minutes |
| `neonatal_nicu_admission` | `boolean` | NICU admission (Yes/No) |
| `neonatal_nicu_indication` | `text` | Indication for NICU admission |
| `neonatal_comp_rds` | `boolean` | Neonatal complication: RDS (Yes/No) |
| `neonatal_comp_sepsis` | `boolean` | Neonatal complication: Sepsis (Yes/No) |
| `neonatal_comp_asphyxia` | `boolean` | Neonatal complication: Asphyxia (Yes/No) |
| `neonatal_comp_others` | `text` | Neonatal complication: Others (text details) |
| `neonatal_early_death` | `boolean` | Early neonatal death (Yes/No) |
| `additional_clinical_notes` | `text` | Master Clinical Notes (rare nuances/unlisted details) |
