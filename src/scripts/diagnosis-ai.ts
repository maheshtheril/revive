import { GoogleGenerativeAI } from "@google/generative-ai";
import { PrismaClient } from "@prisma/client";

async function runDiagnosis() {
    const prisma = new PrismaClient();
    try {
        const config = await prisma.hms_settings.findFirst({ 
            where: { 
                OR: [
                    { key: 'AI_CONFIG' },
                    { key: 'ai_config' }
                ]
            } 
        });
        const val = (config?.value as any) || {};
        const key = val.apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
        
        if (!key) {
            console.error("❌ No API key found in DB or .env");
            return;
        }

        console.log(`🔍 Diagnosing Key: ${key.substring(0, 10)}...`);
        const genAI = new GoogleGenerativeAI(key);

        const models = ["gemini-1.5-flash", "gemini-pro"];
        for (const mName of models) {
            try {
                process.stdout.write(`Trying ${mName}... `);
                const model = genAI.getGenerativeModel({ model: mName });
                const res = await model.generateContent("test");
                console.log("✅ SUCCESS!");
                return;
            } catch (e: any) {
                console.log(`❌ FAILED: ${e.message}`);
            }
        }
    } finally {
        await prisma.$disconnect();
    }
}
runDiagnosis();
