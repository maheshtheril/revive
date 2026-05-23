
const fs = require('fs');
const path = 'c:\\2035-HMS\\SAAS_ERP\\src\\components\\print\\visual-header-designer.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldCode = 'await onSaveTemplate(localEditingName, coords, currentUsage, localEditingId);';
const newCode = `const result = await onSaveTemplate(localEditingName, coords, currentUsage, localEditingId);
                       if (result?.id) {
                           setLocalEditingId(result.id);
                       }`;

if (content.includes(oldCode)) {
    console.log("Found target in Designer!");
    content = content.replace(oldCode, newCode);
    fs.writeFileSync(path, content);
    console.log("Applied replacement in Designer!");
} else {
    console.log("Target NOT found in Designer!");
}
