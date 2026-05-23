import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

const prisma = new PrismaClient();

async function main() {
    console.log("Fetching AI config from local database...");
    const config = await prisma.hms_settings.findFirst({
        where: { key: 'AI_CONFIG' }
    });

    let apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (config && config.value) {
        const val = config.value as any;
        if (val.enabled && val.apiKey) {
            apiKey = val.apiKey;
            console.log("Found API key in database.");
        }
    }

    if (!apiKey) {
        console.log("No API key found.");
        return;
    }

    console.log("Testing API key starting with: " + apiKey.substring(0, 8) + "...");
    
    // Test the API by listing models using REST fetch
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();
        
        if (data.error) {
            console.error("API Error:", data.error);
        } else if (data.models) {
            console.log("Available Models:");
            data.models.forEach((m: any) => {
                console.log(`- ${m.name}`);
            });
        } else {
            console.log("Unexpected response:", data);
        }
    } catch (e) {
        console.error("Fetch error:", e);
    }
}

main().finally(() => prisma.$disconnect());
