import requests

SUPABASE_URL = "https://ngwsuqzkndlxfoantnlf.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nd3N1cXprbmRseGZvYW50bmxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjA0NjAsImV4cCI6MjA5Mjc5NjQ2MH0.u9-dnMmLXr_5fF243uzx6WyE_vR6dzERDuyFuF-HeZk"

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}"
}

tables = ["mains_keywords", "mains_case_studies", "mains_sc_judgments", "mains_judgments", "mains_cases"]

for table in tables:
    url = f"{SUPABASE_URL}/rest/v1/{table}?select=count"
    r = requests.get(url, headers=headers)
    print(f"Table {table}: status {r.status_code}, response: {r.text}")
