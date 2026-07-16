import json
with open('mains json files/mains_keywords.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f'Total: {len(data)}')
for item in data[:5]:
    t = item['title']
    b = item['content_markdown']
    print(f'Title: {t[:80]}')
    print(f'Body:  {b[:100]}')
    print()

long = [x for x in data if len(x['title']) > 60]
print(f'Cards with title > 60 chars (potentially merged): {len(long)}')
for item in long[:5]:
    print(f'  TITLE: {item["title"][:150]}')
