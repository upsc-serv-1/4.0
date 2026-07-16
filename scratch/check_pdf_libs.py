libs = ['fitz', 'pdfplumber', 'pypdf', 'PyPDF2']
for lib in libs:
    try:
        __import__(lib)
        print(f"{lib}: available")
    except ImportError:
        print(f"{lib}: NOT available")
