import { prisma } from "../src/lib/prisma";

async function check() {
    try {
        const locations = await prisma.hms_stock_location.findMany();
        console.log("Locations found:", JSON.stringify(locations, null, 2));
    } catch (e) {
        console.error("Error checking locations:", e);
    }
}

check();
