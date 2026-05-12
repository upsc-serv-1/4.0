import os
import sys
import re

def verify_responsiveness():
    print("🔍 Starting Responsive Standards Audit...")
    errors = 0
    warnings = 0
    
    app_dir = "./app"
    src_dir = "./src"
    
    # Check directories
    if not os.path.exists(app_dir) or not os.path.exists(src_dir):
        print("❌ Error: Source or App directories not found.")
        sys.exit(1)
        
    # Verification patterns
    patterns = {
        r"Dimensions\.get\('window'\)\.width": "Warning: Found raw Dimensions.get call. Prefer using useResponsive() or useWindowDimensions() hook.",
        r"fontSize:\s*[3-9]\d\s*(?!,\s*font)": "Warning: Found large hardcoded fontSize. Check if scaling for small phones (FR-005) is implemented.",
        r"justifyContent:\s*'flex-end'": "Notice: Potential sheet/modal styling. Ensure conditional centering for tablets is configured (FR-004)."
    }
    
    for root, _, files in os.walk(src_dir):
        for file in files:
            if file.endswith((".tsx", ".ts")):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        for pattern, msg in patterns.items():
                            matches = re.findall(pattern, content)
                            if matches:
                                print(f"⚠️ [{file}] {msg}")
                                warnings += 1
                except Exception as e:
                    pass

    print("\n--- 📊 Audit Results ---")
    print(f"Total Warnings: {warnings}")
    print(f"Total Errors: {errors}")
    
    if errors > 0:
        print("❌ Verification failed.")
        sys.exit(1)
    else:
        print("✅ Verification check passed. Review warnings above to align layouts.")
        sys.exit(0)

if __name__ == "__main__":
    verify_responsiveness()
