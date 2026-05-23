const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listDoctors() {
  const doctors = await prisma.hms_clinicians.findMany({
    select: { id: true, first_name: true, last_name: true },
    take: 10
  });
  
  if (doctors.length === 0) {
    console.log("No doctors found in database!");
  } else {
    doctors.forEach(d => {
      console.log(`${d.first_name} ${d.last_name} -> http://localhost:3000/hms/doctors/${d.id}`);
    });
  }
  process.exit(0);
}

listDoctors();
