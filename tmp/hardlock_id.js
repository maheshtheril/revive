const fs = require('fs');
const path = 'c:/2035-HMS/SAAS_ERP/src/app/settings/hms/hms-settings-form.tsx';
let content = fs.readFileSync(path, 'utf8');
const search = 'name: "Standard Template",';
const replace = 'id: "09223ee1-8609-49a5-aece-3501fbab982a", name: "Standard Template",';
if (content.includes(search)) {
    content = content.replace(search, replace);
    fs.writeFileSync(path, content);
    console.log("Successfully hard-locked the ID!");
} else {
    console.error("Could not find Standard Template string!");
}
