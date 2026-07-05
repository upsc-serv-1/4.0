import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType } from 'docx';

function formatExportDate(dateStr: string | null | undefined, includeTimeIfPresent = true) {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('T');
    const hasTime = parts.length > 1 && parts[1] !== '' && !/^00:00(:\d{2})?$/.test(parts[1]);
    const pureDateStr = parts[0].trim();
    
    if (!hasTime && /^\d{4}-\d{2}-\d{2}$/.test(pureDateStr)) {
      const [year, month, day] = pureDateStr.split('-');
      const date = new Date(Number(year), Number(month) - 1, Number(day));
      return date.toLocaleDateString('en-US', { dateStyle: 'medium' });
    }
    
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    
    if (includeTimeIfPresent && hasTime) {
      return d.toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    } else {
      return d.toLocaleDateString('en-US', { dateStyle: 'medium' });
    }
  } catch {
    return dateStr;
  }
}

// --------------------------------------------------
// 1. EXCEL MASTER SHEET EXPORT
// --------------------------------------------------
export function exportToExcel(cases: Record<string, any>[]) {
  // Map database keys to descriptive, human-readable headers
  const formattedRows = cases.map((c) => ({
    "ID": c.id,
    "Date Created": c.created_at ? formatExportDate(c.created_at) : '',
    "Case No": c.case_no || '',
    "Reg No": c.reg_no || '',
    "Patient Name": c.patient_name || '',
    "W/O (Wife of) Name": c.wo_name || '',
    "Age (Years)": c.age !== null && c.age !== undefined ? c.age : '',
    "Religion": c.religion || '',
    "Residence": c.residence || '',
    "Date of Admission (DOA)": formatExportDate(c.date_of_admission, false),
    "Time of Admission (TOA)": c.time_of_admission || '',
    "Date of Delivery (DOD)": formatExportDate(c.date_of_delivery, false),
    "Time of Delivery (TOD)": c.time_of_delivery || '',
    "Booking Status": c.booking_status || 'unbooked',
    
    // Presenting Complaints
    "Complaint: Labour Pains": c.complaint_labour_pains ? "Yes" : "No",
    "Complaint: Leaking p/v": c.complaint_leaking_pv ? "Yes" : "No",
    "Complaint: Bleeding p/v": c.complaint_bleeding_pv ? "Yes" : "No",
    "Complaint: Headache": c.complaint_headache ? "Yes" : "No",
    "Complaint: Blurring of Vision": c.complaint_blurring_vision ? "Yes" : "No",
    "Complaint: Epigastric Pain": c.complaint_epigastric_pain ? "Yes" : "No",
    "Complaint: Nausea": c.complaint_nausea ? "Yes" : "No",
    "Complaint: Vomiting": c.complaint_vomiting ? "Yes" : "No",
    "Complaint: Other Details": c.complaints_other || '',
    
    // Obstetric History
    "Gravida (G)": c.gravida !== null && c.gravida !== undefined ? c.gravida : '',
    "Para (P)": c.para !== null && c.para !== undefined ? c.para : '',
    "Abortion (A)": c.abortion !== null && c.abortion !== undefined ? c.abortion : '',
    "Living (L)": c.living !== null && c.living !== undefined ? c.living : '',
    "Previous Pregnancy Details": c.prev_pregnancy_details || '',
    "Prev Delivery: Vaginal": c.prev_delivery_vaginal ? "Yes" : "No",
    "Prev Delivery: Instrumental": c.prev_delivery_instrumental ? "Yes" : "No",
    "Prev Delivery: LSCS": c.prev_delivery_lscs ? "Yes" : "No",
    "Prev Obstetric Complications": c.prev_obstetric_complications ? "Yes" : "No",
    "Prev Obstetric Complications Details": c.prev_obstetric_complications_details || '',
    
    // Menstrual History
    "LMP": formatExportDate(c.lmp, false),
    "EDD": formatExportDate(c.edd, false),
    "Gestation Period (Weeks)": c.gestation_weeks !== null && c.gestation_weeks !== undefined ? c.gestation_weeks : '',
    "Menstrual History Details": c.menstrual_history_details || '',
    
    // Past Medical History
    "H/O Hypertension (HTN)": c.past_history_htn ? "Yes" : "No",
    "H/O Tuberculosis (TB)": c.past_history_tb ? "Yes" : "No",
    "H/O Asthma": c.past_history_asthma ? "Yes" : "No",
    "H/O Epilepsy": c.past_history_epilepsy ? "Yes" : "No",
    "H/O Heart Disease": c.past_history_heart_disease ? "Yes" : "No",
    "H/O Diabetes": c.past_history_diabetes ? "Yes" : "No",
    "H/O Surgery/Hospitalization": c.past_history_surgery ? "Yes" : "No",
    "Surgery/Hospitalization Details": c.past_history_surgery_details || '',
    "H/O Infertility Treatment": c.past_history_infertility_treated ? "Yes" : "No",
    "Infertility Treatment Details": c.infertility_treatment_details || '',
    
    // History & Exam
    "Family History": c.family_history || '',
    "Personal History": c.personal_history || '',
    "General Physical Examination": c.general_physical_examination || '',
    "Obstetric Exam: Per Abdomen (PA)": c.exam_per_abdomen || '',
    "Obstetric Exam: Per Vaginal (PV)": c.exam_per_vaginal || '',
    "Investigations": c.investigations || '',
    
    // C-Section Details
    "C-Section Type": c.c_section_type || 'Primary LSCS',
    "C-Section Nature": c.c_section_nature || '',
    "C-Section Indication": c.c_section_indication || '',
    "Anesthesia Type": c.anesthesia_type || '',
    "Intra-operative Findings": c.intraoperative_findings || '',
    "Intra-operative Complications": c.intraoperative_complications || '',
    
    // Maternal Outcome
    "Maternal: PPH": c.maternal_pph ? "Yes" : "No",
    "Maternal: Blood Transfusion": c.maternal_blood_transfusion ? "Yes" : "No",
    "Maternal: Wound Infection": c.maternal_wound_infection ? "Yes" : "No",
    "Maternal: Puerperal Pyrexia": c.maternal_puerperal_pyrexia ? "Yes" : "No",
    "Maternal: ICU Admission": c.maternal_icu_admission ? "Yes" : "No",
    "Maternal: Hospital Stay (Days)": c.maternal_hospital_stay_days !== null && c.maternal_hospital_stay_days !== undefined ? c.maternal_hospital_stay_days : '',
    "Maternal: Morbidity": c.maternal_morbidity ? "Yes" : "No",
    "Maternal: Morbidity Details": c.maternal_morbidity_details || '',
    "Maternal: Mortality": c.maternal_mortality ? "Yes" : "No",
    
    // Neonatal Outcome
    "Neonatal: Baby Count": c.neonatal_baby_count || '',
    "Neonatal: Sex of Baby": c.neonatal_sex || '',
    "Neonatal: Birth Weight (kg)": c.neonatal_birth_weight !== null && c.neonatal_birth_weight !== undefined ? c.neonatal_birth_weight : '',
    "Neonatal: Apgar score 1 min": c.neonatal_apgar_1min !== null && c.neonatal_apgar_1min !== undefined ? c.neonatal_apgar_1min : '',
    "Neonatal: Apgar score 5 min": c.neonatal_apgar_5min !== null && c.neonatal_apgar_5min !== undefined ? c.neonatal_apgar_5min : '',
    "Neonatal: NICU Admission": c.neonatal_nicu_admission ? "Yes" : "No",
    "Neonatal: NICU Indication": c.neonatal_nicu_indication || '',
    "Neonatal: Complication RDS": c.neonatal_comp_rds ? "Yes" : "No",
    "Neonatal: Complication Sepsis": c.neonatal_comp_sepsis ? "Yes" : "No",
    "Neonatal: Complication Asphyxia": c.neonatal_comp_asphyxia ? "Yes" : "No",
    "Neonatal: Complication Others": c.neonatal_comp_others || '',
    "Neonatal: Early Death": c.neonatal_early_death ? "Yes" : "No",
    
    // Master Notes
    "Additional Clinical Notes": c.additional_clinical_notes || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(formattedRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "LSCS Thesis Database");
  
  // Set column widths automatically
  const maxWds = formattedRows.reduce((acc, row) => {
    Object.keys(row).forEach((key, idx) => {
      const valStr = String((row as any)[key]);
      const length = Math.max(valStr.length, key.length);
      acc[idx] = Math.max(acc[idx] || 10, length);
    });
    return acc;
  }, [] as number[]);
  
  worksheet['!cols'] = maxWds.map((w) => ({ wch: w + 2 }));

  XLSX.writeFile(workbook, `LSCS_Thesis_MasterSheet_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// --------------------------------------------------
// 2. WORD DOCUMENT EXPORT (.docx)
// --------------------------------------------------
export function exportToWord(cases: Record<string, any>[]) {
  const borderStyle = { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" };

  const docSections = cases.map((c, index) => {
    // Generate text summaries for each patient case

    return {
      properties: {},
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: `CASE REPORT ${index + 1}: ${c.patient_name || 'Anonymous Patient'} (Case No: ${c.case_no || 'N/A'}, Reg No: ${c.reg_no || 'N/A'})`,
              bold: true,
              size: 28,
              color: "1A365D",
            }),
          ],
          spacing: { before: 200, after: 120 },
        }),
        
        // Structured Key-Value Table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            // Row 1: Demographics
            new TableRow({
              children: [
                createCell("Age", "7A869A", true),
                createCell(`${c.age || 'N/A'} years`, "FFFFFF", false),
                createCell("W/O Name", "7A869A", true),
                createCell(`${c.wo_name || 'N/A'}`, "FFFFFF", false),
              ],
            }),
            new TableRow({
              children: [
                createCell("DOA", "7A869A", true),
                createCell(c.time_of_admission ? `${formatExportDate(c.date_of_admission, false)} ${c.time_of_admission}` : formatExportDate(c.date_of_admission, false), "FFFFFF", false),
                createCell("DOD", "7A869A", true),
                createCell(c.time_of_delivery ? `${formatExportDate(c.date_of_delivery, false)} ${c.time_of_delivery}` : formatExportDate(c.date_of_delivery, false), "FFFFFF", false),
              ],
            }),
            new TableRow({
              children: [
                createCell("Booking Status", "7A869A", true),
                createCell(`${c.booking_status ? c.booking_status.toUpperCase() : 'UNBOOKED'}`, "FFFFFF", false),
                createCell("Residence", "7A869A", true),
                createCell(`${c.residence || 'N/A'}`, "FFFFFF", false),
              ],
            }),
            // Row 2: Obstetric
            new TableRow({
              children: [
                createCell("GPAL Status", "7A869A", true),
                createCell(`G:${c.gravida || 0} P:${c.para || 0} A:${c.abortion || 0} L:${c.living || 0}`, "FFFFFF", false),
                createCell("Gestation Weeks", "7A869A", true),
                createCell(`${c.gestation_weeks || 'N/A'} weeks`, "FFFFFF", false),
              ],
            }),
            // Row 3: Surgery & Indication
            new TableRow({
              children: [
                createCell("C-Section Nature", "7A869A", true),
                createCell(`${c.c_section_nature ? c.c_section_nature.toUpperCase() : 'N/A'}`, "FFFFFF", false),
                createCell("Indication", "7A869A", true),
                createCell(`${c.c_section_indication || 'N/A'}`, "FFFFFF", false),
              ],
            }),
            new TableRow({
              children: [
                createCell("Anesthesia", "7A869A", true),
                createCell(`${c.anesthesia_type ? c.anesthesia_type.toUpperCase() : 'N/A'}`, "FFFFFF", false),
                createCell("Maternal Stay", "7A869A", true),
                createCell(`${c.maternal_hospital_stay_days || 'N/A'} days`, "FFFFFF", false),
              ],
            }),
            // Row 4: Neonatal
            new TableRow({
              children: [
                createCell("Baby Details", "7A869A", true),
                createCell(`${c.neonatal_baby_count ? c.neonatal_baby_count.toUpperCase() : 'SINGLETON'} / ${c.neonatal_sex ? c.neonatal_sex.toUpperCase() : 'N/A'}`, "FFFFFF", false),
                createCell("Birth Weight", "7A869A", true),
                createCell(`${c.neonatal_birth_weight || 'N/A'} kg`, "FFFFFF", false),
              ],
            }),
            new TableRow({
              children: [
                createCell("Apgar 1m / 5m", "7A869A", true),
                createCell(`1 min: ${c.neonatal_apgar_1min || 'N/A'} / 5 min: ${c.neonatal_apgar_5min || 'N/A'}`, "FFFFFF", false),
                createCell("NICU Admission", "7A869A", true),
                createCell(c.neonatal_nicu_admission ? `Yes (${c.neonatal_nicu_indication || 'No Indication'})` : "No", "FFFFFF", false),
              ],
            }),
          ],
        }),
        
        new Paragraph({
          children: [
            new TextRun({ text: "Presenting Complaints: ", bold: true, color: "4A5568" }),
            new TextRun({
              text: [
                c.complaint_labour_pains && "Labour Pains",
                c.complaint_leaking_pv && "Leaking p/v",
                c.complaint_bleeding_pv && "Bleeding p/v",
                c.complaint_headache && "Headache",
                c.complaint_blurring_vision && "Blurring of Vision",
                c.complaint_epigastric_pain && "Epigastric Pain",
                c.complaint_nausea && "Nausea",
                c.complaint_vomiting && "Vomiting",
                c.complaints_other && `Others (${c.complaints_other})`
              ].filter(Boolean).join(", ") || "None recorded"
            })
          ],
          spacing: { before: 100, after: 60 }
        }),

        new Paragraph({
          children: [
            new TextRun({ text: "Past Medical History: ", bold: true, color: "4A5568" }),
            new TextRun({
              text: [
                c.past_history_htn && "Hypertension (HTN)",
                c.past_history_tb && "Tuberculosis (TB)",
                c.past_history_asthma && "Asthma",
                c.past_history_epilepsy && "Epilepsy",
                c.past_history_heart_disease && "Heart Disease",
                c.past_history_diabetes && "Diabetes Mellitus",
                c.past_history_surgery && `Surgery/Hospitalization (${c.past_history_surgery_details || 'No Details'})`,
                c.past_history_infertility_treated && `Infertility Treatment (${c.infertility_treatment_details || 'No Details'})`
              ].filter(Boolean).join(", ") || "No significant medical history recorded"
            })
          ],
          spacing: { before: 60, after: 60 }
        }),

        new Paragraph({
          children: [
            new TextRun({ text: "Examinations & Investigations: ", bold: true, color: "4A5568" }),
            new TextRun({
              text: `Physical: ${c.general_physical_examination || 'N/A'} | PA: ${c.exam_per_abdomen || 'N/A'} | PV: ${c.exam_per_vaginal || 'N/A'} | Lab: ${c.investigations || 'N/A'}`
            })
          ],
          spacing: { before: 60, after: 60 }
        }),

        new Paragraph({
          children: [
            new TextRun({ text: "Maternal Outcomes: ", bold: true, color: "4A5568" }),
            new TextRun({
              text: [
                c.maternal_pph && "Postpartum Haemorrhage (PPH)",
                c.maternal_blood_transfusion && "Blood Transfusion Required",
                c.maternal_wound_infection && "Wound Infection",
                c.maternal_puerperal_pyrexia && "Puerperal Pyrexia",
                c.maternal_icu_admission && "ICU Admission Required",
                c.maternal_morbidity && `Maternal Morbidity (${c.maternal_morbidity_details || 'No details'})`,
                c.maternal_mortality && "Maternal Mortality (DEATH)"
              ].filter(Boolean).join(", ") || "Uneventful maternal outcome"
            })
          ],
          spacing: { before: 60, after: 60 }
        }),

        new Paragraph({
          children: [
            new TextRun({ text: "Neonatal Outcomes: ", bold: true, color: "4A5568" }),
            new TextRun({
              text: [
                c.neonatal_comp_rds && "Respiratory Distress Syndrome (RDS)",
                c.neonatal_comp_sepsis && "Neonatal Sepsis",
                c.neonatal_comp_asphyxia && "Birth Asphyxia",
                c.neonatal_comp_others && `Other Neonatal Complications (${c.neonatal_comp_others})`,
                c.neonatal_early_death && "Early Neonatal Death"
              ].filter(Boolean).join(", ") || "Healthy baby, no complications"
            })
          ],
          spacing: { before: 60, after: 60 }
        }),

        c.additional_clinical_notes ? new Paragraph({
          children: [
            new TextRun({ text: "Additional Clinical Notes: ", bold: true, color: "4A5568" }),
            new TextRun({ text: c.additional_clinical_notes, italics: true })
          ],
          spacing: { before: 60, after: 120 }
        }) : new Paragraph({ text: "" }),
        
        // Page break between reports
        new Paragraph({
          children: [new TextRun("")],
          pageBreakBefore: true
        })
      ]
    };
  });

  // Helper cell builder
  function createCell(text: string, bgColor: string, bold: boolean) {
    return new TableCell({
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text,
              bold,
              color: bgColor === "7A869A" ? "FFFFFF" : "000000",
              size: 18,
            }),
          ],
          alignment: AlignmentType.LEFT,
        }),
      ],
      shading: { fill: bgColor },
      margins: { top: 80, bottom: 80, left: 100, right: 100 },
      borders: {
        top: borderStyle,
        bottom: borderStyle,
        left: borderStyle,
        right: borderStyle,
      },
    });
  }

  // Create document
  const doc = new Document({
    sections: docSections
  });

  Packer.toBlob(doc).then((blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `LSCS_Thesis_Report_${new Date().toISOString().slice(0, 10)}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
}
