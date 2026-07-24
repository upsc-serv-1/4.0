"""
One-time cleanup script:
1. Wipe wrongly-placed keywords/case studies/judgments from mains_ethics_value_add
2. Re-sync ethics-only content to mains_ethics_value_add
3. Upload keywords → mains_keywords
4. Upload case studies → mains_case_studies
5. Upload SC judgments → mains_sc_judgments
"""
import os
import json
import requests
import time

def load_env():
    env_vars = {}
    if os.path.exists(".env"):
        with open(".env", "r", encoding="utf-8") as f:
            for line in f:
                if "=" in line and not line.strip().startswith("#"):
                    k, v = line.strip().split("=", 1)
                    env_vars[k.strip()] = v.strip().strip('"').strip("'")
    return env_vars

env = load_env()
SUPABASE_URL = env.get("EXPO_PUBLIC_SUPABASE_URL") or "https://rnelxupyiejsqekmcrcz.supabase.co"
SUPABASE_KEY = env.get("EXPO_PUBLIC_SUPABASE_ANON_KEY") or "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ"
JSON_DIR = "mains json files"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

def delete_all(table_name):
    """Delete all rows from a table via REST API (filter id != 'x' matches everything)."""
    url = f"{SUPABASE_URL}/rest/v1/{table_name}?id=neq.00000000-0000-0000-0000-000000000000"
    resp = requests.delete(url, headers={**HEADERS, "Prefer": "return=minimal"}, timeout=60)
    if resp.status_code in [200, 204]:
        print(f"  [WIPED] Cleared {table_name}")
    else:
        print(f"  [ERROR] Could not wipe {table_name}: {resp.status_code} {resp.text}")

def upload_batch(table_name, rows):
    url = f"{SUPABASE_URL}/rest/v1/{table_name}"
    batch_size = 50
    success_count = 0
    cleaned_rows = []
    seen_ids = set()
    for r in rows:
        c_row = r.copy()
        c_row.pop("ethicsData", None)
        c_row.pop("ethics_data", None)
        c_row["status"] = "published"
        
        # Prevent "ON CONFLICT DO UPDATE command cannot affect row a second time" error by skipping duplicates in same request
        row_id = c_row.get("id")
        if row_id:
            if row_id in seen_ids:
                continue
            seen_ids.add(row_id)
            
        cleaned_rows.append(c_row)

    for i in range(0, len(cleaned_rows), batch_size):
        batch = cleaned_rows[i:i+batch_size]
        all_keys = set()
        for r in batch:
            all_keys.update(r.keys())
        padded_batch = [{k: r.get(k, None) for k in all_keys} for r in batch]

        success = False
        for attempt in range(5):
            try:
                resp = requests.post(url, json=padded_batch, headers=HEADERS, timeout=60)
                if resp.status_code in [200, 201]:
                    success_count += len(batch)
                    success = True
                    break
                else:
                    print(f"  [WARNING] {table_name} batch {i}: {resp.status_code}: {resp.text[:200]}. Retry {attempt+1}/5...")
                    time.sleep(5)
            except Exception as e:
                print(f"  [RETRY] Attempt {attempt+1}/5 failed: {e}. Retrying...")
                time.sleep(5)

        if not success:
            print(f"  [FATAL] Failed batch {i} after 5 attempts.")

    print(f"  [SUCCESS] Uploaded {success_count}/{len(rows)} rows to {table_name}")
    time.sleep(0.05)

def main():
    print("=" * 60)
    print("CLEANUP: Moving data to proper dedicated tables")
    print("=" * 60)

    # Step 1: Wipe mains_ethics_value_add entirely (it has polluted rows)
    print("\n[1] Wiping mains_ethics_value_add (will re-upload clean ethics)...")
    delete_all("mains_ethics_value_add")
    
    # Step 2: Wipe the 3 new tables (fresh start)
    print("\n[2] Wiping new tables (fresh start)...")
    delete_all("mains_keywords")
    delete_all("mains_case_studies")
    delete_all("mains_sc_judgments")

    # Step 3: Re-upload clean ethics only
    print("\n[3] Re-uploading clean Ethics cards (GS4 only)...")
    ethics_path = os.path.join(JSON_DIR, "mains_ethics_value_add.json")
    with open(ethics_path, "r", encoding="utf-8") as f:
        ethics_rows = json.load(f)
    print(f"  Ethics cards: {len(ethics_rows)}")
    upload_batch("mains_ethics_value_add", ethics_rows)

    # Step 4: Upload Keywords to mains_keywords
    print("\n[4] Uploading Keywords to mains_keywords...")
    kw_path = os.path.join(JSON_DIR, "mains_keywords.json")
    with open(kw_path, "r", encoding="utf-8") as f:
        kw_rows = json.load(f)
    print(f"  Keywords: {len(kw_rows)}")
    upload_batch("mains_keywords", kw_rows)

    # Step 5: Upload Case Studies to mains_case_studies
    print("\n[5] Uploading Case Studies to mains_case_studies...")
    cs_path = os.path.join(JSON_DIR, "mains_case_studies.json")
    with open(cs_path, "r", encoding="utf-8") as f:
        cs_rows = json.load(f)
    print(f"  Case Studies: {len(cs_rows)}")
    upload_batch("mains_case_studies", cs_rows)

    # Step 6: Upload SC Judgments to mains_sc_judgments
    print("\n[6] Uploading SC Judgments to mains_sc_judgments...")
    jd_path = os.path.join(JSON_DIR, "mains_sc_judgments.json")
    with open(jd_path, "r", encoding="utf-8") as f:
        jd_rows = json.load(f)
    print(f"  SC Judgments: {len(jd_rows)}")
    upload_batch("mains_sc_judgments", jd_rows)

    print("\n" + "=" * 60)
    print("CLEANUP COMPLETE. All data now in proper tables.")
    print(f"  mains_ethics_value_add: {len(ethics_rows)} rows (pure GS4 ethics)")
    print(f"  mains_keywords:         {len(kw_rows)} rows")
    print(f"  mains_case_studies:     {len(cs_rows)} rows")
    print(f"  mains_sc_judgments:     {len(jd_rows)} rows")
    print("=" * 60)

if __name__ == "__main__":
    main()
