
const fs = require('fs');
const path = 'c:\\2035-HMS\\SAAS_ERP\\src\\app\\settings\\hms\\hms-settings-form.tsx';
let content = fs.readFileSync(path, 'utf8');

if (content.includes('toast({ title: "Template Saved"')) {
    console.log("Found target!");
    // Look for the router.refresh(); line inside onSaveTemplate
    // and add return res; after it.
    const searchString = 'router.refresh();\n                                                }';
    if (content.includes(searchString)) {
        console.log("Found block with specific indentation!");
        content = content.replace(searchString, 'router.refresh();\n                                                }\n                                                return res;');
        fs.writeFileSync(path, content);
        console.log("Applied replacement!");
    } else {
        console.log("Could NOT find specific block. Trying regex...");
        content = content.replace(/(router\.refresh\(\);[\s\n]+})/g, '$1\n                                                return res;');
        fs.writeFileSync(path, content);
        console.log("Applied regex replacement!");
    }
} else {
    console.log("Target NOT found at all!");
}
