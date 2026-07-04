import os
import sys
import subprocess

def run_checks():
    print("Running Thesis Data Collector Verification Script...")
    
    # 1. Verify docs exist
    required_docs = [
        "data/docs/Project_Requirements.md",
        "data/docs/Coding_Guidelines.md",
        "data/docs/Database_Columns.md",
        "data/docs/issues/FR-001_Intake_Vault.md",
        "data/docs/issues/FR-002_Dual_Purpose_Form.md",
        "data/docs/issues/FR-003_Prompt_Generator.md",
        "data/docs/issues/FR-004_Supabase_Storage.md",
        "data/docs/issues/FR-005_Export_Module.md",
        "data/supabase/schema.sql"
    ]
    
    missing_docs = []
    for doc in required_docs:
        if not os.path.exists(doc):
            missing_docs.append(doc)
            
    if missing_docs:
        print("[FAIL] Verification Failed: Missing required files:")
        for doc in missing_docs:
            print(f"  - {doc}")
        sys.exit(1)
        
    print("[OK] All required documentation and schema files are present.")
    
    # 2. Check React/TypeScript compilation (if package.json exists)
    if os.path.exists("data/package.json"):
        print("[INFO] Found package.json. Running TypeScript check and production build...")
        try:
            # Check node modules
            if not os.path.exists("data/node_modules"):
                print("[INFO] Installing dependencies...")
                subprocess.run(["npm", "install"], cwd="data", check=True, shell=True)
            
            # Run build check
            print("[INFO] Running vite build check...")
            subprocess.run(["npm", "run", "build"], cwd="data", check=True, shell=True)
            
        except Exception as e:
            print(f"[FAIL] Build/Typecheck Verification Failed: {e}")
            sys.exit(1)
    else:
        print("[INFO] App is not scaffolded yet. Run /vibe-build to scaffold the project.")

    print("[SUCCESS] Verification Succeeded!")
    sys.exit(0)

if __name__ == "__main__":
    run_checks()
