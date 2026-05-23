const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkFields() {
  console.log("Checking hms_clinicians fields...");
  const model = prisma._baseDmmf.modelMap.hms_clinicians;
  if (!model) {
    console.error("Model hms_clinicians not found in DMMF!");
    return;
  }
  
  const fieldNames = model.fields.map(f => f.name);
  console.log("Fields found in Prisma Client:", fieldNames.join(', '));
  
  if (fieldNames.includes('role_id')) {
    console.log("SUCCESS: role_id IS in the client!");
  } else {
    console.log("FAILURE: role_id is MISSING from the client!");
  }
  
  process.exit(0);
}

checkFields().catch(err => {
  console.error(err);
  process.exit(1);
});
