import requests

SUPABASE_URL = "https://ngwsuqzkndlxfoantnlf.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nd3N1cXprbmRseGZvYW50bmxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjA0NjAsImV4cCI6MjA5Mjc5NjQ2MH0.u9-dnMmLXr_5fF243uzx6WyE_vR6dzERDuyFuF-HeZk"

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}"
}

# Fetch count of keyword type ethics value additions having core_values equal to philosophy, dilemma, phrase
for cv in ["philosophy", "dilemma", "phrase"]:
    url = f"{SUPABASE_URL}/rest/v1/mains_ethics_value_add?core_values=eq.{cv}&status=eq.published&select=count"
    r = requests.get(url, headers=headers)
    print(f"core_values={cv} count: {r.text}")
