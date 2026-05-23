const fs = require('fs');
const path = 'c:/2035-HMS/SAAS_ERP/src/app/settings/hms/hms-settings-form.tsx';
let content = fs.readFileSync(path, 'utf8');
const search = "name: usage + '_dynamic_template',";
const replace = 'name: "Standard Template",';
if (content.includes(search)) {
    content = content.replace(search, replace);
    fs.writeFileSync(path, content);
    console.log("Successfully replaced!");
} else {
    console.error("Could not find the target string!");
    console.log("Searching for a subset...");
    if (content.includes("name: usage + '_dynamic_template'")) {
        console.log("Found without comma, trying that...");
        content = content.replace("name: usage + '_dynamic_template'", 'name: "Standard Template"');
         fs.writeFileSync(path, content);
    }
}
