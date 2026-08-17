import re

files = [
    r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Anthropology_PAPER_2_PYQs_20_25_Extracted.md",
    r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Anthropology_PAPER_1_PYQs_20_25_Extracted.md",
]

for filepath in files:
    name = filepath.split("\\")[-1]
    print(f"\n=== {name} ===")
    with open(filepath, "r", encoding="utf-8") as f:
        lines = f.readlines()

    tab_lines = []
    odd_indent_lines = []
    indent_counts = {}
    total_bullets = 0

    for i, line in enumerate(lines, 1):
        stripped = line.rstrip("\r\n")
        m = re.match(r"^(\s*)([-*])\s", stripped)
        if not m:
            continue
        total_bullets += 1
        indent = m.group(1)
        indent_len = len(indent)

        if "\t" in indent:
            tab_lines.append(i)

        indent_counts[indent_len] = indent_counts.get(indent_len, 0) + 1

        # Flag odd-space indents (not 0, 2, 4, 6...)
        if indent_len > 0 and indent_len % 2 != 0 and "\t" not in indent:
            odd_indent_lines.append((i, indent_len, stripped[:70]))

    print(f"Total bullet lines: {total_bullets}")
    print(f"Indent depth breakdown (spaces: count): {dict(sorted(indent_counts.items()))}")
    print(f"Lines with TABS: {len(tab_lines)}  -> first 10: {tab_lines[:10]}")
    print(f"Lines with ODD indent (not 0/2/4/6): {len(odd_indent_lines)}")
    for ln, depth, text in odd_indent_lines[:20]:
        print(f"  Line {ln} [{depth} spaces]: {text}")

print("\nDone.")
