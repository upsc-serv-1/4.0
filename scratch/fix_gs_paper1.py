import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

file_path = r"c:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\UPSC_2026 CSE GS PAPER 1 FORMATTED.json"

with open(file_path, "r", encoding="utf-8") as f:
    data = json.load(f)

# ---------------------------------------------------------------------------
# For match-list questions that still have empty options, we extract the
# correct mappings from the explanation, then build 4 options where one
# matches the explanation and the others are plausible distractors.
# 
# The correct approach: look at the statementLines to find what A, B, C, D
# map to (the numbers), then build options as "A-X, B-Y, C-Z, D-W" format.
# ---------------------------------------------------------------------------

def extract_stmt_mapping(stmt_lines):
    """
    From interleaved statementLines like:
      'A. Silver Notice -'
      '1. To seek information ...'
      'B. Blue Notice -'
      '2. To collect ...'
    Returns list of (letter, number) pairs = the actual list pairings
    """
    mapping = {}
    pending_letter = None
    for line in stmt_lines:
        line = line.strip()
        # Match left-side: "A. Something -"
        m_left = re.match(r'^([A-D])\.\s.+-$', line)
        if m_left:
            pending_letter = m_left.group(1)
            continue
        # Match right-side: "1. Something" or "1992" etc.
        m_right = re.match(r'^(\d+)\b', line)
        if m_right and pending_letter:
            mapping[pending_letter] = m_right.group(1)
            pending_letter = None
    return mapping

def extract_correct_mapping_from_explanation(explanation):
    """
    From explanation like:
      '**A-4:** ...'  OR  '**A → 4:** ...' OR '**A → 3:** ...'
    Returns {'A': '4', 'B': '1', 'C': '2', 'D': '3'} etc.
    """
    result = {}
    # Try pattern: **A-4:** or **A - 4:** or **A → 4:**
    patterns = [
        r'\*\*([A-D])\s*[-→]\s*(\d+)\s*[:\*]',  # **A-4:** or **A → 4:**
        r'\*\*([A-D])\s*\(.*?\)\s*[-→]\s*(\d+)\s*[:\*]',  # **A (UNMIL) → 3:**
    ]
    for pat in patterns:
        for m in re.finditer(pat, explanation):
            letter = m.group(1)
            number = m.group(2)
            if letter not in result:
                result[letter] = number
    return result

def make_options_from_correct(correct_mapping, stmt_lines, correct_answer_letter):
    """
    Given {'A': '3', 'B': '2', 'C': '4', 'D': '1'} as the correct answer,
    generate 4 plausible options where option `correct_answer_letter` is correct.
    """
    # Get all available numbers from stmt_lines
    nums = []
    for line in stmt_lines:
        m = re.match(r'^(\d+)\b', line.strip())
        if m:
            nums.append(m.group(1))
    # Sort available numbers
    nums = sorted(set(nums))
    letters = sorted(correct_mapping.keys())  # ['A', 'B', 'C', 'D']
    
    correct_str = ", ".join(f"{l}-{correct_mapping[l]}" for l in letters)
    
    # Make 3 distractor options by shuffling pairs
    import random
    random.seed(42)
    
    options = {}
    option_keys = ['a', 'b', 'c', 'd']
    correct_idx = option_keys.index(correct_answer_letter.lower())
    
    # Build 4 options: correct + 3 rotated distractors
    rotated = []
    for shift in [1, 2, 3]:
        shifted_nums = nums[shift:] + nums[:shift]
        distractor = ", ".join(f"{l}-{n}" for l, n in zip(letters, shifted_nums))
        rotated.append(distractor)
    
    # Assign correct to its position, fill rest with distractors
    all_opts = [None] * 4
    all_opts[correct_idx] = correct_str
    distractor_slots = [i for i in range(4) if i != correct_idx]
    for i, slot in enumerate(distractor_slots):
        all_opts[slot] = rotated[i % len(rotated)]
    
    # Remove duplicates
    seen = set()
    for i, opt in enumerate(all_opts):
        if opt in seen:
            # Generate a different rotation
            new_nums = nums[:]
            random.shuffle(new_nums)
            all_opts[i] = ", ".join(f"{l}-{n}" for l, n in zip(letters, new_nums))
        seen.add(all_opts[i])
    
    for i, key in enumerate(option_keys):
        options[key] = all_opts[i]
    
    return options


# ---------------------------------------------------------------------------
# Process questions with empty options
# ---------------------------------------------------------------------------
BEFORE = {}
AFTER = {}

for q in data["questions"]:
    q_num = q["questionNumber"]
    options = q.get("options", {})
    stmt_lines = q.get("statementLines", [])
    explanation = q.get("explanationMarkdown", "")
    correct_answer = q.get("correctAnswer", "")
    
    # Skip if options already populated
    if options:
        continue
    
    # Only process match-list questions (have interleaved "A. ... -" lines)
    has_interleaved = any(re.match(r'^[A-D]\.\s.+-$', line.strip()) for line in stmt_lines)
    if not has_interleaved:
        continue
    
    BEFORE[q_num] = {
        "statementLines": list(stmt_lines),
        "options": {}
    }
    
    # Extract correct mapping from explanation
    correct_mapping = extract_correct_mapping_from_explanation(explanation)
    
    if len(correct_mapping) < 4:
        # Fall back to reading from statementLines (left→right pairing)
        correct_mapping = extract_stmt_mapping(stmt_lines)
    
    print(f"\nQ.{q_num}: correct_mapping extracted = {correct_mapping}")
    
    if len(correct_mapping) == 4 and correct_answer:
        # Build options
        new_options = make_options_from_correct(correct_mapping, stmt_lines, correct_answer)
        q["options"] = new_options
        
        AFTER[q_num] = {
            "statementLines": list(stmt_lines),
            "options": new_options
        }
        print(f"  → options: {new_options}")
    else:
        print(f"  [WARNING] Could not build options for Q.{q_num}. Mapping: {correct_mapping}")

# Save
with open(file_path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"\n[SUCCESS] Fixed {len(AFTER)} match-list questions with empty options.")
print()
print("=" * 80)
print("BEFORE vs AFTER (match-list questions with empty options fixed)")
print("=" * 80)

for q_num in sorted(BEFORE.keys()):
    b = BEFORE[q_num]
    a = AFTER.get(q_num, {"statementLines": ["(unchanged)"], "options": {}})
    print(f"\n{'─'*80}")
    print(f"  Q.{q_num}")
    print(f"{'─'*80}")
    print("  BEFORE statementLines (first 12):")
    for line in b["statementLines"][:12]:
        print(f"    {repr(line)}")
    print(f"  BEFORE options: {b['options']}")
    print()
    print("  AFTER  statementLines (first 12):")
    for line in a["statementLines"][:12]:
        print(f"    {repr(line)}")
    print(f"  AFTER  options: {a['options']}")
