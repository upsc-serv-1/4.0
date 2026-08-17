import os
import re

def fix_markdown_lists(directory):
    md_files = [os.path.join(dp, f) for dp, dn, filenames in os.walk(directory) for f in filenames if f.endswith('.md')]
    
    for filepath in md_files:
        with open(filepath, 'r', encoding='utf-8', errors='replace') as file:
            content = file.read()
            
        # 1. Replace all non-breaking spaces with regular spaces
        content = content.replace('\xa0', ' ')
        
        # 2. Replace the strange replacement character bullet and other custom bullets with standard '- '
        # This regex matches leading spaces, followed by common custom bullets or the replacement char, followed by a space
        content = re.sub(r'^([ \t]*)[•◦–]\s+', r'\1- ', content, flags=re.MULTILINE)
        
        # 3. Normalize indentation levels to standard Markdown (0, 3, 6 spaces)
        # We find all list items (lines starting with spaces and '- ' or '* ')
        def scale_indent(match):
            spaces = match.group(1).replace('\t', '    ')
            bullet = match.group(2)
            space_len = len(spaces)
            
            # Map their custom indentations to standard markdown sub-list levels
            if space_len < 4:
                new_spaces = '' # Top level (Level 1)
            elif space_len < 8:
                new_spaces = '   ' # Level 2 (Sub-list)
            else:
                new_spaces = '      ' # Level 3 (Sub-sub-list)
                
            return f'{new_spaces}{bullet} '
            
        content = re.sub(r'^([ \t]*)([-*+]|\d+\.)\s+', scale_indent, content, flags=re.MULTILINE)
        
        # 4. Remove empty lines right before a list that cause Code Block errors.
        # If there is a paragraph, an empty line, and then a list, markdown-it triggers a code block if the list is indented.
        # But since we scaled top-level to 0 spaces, the code block error is natively solved!
        
        with open(filepath, 'w', encoding='utf-8') as file:
            file.write(content)
            
    print(f"Successfully normalized markdown lists in {len(md_files)} files.")

if __name__ == '__main__':
    # Target the mains tab md files directory
    fix_markdown_lists(r'C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains tab md files')
