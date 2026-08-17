import os
import re
import json
import glob

json_files = glob.glob(r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\**\*consolidated*.json", recursive=True)
json_files += glob.glob(r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\**\*gs*.json", recursive=True)

samples = []

for path in json_files:
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            data = json.load(f)

        # Traverse data to find any image URLs or markdown ![caption](url) tags
        def search_obj(obj, file_name):
            if isinstance(obj, str):
                if "pub-" in obj or ".r2.dev" in obj or "![" in obj or "<img" in obj:
                    matches = re.findall(r'!\[.*?\]\(.*?\)|https?://pub-[^\s"\'\`\>\)]+', obj)
                    for m in matches:
                        samples.append((file_name, obj[:150], m))
            elif isinstance(obj, dict):
                for k, v in obj.items():
                    search_obj(v, file_name)
            elif isinstance(obj, list):
                for item in obj:
                    search_obj(item, file_name)

        search_obj(data, os.path.basename(path))
    except Exception:
        pass

print("=== IMAGE LINK SAMPLES FROM GS JSON FILES ===")
seen = set()
for fname, context, match in samples:
    if match not in seen:
        seen.add(match)
        print(f"FILE: {fname}")
        print(f"  IMAGE TAG / URL: {match}")
        print("-" * 60)
