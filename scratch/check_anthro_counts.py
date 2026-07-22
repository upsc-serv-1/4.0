import requests

SUPABASE_URL = "https://rnelxupyiejsqekmcrcz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Prefer": "count=exact"
}

# Fetch all Anthropology rows using pagination
all_rows = []
from_idx = 0
page_size = 1000

while True:
    url_page = f"{SUPABASE_URL}/rest/v1/mains_questions?subject=ilike.Anthropology&select=id,section_group,exam_year&limit={page_size}&offset={from_idx}"
    resp_page = requests.get(url_page, headers=HEADERS)
    if resp_page.status_code != 200:
        break
    data = resp_page.json()
    if not data:
        break
    all_rows.extend(data)
    if len(data) < page_size:
        break
    from_idx += page_size

print(f"Total Anthropology questions in new Supabase: {len(all_rows)}")

p1_post2012 = 0
p2_post2012 = 0
p1_pre2012 = 0
p2_pre2012 = 0
other = 0

for r in all_rows:
    sg = str(r.get("section_group", "")).lower()
    yr = r.get("exam_year") or 0
    
    is_p1 = "paper i" in sg or "paper 1" in sg
    is_p2 = "paper ii" in sg or "paper 2" in sg
    
    if is_p1:
        if yr >= 2013:
            p1_post2012 += 1
        else:
            p1_pre2012 += 1
    elif is_p2:
        if yr >= 2013:
            p2_post2012 += 1
        else:
            p2_pre2012 += 1
    else:
        other += 1

print(f"  Paper 1 (Post-2012): {p1_post2012}")
print(f"  Paper 2 (Post-2012): {p2_post2012}")
print(f"  Paper 1 (Pre-2012):  {p1_pre2012}")
print(f"  Paper 2 (Pre-2012):  {p2_pre2012}")
if other > 0:
    print(f"  Other: {other}")
