import fitz

path = r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\ETHICAL DILEMMAS.pdf"
doc = fitz.open(path)
page = doc[0]

# page.get_text("words") returns a list of tuples: (x0, y0, x1, y1, "word", block_no, line_no, word_no)
words = page.get_text("words")

# Let's sort the words first by y0, and then by x0
words.sort(key=lambda w: (w[1], w[0]))

print(f"Total words: {len(words)}")

# Group words into lines. If two words have y0 within 5 pixels, they are on the same line.
lines = []
current_line = []
last_y = -1

for w in words:
    x0, y0, x1, y1, text, block_no, line_no, word_no = w
    if last_y == -1:
        current_line.append(w)
        last_y = y0
    elif abs(y0 - last_y) < 6:
        current_line.append(w)
    else:
        # Sort current line by x0
        current_line.sort(key=lambda item: item[0])
        lines.append(current_line)
        current_line = [w]
        last_y = y0

if current_line:
    current_line.sort(key=lambda item: item[0])
    lines.append(current_line)

# Let's print out the lines with word coordinates
with open("scratch/dilemmas_lines.txt", "w", encoding="utf-8") as out:
    for idx, line in enumerate(lines):
        # We can also group words on the same line that are close in X coordinate
        line_str = " | ".join([f"({round(w[0])}, {round(w[1])}) {w[4]}" for w in line])
        out.write(f"Line {idx+1}: {line_str}\n")

print("Done! Lines written to scratch/dilemmas_lines.txt")
