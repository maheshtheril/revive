const fs = require('fs');
const path = 'c:/2035-HMS/SAAS_ERP/src/app/settings/hms/hms-settings-form.tsx';
let content = fs.readFileSync(path, 'utf8');
const search = 'initialUsage={searchUsage}';
const replace = 'initialUsage={searchUsage} company={company}';
if (content.includes(search)) {
    content = content.replace(search, replace);
    fs.writeFileSync(path, content);
    console.log("Successfully connected company data!");
} else {
    console.error("Could not find initialUsage line!");
}
