import fitz

path = r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\ETHICAL DILEMMAS.pdf"
doc = fitz.open(path)
page = doc[0]

tables = page.find_tables()
print("Found tables search complete.")
for i, table in enumerate(tables):
    data = table.extract()
    print(f"Table {i+1} rows count: {len(data)}")
    print("First 10 rows:")
    for r in data[:10]:
        print(r)
