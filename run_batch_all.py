import os
import subprocess
import sys

def main():
    downloads_dir = r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop"
    workspace_dir = r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2"
    
    # List of test booklets to process: CSM26T02SE to CSM26T15SE
    booklets = [f"CSM26T{i:02d}SE" for i in range(2, 16)]
    
    print(f"Starting batch extraction and PDF compilation for booklets: {booklets}")
    
    for booklet in booklets:
        pdf_name = f"Forum MGP {booklet} Examstatic.com.pdf"
        pdf_path = os.path.join(downloads_dir, pdf_name)
        
        if not os.path.exists(pdf_path):
            print(f"[-] PDF not found: {pdf_path}. Skipping.")
            continue
            
        print(f"\n==================================================")
        print(f"[+] Processing {pdf_name}...")
        print(f"==================================================")
        
        # Step 1: Run extract_forum_mgp.py
        md_name = f"Forum MGP {booklet} Examstatic.com.md"
        print(f"[*] Extracting text and formatting MD...")
        extract_cmd = ["python", "extract_forum_mgp.py", pdf_path]
        res_extract = subprocess.run(extract_cmd, cwd=workspace_dir)
        
        if res_extract.returncode != 0:
            print(f"[-] Extraction failed for {booklet}!")
            continue
            
        # Step 2: Run convert_mgp_md_to_pdf.py
        print(f"[*] Compiling to PDF...")
        compile_cmd = ["python", "convert_mgp_md_to_pdf.py", md_name]
        res_compile = subprocess.run(compile_cmd, cwd=workspace_dir)
        
        if res_compile.returncode != 0:
            print(f"[-] PDF compilation failed for {booklet}!")
            continue
            
        print(f"[+] Successfully processed {booklet}!")
        
    print("\nBatch processing completed successfully!")

if __name__ == "__main__":
    main()
