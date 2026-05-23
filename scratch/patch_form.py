
import os

filepath = r'c:\2035-HMS\SAAS_ERP\src\app\settings\hms\hms-settings-form.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
found = False
for line in lines:
    new_lines.append(line)
    if "router.refresh();" in line and not found:
        # Check if we are inside onSaveTemplate
        # (Very naive check but let's hope)
        # Looking at context around lines 864
        new_lines.append(line.replace("router.refresh();", "return res;").replace("router.refresh();", "")) # This is wrong logic

# Let's try again with actual matching
content = "".join(lines)
old_block = """                                                    toast({ title: "Template Saved", description: `'${name}' updated.` });
                                                    router.refresh();
                                                }"""

# I will use a more robust search
target = 'toast({ title: "Template Saved", description: `\'${name}\' updated.` });'
if target in content:
    print("Found target!")
    new_content = content.replace('router.refresh();\n                                                }', 'router.refresh();\n                                                }\n                                                return res;')
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Replacment done!")
else:
    print("Target NOT found!")
