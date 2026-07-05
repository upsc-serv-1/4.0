# [FR-004] Supabase Storage

## Labels
`MUS`, `enhancement`, `database`

## User Story
As a clinical researcher, I want my submitted cases to be saved directly to individual columns in a Supabase database, so that my data is permanently stored, searchable, and structured correctly for analysis.

## Proposed Solution

### Overview
We will create a database helper (`src/supabaseClient.ts`) to configure and initialize the Supabase JS client. We will implement CRUD operations to save case forms, retrieve the log of all saved cases, and edit or delete records.

### Implementation Flow
1. Load Supabase URL and Anon Key from environment variables (fallback to manual prompt/input in UI if config is empty).
2. Write a SQL DDL migration schema file to create the `lscs_thesis_cases` table.
3. Build database hook functions in React (`saveCase`, `fetchCases`, `deleteCase`).
4. Handle transaction loading indicators and network error conditions gracefully, displaying clear messages if connection is lost.
5. Setup database column level conversions (e.g., parsing empty strings to `null` or 0, converting boolean representation, formatting dates for PostgreSQL compatibility).

### Technical Approach

```typescript
// src/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function saveCaseToSupabase(caseData: Record<string, any>) {
  // Map fields & replace empty inputs
  const cleanedData = { ...caseData };
  Object.keys(cleanedData).forEach((key) => {
    if (cleanedData[key] === '') {
      cleanedData[key] = null; // Save blank inputs as NULL in SQL
    }
  });

  const { id, ...dataToSave } = cleanedData;

  if (id) {
    // Update existing case
    const { data, error } = await supabase
      .from('lscs_thesis_cases')
      .update(dataToSave)
      .eq('id', id)
      .select();
    if (error) throw error;
    return data;
  } else {
    // Insert new case
    const { data, error } = await supabase
      .from('lscs_thesis_cases')
      .insert([dataToSave])
      .select();
    if (error) throw error;
    return data;
  }
}
```

## Acceptance Criteria
- [ ] Supabase connection is established on mount.
- [ ] Saving a form writes a new row to the table with correct columns.
- [ ] Primary key UUID is generated automatically.
- [ ] Blank numbers/text fields are stored as `null` in the database to avoid type collisions.
- [ ] Existing records can be loaded back into the form for editing.
- [ ] Error messages are captured and displayed in a user-friendly modal/toast instead of blocking the application.
