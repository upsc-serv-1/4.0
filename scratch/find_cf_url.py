import os
import re

search_dirs = [
    r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2",
    r"C:\Users\Dr. Yogesh\.gemini\antigravity\brain\a8bde197-2e38-424a-91d4-660307053893"
]

found = set()

for s_dir in search_dirs:
    for root, dirs, files in os.walk(s_dir):
        if ".git" in root or "node_modules" in root or ".next" in root:
            continue
        for file in files:
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()

                urls = re.findall(r'https?://[^\s"\'\`\>\)]+', content)
                for u in urls:
                    u_clean = u.rstrip(".,;")
                    u_low = u_clean.lower()
                    if any(k in u_low for k in ["r2", "cloudflare", "pub-", "workers.dev", "r2.dev"]):
                        found.add((file, u_clean))
            except Exception:
                pass

print("=== CLOUDFLARE URLS FOUND ===")
for filename, url in sorted(found):
    print(f"{filename} -> {url}")
