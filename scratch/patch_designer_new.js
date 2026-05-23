
const fs = require('fs');
const path = 'c:\\2035-HMS\\SAAS_ERP\\src\\components\\print\\visual-header-designer.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldCode = 'await onSaveTemplate(newTemplateName, coords, currentUsage);';
const newCode = `const result = await onSaveTemplate(newTemplateName, coords, currentUsage);
                          if (result?.id) {
                              setLocalEditingId(result.id);
                              setLocalEditingName(newTemplateName);
                          }`;

if (content.includes(oldCode)) {
    console.log("Found SaveAsNew target!");
    content = content.replace(oldCode, newCode);
    fs.writeFileSync(path, content);
    console.log("Applied replacement for SaveAsNew!");
} else {
    console.log("SaveAsNew target NOT found!");
}
