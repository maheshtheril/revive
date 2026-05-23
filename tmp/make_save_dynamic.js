const fs = require('fs');
const path = 'c:/2035-HMS/SAAS_ERP/src/app/settings/hms/hms-settings-form.tsx';
let content = fs.readFileSync(path, 'utf8');

// The line currently looks like: id: "09223ee1-8609-49a5-aece-3501fbab982a", name: "Standard Template",
const search = 'id: "09223ee1-8609-49a5-aece-3501fbab982a", name: "Standard Template",';

// We want to find the ID of the template from the existing settings array
const replace = 'id: pdfSettings?.templates?.find((t: any) => t.usage === usage && t.is_default)?.id, name: "Standard Template",';

if (content.includes(search)) {
    content = content.replace(search, replace);
    fs.writeFileSync(path, content);
    console.log("Successfully made the Save button dynamic!");
} else {
    console.error("Could not find the hardcoded ID line!");
}
