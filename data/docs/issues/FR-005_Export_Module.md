# [FR-005] Export Module (Excel, Word, PDF)

## Labels
`MUS`, `enhancement`, `export`

## User Story
As a clinical researcher, I want to export all saved cases to Excel (.xlsx), Word (.docx), or PDF formats, so that I can easily analyze my dataset in SPSS or R, compile reports for my academic guide, and print physical records.

## Proposed Solution

### Overview
We will create a component `DataExporter` that queries all rows from Supabase, formats them, and generates file downloads on the client side using light utilities in `src/utils/exporters.ts`.

### Implementation Flow
1. **Excel (.xlsx)**:
   - Fetch all cases.
   - Format column headers into readable text (e.g., "Patient Name", "Age", "Gestation Weeks", "Maternal PPH").
   - Use the `xlsx` library to build a sheet and trigger browser download.
2. **Word (.docx)**:
   - Compile records into structured text summaries or a clean summary table.
   - Build a document blob (using the `docx` library or HTML-blob conversion) and download it with a `.docx` extension.
3. **PDF**:
   - Provide a print mode styled with `@media print` CSS.
   - When printing, hide navigation panels, header, and input fields, presenting only a clean, centered clinical sheet suitable for physical records.
   - Trigger the browser print dialog (`window.print()`) so the user can save as PDF or print directly.

### Technical Approach (Excel Export Example)

```typescript
// src/utils/exporters.ts
import * as XLSX from 'xlsx';

export function exportToExcel(cases: Record<string, any>[]) {
  const formattedRows = cases.map((c) => ({
    "Case No": c.case_no,
    "Reg No": c.reg_no,
    "Patient Name": c.patient_name,
    "W/O Name": c.wo_name,
    "Age": c.age,
    "Religion": c.religion,
    "Residence": c.residence,
    "DOA": c.date_of_admission,
    "DOD": c.date_of_delivery,
    "Booking Status": c.booking_status,
    // Presenting Complaints
    "Labour Pains": c.complaint_labour_pains ? "Yes" : "No",
    "Leaking p/v": c.complaint_leaking_pv ? "Yes" : "No",
    "Bleeding p/v": c.complaint_bleeding_pv ? "Yes" : "No",
    "Headache": c.complaint_headache ? "Yes" : "No",
    "Blurring of Vision": c.complaint_blurring_vision ? "Yes" : "No",
    "Epigastric Pain": c.complaint_epigastric_pain ? "Yes" : "No",
    "Nausea": c.complaint_nausea ? "Yes" : "No",
    "Vomiting": c.complaint_vomiting ? "Yes" : "No",
    "Other Complaints": c.complaints_other,
    // Obstetric History
    "Gravida": c.gravida,
    "Para": c.para,
    "Abortion": c.abortion,
    "Living": c.living,
    "Prev Pregnancy Details": c.prev_pregnancy_details,
    "Prev Delivery: Vaginal": c.prev_delivery_vaginal ? "Yes" : "No",
    "Prev Delivery: Instrumental": c.prev_delivery_instrumental ? "Yes" : "No",
    "Prev Delivery: LSCS": c.prev_delivery_lscs ? "Yes" : "No",
    "Prev Obstetric Complications": c.prev_obstetric_complications ? "Yes" : "No",
    "Prev Obstetric Complications Details": c.prev_obstetric_complications_details,
    // Menstrual History
    "LMP": c.lmp,
    "EDD": c.edd,
    "Gestation Weeks": c.gestation_weeks,
    "Menstrual History Details": c.menstrual_history_details,
    // Past Medical History
    "H/O HTN": c.past_history_htn ? "Yes" : "No",
    "H/O TB": c.past_history_tb ? "Yes" : "No",
    "H/O Asthma": c.past_history_asthma ? "Yes" : "No",
    "H/O Epilepsy": c.past_history_epilepsy ? "Yes" : "No",
    "H/O Heart Disease": c.past_history_heart_disease ? "Yes" : "No",
    "H/O Diabetes": c.past_history_diabetes ? "Yes" : "No",
    "H/O Surgery/Hospitalization": c.past_history_surgery ? "Yes" : "No",
    "Surgery/Hospitalization Details": c.past_history_surgery_details,
    "H/O Infertility Treatment": c.past_history_infertility_treated ? "Yes" : "No",
    "Infertility Treatment Details": c.infertility_treatment_details,
    // History & Examination
    "Family History": c.family_history,
    "Personal History": c.personal_history,
    "General Physical Exam": c.general_physical_examination,
    "Investigations": c.investigations,
    "Exam: Per Abdomen": c.exam_per_abdomen,
    "Exam: Per Vaginal": c.exam_per_vaginal,
    // C-Section Details
    "C-Section Type": c.c_section_type,
    "C-Section Nature": c.c_section_nature,
    "Indication": c.c_section_indication,
    "Surgery Date/Time": c.surgery_date_time,
    "Anesthesia": c.anesthesia_type,
    "Intra-op Findings": c.intraoperative_findings,
    "Intra-op Complications": c.intraoperative_complications,
    // Maternal Outcomes
    "Maternal PPH": c.maternal_pph ? "Yes" : "No",
    "Maternal Blood Transfusion": c.maternal_blood_transfusion ? "Yes" : "No",
    "Maternal Wound Infection": c.maternal_wound_infection ? "Yes" : "No",
    "Maternal Puerperal Pyrexia": c.maternal_puerperal_pyrexia ? "Yes" : "No",
    "Maternal ICU Admission": c.maternal_icu_admission ? "Yes" : "No",
    "Maternal Stay (Days)": c.maternal_hospital_stay_days,
    "Maternal Morbidity": c.maternal_morbidity ? "Yes" : "No",
    "Maternal Morbidity Details": c.maternal_morbidity_details,
    "Maternal Mortality": c.maternal_mortality ? "Yes" : "No",
    // Neonatal Outcomes
    "Baby Count": c.neonatal_baby_count,
    "Sex of Baby": c.neonatal_sex,
    "Birth Weight (kg)": c.neonatal_birth_weight,
    "Apgar 1 min": c.neonatal_apgar_1min,
    "Apgar 5 min": c.neonatal_apgar_5min,
    "NICU Admission": c.neonatal_nicu_admission ? "Yes" : "No",
    "NICU Indication": c.neonatal_nicu_indication,
    "Neonatal Comp: RDS": c.neonatal_comp_rds ? "Yes" : "No",
    "Neonatal Comp: Sepsis": c.neonatal_comp_sepsis ? "Yes" : "No",
    "Neonatal Comp: Asphyxia": c.neonatal_comp_asphyxia ? "Yes" : "No",
    "Neonatal Comp: Others": c.neonatal_comp_others,
    "Early Neonatal Death": c.neonatal_early_death ? "Yes" : "No",
    // Master Clinical Notes
    "Additional Clinical Notes": c.additional_clinical_notes,
  }));

  const worksheet = XLSX.utils.json_to_sheet(formattedRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Thesis Cases");
  
  // Save file
  XLSX.writeFile(workbook, `LSCS_Thesis_Data_${new Date().toISOString().slice(0,10)}.xlsx`);
}
```

## Acceptance Criteria
- [ ] Clicking "Export to Excel" triggers download of a valid `.xlsx` spreadsheet matching all fields.
- [ ] Column headers are human-readable (not snake_case database keys).
- [ ] Excel cells containing booleans display "Yes" or "No" (or True/False) for readability.
- [ ] Clicking "Export to Word" downloads a styled `.docx` containing case summaries.
- [ ] Clicking "Print / Save PDF" opens the browser print preview.
- [ ] Print preview layout hides buttons, intake box, and scrollbars, styling the form as a clean medical case proforma sheet.

## SPSS Master Sheet Requirements
To ensure the output Excel sheet acts as a seamless **Master Sheet** for SPSS and R:
1. **Single Row per Case:** Every patient is represented by exactly one row.
2. **Fixed Columns:** The number of columns is completely fixed (matching the 50+ variables). No dynamic columns are created.
3. **SPSS-Friendly Coding (Boolean/Binary Variables):**
   - For all checkbox/boolean columns (e.g. HTN, PPH, Leaking p/v), we can configure the export to output `1` (for Yes/True) and `0` (for No/False), or clean `"Yes"` / `"No"` labels.
   - Categorical fields (like Booking Status, Anesthesia, Baby Count) will output standardized values (`booked`/`unbooked`, `spinal`/`general`, `singleton`/`multiple`) to prevent manual data-cleaning cycles.
4. **Blank values:** Missing values are exported as completely empty cells or standard `null` representation so SPSS detects them as system-missing values correctly.
