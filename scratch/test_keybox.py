import re

sample_text = 'The <mark class="key-box">Government of India Act of 1935</mark> emerged out of the deliberations of the <mark class="key-box">Simon Commission</mark> and the three <mark class="key-box">Round Table Conferences</mark>.'

def transform_keybox(text, mode='boxed'):
    if mode == 'boxed':
        return re.sub(r'<mark\s+class=["\']key-box["\']>(.*?)</mark>', r'[[BOX::\1]]', text, flags=re.DOTALL)
    else:
        return re.sub(r'<mark\s+class=["\']key-box["\']>(.*?)</mark>', r'**\1**', text, flags=re.DOTALL)

print('=== BOXED MODE ===')
print(transform_keybox(sample_text, 'boxed'))

print('\n=== BOLD MODE ===')
print(transform_keybox(sample_text, 'bold'))
