import json

with open(r'C:\Users\Dr. Yogesh\Downloads\forum-mgp-final-gs3.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Find a question with Abbreviations AND Extra marks
for q in data['questions']:
    for a in q.get('answers', []):
        txt = a.get('answerText', '')
        if ('Abbreviation' in txt or 'abbreviation' in txt) and ('Extra marks' in txt or 'Extra Marks' in txt):
            print('Q ID:', q['id'])
            print('Institute:', a.get('institute'))
            # Print the last 2000 chars
            print('LAST 2000 CHARS:')
            print(repr(txt[-2000:]))
            print('=====')
            break
    else:
        continue
    break
