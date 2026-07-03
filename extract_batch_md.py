import os
import subprocess
import sys

def main():
    downloads_dir = r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop"
    workspace_dir = r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2"
    
    booklets = [f"CSM26T{i:02d}SE" for i in range(2, 16)]
    
    print(f"Starting batch extraction to MD for booklets: {booklets}\n")
    
    for booklet in booklets:
        pdf_name = f"Forum MGP {booklet} Examstatic.com.pdf"
        pdf_path = os.path.join(downloads_dir, pdf_name)
        
        if not os.path.exists(pdf_path):
            print(f"[-] PDF not found: {pdf_path}. Skipping.")
            continue
            
        print(f"[*] Extracting MD for {booklet}...")
        extract_cmd = ["python", "extract_forum_mgp.py", pdf_path]
        res_extract = subprocess.run(extract_cmd, cwd=workspace_dir)
        
        if res_extract.returncode != 0:
            print(f"[-] Extraction failed for {booklet}!")
        else:
            print(f"[+] Successfully extracted {booklet} to MD!")
            
    print("\nBatch MD extraction completed successfully!")

if __name__ == "__main__":
    main()
