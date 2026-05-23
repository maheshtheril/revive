
const fs = require('fs');
const path = 'c:\\2035-HMS\\SAAS_ERP\\src\\components\\print\\visual-header-designer.tsx';
let content = fs.readFileSync(path, 'utf8');

// Update existing save to also update localTemplates list
const oldSave = `if (result?.id) {
                           setLocalEditingId(result.id);
                       }`;
const newSave = `if (result?.id) {
                           setLocalEditingId(result.id);
                           // Update local templates list immediately to prevent ID mismatch race
                           setLocalTemplates(prev => prev.map(t => t.id === localEditingId ? { ...t, id: result.id } : t));
                       }`;

const oldNewSave = `if (result?.id) {
                              setLocalEditingId(result.id);
                              setLocalEditingName(newTemplateName);
                          }`;
const newNewSave = `if (result?.id) {
                              setLocalEditingId(result.id);
                              setLocalEditingName(newTemplateName);
                              // Add to local list immediately
                              setLocalTemplates(prev => [...prev, { id: result.id, name: newTemplateName, usage: currentUsage, config: coords }]);
                          }`;

if (content.includes(oldSave)) {
    content = content.replace(oldSave, newSave);
    console.log("Updated Existing Save flow");
}

if (content.includes(oldNewSave)) {
    content = content.replace(oldNewSave, newNewSave);
    console.log("Updated New Save flow");
}

fs.writeFileSync(path, content);
