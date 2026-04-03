
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const tests = await prisma.hms_lab_test.findMany({
        take: 5
    });
    console.log("LAB TESTS REFERENCE RANGE SAMPLES:");
    tests.forEach(t => {
        console.log(`Test: ${t.name} | Range:`, JSON.stringify(t.reference_range));
    });

    const results = await prisma.hms_lab_result.findMany({
        take: 5
    });
    console.log("\nLAB RESULTS SAMPLES:");
    results.forEach(r => {
        console.log(`Value: ${r.result_value} | Interpreted: ${r.interpreted_value}`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
