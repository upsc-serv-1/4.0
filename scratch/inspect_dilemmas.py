import fitz

path = r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\ETHICAL DILEMMAS.pdf"
doc = fitz.open(path)
page = doc[0]

# Extract blocks of text with positions
blocks = page.get_text("blocks")
with open("scratch/dilemmas_inspect.txt", "w", encoding="utf-8") as out:
    for block in blocks:
        out.write(f"Block rect: {block[:4]}\n")
        out.write(block[4])
        out.write("\n" + "-"*40 + "\n")

print("Done inspecting dilemmas blocks!")
