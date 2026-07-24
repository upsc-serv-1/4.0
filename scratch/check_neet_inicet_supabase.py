import requests

SUPABASE_URL = "https://rnelxupyiejsqekmcrcz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Prefer": "count=exact"
}

# 1. Check NEET PG Questions
url_neet = f"{SUPABASE_URL}/rest/v1/questions?is_neetpg=eq.true&select=id,test_id,source"
resp_neet = requests.get(url_neet, headers=HEADERS)
neet_count = resp_neet.headers.get("content-range", "0/0").split("/")[-1]

# 2. Check INI-CET Questions
url_ini = f"{SUPABASE_URL}/rest/v1/questions?is_inicet=eq.true&select=id,test_id,source"
resp_ini = requests.get(url_ini, headers=HEADERS)
ini_count = resp_ini.headers.get("content-range", "0/0").split("/")[-1]

print(f"NEET PG count: {neet_count}")
print(f"INI-CET count: {ini_count}")

# 3. Check distinct institute names for NEET PG / INI-CET tests
# Let's query tests table for program_id = 'neet-pg' or 'ini-cet'
url_tests_neet = f"{SUPABASE_URL}/rest/v1/tests?program_id=eq.neet-pg&select=id,title,institute,course"
resp_t_neet = requests.get(url_tests_neet, headers=HEADERS)
t_neet_data = resp_t_neet.json() if resp_t_neet.status_code == 200 else []

url_tests_ini = f"{SUPABASE_URL}/rest/v1/tests?program_id=eq.ini-cet&select=id,title,institute,course"
resp_t_ini = requests.get(url_tests_ini, headers=HEADERS)
t_ini_data = resp_t_ini.json() if resp_t_ini.status_code == 200 else []

print("\nNEET PG Tests in Database:")
for t in t_neet_data:
    print(f"  - Title: {t.get('title')}, Institute: {t.get('institute')}, Course: {t.get('course')}")

print("\nINI-CET Tests in Database:")
for t in t_ini_data:
    print(f"  - Title: {t.get('title')}, Institute: {t.get('institute')}, Course: {t.get('course')}")
    
# Let's also check if there are other program_ids that contain neet or ini
url_all_tests = f"{SUPABASE_URL}/rest/v1/tests?select=id,title,program_id,institute,course&limit=1000"
resp_all = requests.get(url_all_tests, headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"})
if resp_all.status_code == 200:
    prog_inst = {}
    for t in resp_all.json():
        pid = t.get("program_id") or "None"
        inst = t.get("institute") or "None"
        if "neet" in pid.lower() or "ini" in pid.lower() or "cms" in pid.lower():
            prog_inst[pid] = prog_inst.get(pid, set())
            prog_inst[pid].add(inst)
            
    print("\nProgram ID to Institute mapping (CMS/NEET/INI):")
    for pid, insts in prog_inst.items():
        print(f"  - {pid}: {list(insts)}")
