import os
import json

def compare_file(name):
    path_local = os.path.join("mains json files", name)
    path_admin = os.path.join("admin-panel", "mains-json", name)
    
    if not os.path.exists(path_local):
        print(f"Local file {path_local} does not exist.")
        return
    if not os.path.exists(path_admin):
        print(f"Admin file {path_admin} does not exist.")
        return
        
    try:
        with open(path_local, "r", encoding="utf-8") as f:
            data_local = json.load(f)
    except Exception as e:
        print(f"Error reading local {name}: {e}")
        return
        
    try:
        with open(path_admin, "r", encoding="utf-8") as f:
            data_admin = json.load(f)
    except Exception as e:
        print(f"Error reading admin {name}: {e}")
        return
        
    print(f"\n--- Comparing {name} ---")
    print(f"  Local items: {len(data_local)}, Admin items: {len(data_admin)}")
    
    if len(data_local) > 0 and len(data_admin) > 0:
        local_keys = set(data_local[0].keys())
        admin_keys = set(data_admin[0].keys())
        print(f"  Local keys: {sorted(list(local_keys))}")
        print(f"  Admin keys: {sorted(list(admin_keys))}")
        if local_keys != admin_keys:
            print(f"  [MISMATCH] Keys differ!")
            print(f"    Only in Local: {local_keys - admin_keys}")
            print(f"    Only in Admin: {admin_keys - local_keys}")
        else:
            print(f"  [OK] Keys match exactly.")
            
compare_file("mains_data_facts.json")
compare_file("mains_ethics_value_add.json")
compare_file("mains_keywords.json")
compare_file("mains_mnemonics.json")
compare_file("mains_intro_conclusions.json")
compare_file("mains_frameworks.json")
compare_file("mains_essay_value_add.json")
