import subprocess
import os

pdf_files = [
    r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Forum MGP CSM26T15SE Examstatic.com.pdf",
    r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Forum MGP CSM26T14SE Examstatic.com.pdf",
    r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Forum MGP CSM26T13SE Examstatic.com.pdf",
    r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Forum MGP CSM26T12SE Examstatic.com.pdf",
    r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Forum MGP CSM26T11SE Examstatic.com.pdf",
    r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Forum MGP CSM26T10SE Examstatic.com.pdf",
    r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Forum MGP CSM26T09SE Examstatic.com.pdf",
    r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Forum MGP CSM26T08SE Examstatic.com.pdf",
    r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Forum MGP CSM26T07SE Examstatic.com.pdf",
    r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Forum MGP CSM26T06SE Examstatic.com.pdf",
    r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Forum MGP CSM26T05SE Examstatic.com.pdf",
    r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Forum MGP CSM26T04SE Examstatic.com.pdf",
    r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Forum MGP CSM26T03SE Examstatic.com.pdf",
    r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Forum MGP CSM26T02SE Examstatic.com.pdf",
]

for pdf in pdf_files:
    if os.path.exists(pdf):
        print(f"Extracting {pdf}...")
        # Use python to call the extract script
        subprocess.run(["python", "extract_forum_mgp.py", pdf], check=True)
    else:
        print(f"File not found: {pdf}")
