import os
import re

files = [
    r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Anthropology_PAPER_1_PYQs_20_25_Extracted.md",
    r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Anthropology_PAPER_2_PYQs_20_25_Extracted.md"
]

def clean_cell_text(text_block):
    """Convert lines of text/bullets in a block into a single table cell string joined by <br>."""
    lines = text_block.strip().split('\n')
    formatted_items = []
    for line in lines:
        l = line.strip()
        if not l:
            continue
        # Remove leading bullet dashes/asterisks
        l = re.sub(r'^[-*•]\s*', '', l)
        # Escape pipe characters to prevent breaking markdown table syntax
        l = l.replace('|', '\\|')
        formatted_items.append(f"• {l}")
    return '<br>'.join(formatted_items)

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Pattern to match the three stacked sections before **ANSWER** or ### **ANSWER**
    pattern = re.compile(
        r'\*\*Aspects to Take into Account\*\*\s*\n(.*?)\n\n?'
        r'\*\*Structure to Follow\*\*\s*\n(.*?)\n\n?'
        r'\*\*Don\'?ts\*\*\s*\n(.*?)\n\n?'
        r'(?=(?:#{1,4}\s*)?\*\*ANSWER\*\*|\Z)',
        re.DOTALL | re.IGNORECASE
    )

    converted_count = 0

    def replace_with_table(match):
        nonlocal converted_count
        aspects_raw = match.group(1)
        structure_raw = match.group(2)
        donts_raw = match.group(3)

        aspects_cell = clean_cell_text(aspects_raw)
        structure_cell = clean_cell_text(structure_raw)
        donts_cell = clean_cell_text(donts_raw)

        table_md = (
            f"| **Aspects to Take into Account** | **Structure to Follow** | **Don'ts** |\n"
            f"|---|---|---|\n"
            f"| {aspects_cell} | {structure_cell} | {donts_cell} |\n\n"
        )
        converted_count += 1
        return table_md

    new_content = pattern.sub(replace_with_table, content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"Processed {os.path.basename(filepath)}: Converted {converted_count} prep sections into 3-column tables.")

def main():
    for f in files:
        if os.path.exists(f):
            process_file(f)
        else:
            print(f"File not found: {f}")

if __name__ == "__main__":
    main()
