import os

file_path = r"c:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\src\data\mainsValueAdditionLoader.ts"

if not os.path.exists(file_path):
    print("Error: File not found!")
    exit(1)

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace all occurrences of microtopic: cleanHierarchyString(item.microtopic) with getMicrotopic(item)
# but NOT h.microtopic (which is inside mappedFrameworks)
content = content.replace("microtopic: cleanHierarchyString(item.microtopic),", "microtopic: getMicrotopic(item),")
content = content.replace("subtopic: cleanHierarchyString(item.subtopic),", "subtopic: getSubtopic(item),")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Successfully replaced mappers in mainsValueAdditionLoader.ts")
