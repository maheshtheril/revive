const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDoctor() {
  const id = "a3bebc3f-91d1-4787-a61f-764c7452f2c0";
  console.log(`Checking for doctor ID: ${id}`);
  const doctor = await prisma.hms_clinicians.findUnique({
    where: { id }
  });
  
  if (doctor) {
    console.log("SUCCESS: Doctor found!", doctor.first_name, doctor.last_name);
  } else {
    console.log("FAILURE: Doctor NOT FOUND in database!");
    
    // Check all doctors
    const all = await prisma.hms_clinicians.findMany({ take: 5 });
    console.log("First 5 doctors in DB:", all.map(d => `${d.first_name} (${d.id})`));
  }
  process.exit(0);
}

checkDoctor();
