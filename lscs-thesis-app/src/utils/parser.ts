/**
 * Normalizes input keys to match standard snake_case keys in our schema.
 * Handles spaces, dashes, camelCase, PascalCase, and capitalization.
 * E.g., "Patient Name", "patientName", "PATIENT_NAME" -> "patient_name"
 */
export function normalizeKey(key: string): string {
  // Convert camelCase to snake_case
  let normalized = key.replace(/([A-Z])/g, "_$1");
  
  normalized = normalized
    .toLowerCase()
    .trim()
    .replace(/[\s\-]+/g, "_")      // Replace spaces and hyphens with underscores
    .replace(/[^a-z0-9_]/g, "")    // Remove any other special characters
    .replace(/_+/g, "_");          // Deduplicate underscores
    
  // Strip leading/trailing underscores
  if (normalized.startsWith('_')) normalized = normalized.slice(1);
  if (normalized.endsWith('_')) normalized = normalized.slice(0, -1);
  
  // Custom exact overrides for abbreviations or variations
  const overrides: Record<string, string> = {
    'wo': 'wo_name',
    'wife_of': 'wo_name',
    'husband_name': 'wo_name',
    'date_of_admission': 'date_of_admission',
    'doa': 'date_of_admission',
    'admission_date': 'date_of_admission',
    'time_of_admission': 'time_of_admission',
    'toa': 'time_of_admission',
    'admission_time': 'time_of_admission',
    'date_of_delivery': 'date_of_delivery',
    'dod': 'date_of_delivery',
    'delivery_date': 'date_of_delivery',
    'time_of_delivery': 'time_of_delivery',
    'tod': 'time_of_delivery',
    'delivery_time': 'time_of_delivery',
    'booking_status': 'booking_status',
    'booked': 'booking_status',
    
    'labor_pains': 'complaint_labour_pains',
    'labour_pains': 'complaint_labour_pains',
    'leaking_pv': 'complaint_leaking_pv',
    'leaking': 'complaint_leaking_pv',
    'bleeding_pv': 'complaint_bleeding_pv',
    'bleeding': 'complaint_bleeding_pv',
    'headache': 'complaint_headache',
    'blurring_of_vision': 'complaint_blurring_vision',
    'epigastric_pain': 'complaint_epigastric_pain',
    'nausea': 'complaint_nausea',
    'vomiting': 'complaint_vomiting',
    'other_complaints': 'complaints_other',
    'complaints_other': 'complaints_other',
    
    'g': 'gravida',
    'p': 'para',
    'a': 'abortion',
    'l': 'living',
    'live': 'living',
    
    'previous_delivery_vaginal': 'prev_delivery_vaginal',
    'prev_delivery_vaginal': 'prev_delivery_vaginal',
    'previous_delivery_instrumental': 'prev_delivery_instrumental',
    'prev_delivery_instrumental': 'prev_delivery_instrumental',
    'previous_delivery_lscs': 'prev_delivery_lscs',
    'prev_delivery_lscs': 'prev_delivery_lscs',
    'previous_obstetric_complications': 'prev_obstetric_complications',
    'previous_obstetric_complications_details': 'prev_obstetric_complications_details',
    
    'gestation_period': 'gestation_weeks',
    'gestation_weeks': 'gestation_weeks',
    'period_of_gestation': 'gestation_weeks',
    
    'past_history_htn': 'past_history_htn',
    'htn': 'past_history_htn',
    'history_of_htn': 'past_history_htn',
    'tb': 'past_history_tb',
    'history_of_tb': 'past_history_tb',
    'asthma': 'past_history_asthma',
    'history_of_asthma': 'past_history_asthma',
    'epilepsy': 'past_history_epilepsy',
    'history_of_epilepsy': 'past_history_epilepsy',
    'heart_disease': 'past_history_heart_disease',
    'history_of_heart_disease': 'past_history_heart_disease',
    'diabetes': 'past_history_diabetes',
    'diabetes_mellitus': 'past_history_diabetes',
    'history_of_diabetes': 'past_history_diabetes',
    
    'surgery': 'past_history_surgery',
    'past_history_surgery': 'past_history_surgery',
    'hospitalization': 'past_history_surgery',
    'surgery_details': 'past_history_surgery_details',
    'past_history_surgery_details': 'past_history_surgery_details',
    
    'infertility_treated': 'past_history_infertility_treated',
    'past_history_infertility_treated': 'past_history_infertility_treated',
    'infertility_treatment_details': 'infertility_treatment_details',
    
    'csection_type': 'c_section_type',
    'type_of_caesarean': 'c_section_type',
    'caesarean_type': 'c_section_type',
    'nature_of_caesarean': 'c_section_nature',
    'csection_nature': 'c_section_nature',
    'indication_for_caesarean': 'c_section_indication',
    'csection_indication': 'c_section_indication',
    'surgery_date': 'date_of_delivery',
    'date_time_of_surgery': 'date_of_delivery',
    'anesthesia_type': 'anesthesia_type',
    'type_of_anesthesia': 'anesthesia_type',
    
    'postpartum_haemorrhage': 'maternal_pph',
    'pph': 'maternal_pph',
    'blood_transfusion': 'maternal_blood_transfusion',
    'wound_infection': 'maternal_wound_infection',
    'puerperal_pyrexia': 'maternal_puerperal_pyrexia',
    'icu_admission': 'maternal_icu_admission',
    'hospital_stay_days': 'maternal_hospital_stay_days',
    'duration_of_hospital_stay': 'maternal_hospital_stay_days',
    'morbidity': 'maternal_morbidity',
    'maternal_morbidity': 'maternal_morbidity',
    'morbidity_details': 'maternal_morbidity_details',
    'maternal_morbidity_details': 'maternal_morbidity_details',
    'mortality': 'maternal_mortality',
    'maternal_mortality': 'maternal_mortality',
    
    'number_of_babies': 'neonatal_baby_count',
    'baby_count': 'neonatal_baby_count',
    'sex_of_baby': 'neonatal_sex',
    'baby_sex': 'neonatal_sex',
    'birth_weight': 'neonatal_birth_weight',
    'nicu_admission': 'neonatal_nicu_admission',
    'nicu_indication': 'neonatal_nicu_indication',
    'neonatal_comp_rds': 'neonatal_comp_rds',
    'rds': 'neonatal_comp_rds',
    'neonatal_comp_sepsis': 'neonatal_comp_sepsis',
    'sepsis': 'neonatal_comp_sepsis',
    'neonatal_comp_asphyxia': 'neonatal_comp_asphyxia',
    'asphyxia': 'neonatal_comp_asphyxia',
    'neonatal_comp_others': 'neonatal_comp_others',
    'neonatal_complications_other': 'neonatal_comp_others',
    'early_neonatal_death': 'neonatal_early_death',
    'clinical_notes': 'additional_clinical_notes',
    'additional_clinical_notes': 'additional_clinical_notes'
  };

  return overrides[normalized] || normalized;
}

/**
 * Extracts and parses a JSON block out of raw string input.
 * Strips markdown and handles conversational wrappers.
 */
export function extractAndParseJSON(inputText: string): Record<string, any> | null {
  try {
    let cleaned = inputText.trim();

    // Remove markdown json markers
    cleaned = cleaned.replace(/```json/gi, '');
    cleaned = cleaned.replace(/```/g, '');
    cleaned = cleaned.trim();

    // Locate the first '{' and last '}' to handle conversational prefixes or suffixes
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }

    return JSON.parse(cleaned);
  } catch (error) {
    console.warn("Standard JSON parse failed, running clean sanitization...", error);
    try {
      // Clean typography quotes and common transcription noise
      let sanitized = inputText
        .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"') // Curly double quotes
        .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'"); // Curly single quotes
        
      const firstBrace = sanitized.indexOf('{');
      const lastBrace = sanitized.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        sanitized = sanitized.slice(firstBrace, lastBrace + 1);
      }
      
      return JSON.parse(sanitized);
    } catch (fallbackError) {
      console.error("Fuzzy JSON parsing failed completely", fallbackError);
      return null;
    }
  }
}

/**
 * Map arbitrary key-value pairs from parsed JSON into a clean state object matching CaseData
 */
export function mapParsedDataToCaseForm(parsedData: Record<string, any>, defaultCaseState: Record<string, any>): { mapped: Record<string, any>, count: number } {
  const result = { ...defaultCaseState };
  let matchCount = 0;

  // Flatten nested objects if AI nested outcomes or history
  const flatData: Record<string, any> = {};
  
  function flatten(obj: Record<string, any>, prefix = '') {
    Object.keys(obj).forEach((k) => {
      const val = obj[k];
      const flatKey = prefix ? `${prefix}_${k}` : k;
      if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        flatten(val, flatKey);
      } else {
        flatData[flatKey] = val;
      }
    });
  }
  
  flatten(parsedData);

  // Normalize all flat keys
  const normalizedFlatData: Record<string, any> = {};
  Object.keys(flatData).forEach((key) => {
    normalizedFlatData[normalizeKey(key)] = flatData[key];
  });

  // Map to target state
  Object.keys(defaultCaseState).forEach((targetKey) => {
    const normTarget = normalizeKey(targetKey);
    
    if (normalizedFlatData[normTarget] !== undefined) {
      const sourceValue = normalizedFlatData[normTarget];
      
      // Keep type integrity
      if (typeof defaultCaseState[targetKey] === 'boolean') {
        // Convert truthy indicators
        if (typeof sourceValue === 'boolean') {
          result[targetKey] = sourceValue;
        } else if (typeof sourceValue === 'string') {
          const lowerVal = sourceValue.toLowerCase();
          result[targetKey] = ['yes', 'true', '1', 'present', 'positive', 'y'].includes(lowerVal);
        } else if (typeof sourceValue === 'number') {
          result[targetKey] = sourceValue === 1;
        }
      } else {
        // Handle strings and numbers
        let val: any = sourceValue;
        if (val === null || val === undefined) {
          val = '';
        }
        
        // If target should be numeric, convert it
        if (typeof defaultCaseState[targetKey] === 'number') {
          if (val === '') {
            val = '';
          } else {
            const parsedNum = Number(val);
            val = isNaN(parsedNum) ? val : parsedNum;
          }
        } else {
          // Target is a string (e.g. textareas or dates)
          let strVal = String(val).trim();
          
          // If the AI output contains a combined datetime in date_of_admission or date_of_delivery
          if ((targetKey === 'date_of_admission' || targetKey === 'date_of_delivery') && strVal.includes('T')) {
            const [datePart, timePart] = strVal.split('T');
            strVal = datePart; // date field gets only the date part
            
            // If the time field is not already populated, extract it
            const timeKey = targetKey === 'date_of_admission' ? 'time_of_admission' : 'time_of_delivery';
            if (timePart && !result[timeKey]) {
              const cleanedTime = timePart.substring(0, 5); // take HH:MM
              // Only assign if it doesn't look like a fabricated default (e.g., "00:00")
              if (cleanedTime !== '00:00') {
                result[timeKey] = cleanedTime;
              }
            }
          }
          
          // For other date fields (LMP, EDD): always strip time
          const dateOnlyFields = ['lmp', 'edd'];
          if (dateOnlyFields.includes(targetKey) && strVal.includes('T')) {
            strVal = strVal.split('T')[0];
          }
          val = strVal;
        }
        
        result[targetKey] = val;
      }
      
      matchCount++;
    }
  });

  return { mapped: result, count: matchCount };
}
