import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { auth } from "@/auth";
import { getAIConfig } from "@/app/actions/settings";

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id || (!session.user.isAdmin && !session.user.isTenantAdmin)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { testKey } = body;

        // Use provided key for testing, or fallback to saved config
        let keyToTest = testKey;
        
        if (!keyToTest) {
            const config = await getAIConfig(session.user.companyId || "", session.user.tenantId || "");
            keyToTest = config?.apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
        }

        console.log(`[AI-DIAGNOSTIC] TESTING KEY: ${keyToTest.substring(0, 5)}... (Length: ${keyToTest.length})`);

        if (!keyToTest || keyToTest.trim() === "") {
            return NextResponse.json({ 
                success: false, 
                error: "No API key found. Please enter a key to test." 
            });
        }

        console.log(`[AI-TEST] Testing key starting with: ${keyToTest.substring(0, 10)}...`);

        const genAI = new GoogleGenerativeAI(keyToTest);
        
        // Final, exhaustive brute force list for both stable and beta/preview models
        const testConfigs = [
            { model: "gemini-2.5-flash", apiVersion: "v1beta" as const },
            { model: "gemini-2.5-flash", apiVersion: "v1" as const },
            { model: "gemini-flash-latest", apiVersion: "v1beta" as const },
            { model: "gemini-2.0-flash", apiVersion: "v1beta" as const },
            { model: "gemini-3.1-flash-lite-preview", apiVersion: "v1beta" as const },
            { model: "gemini-pro-latest", apiVersion: "v1" as const },
        ];

        let lastError = "";
        for (const config of testConfigs) {
            try {
                console.log(`[AI-TEST] Testing ${config.model} (${config.apiVersion})...`);
                const model = genAI.getGenerativeModel(
                    { model: config.model }, 
                    { 
                        apiVersion: config.apiVersion,
                        customHeaders: {
                            "Cache-Control": "no-cache",
                            "Pragma": "no-cache",
                            "referer": "https://aistudio.google.com",
                            "origin": "https://aistudio.google.com"
                        }
                    }
                );
                const result = await model.generateContent("AI_READY");
                const responseText = result.response.text().trim();

                if (responseText.length > 0) {
                    return NextResponse.json({ 
                        success: true, 
                        message: `Success! Model "${config.model}" is active. AI system is now RESTORED.`,
                        modelUsed: config.model
                    });
                }
            } catch (err: any) {
                lastError = err.message || String(err);
                console.log(`[AI-TEST] ${config.model} FAILED: ${lastError}`);
                continue; 
            }
        }

        return NextResponse.json({ 
            success: false, 
            error: `[VER: REFRESHED-3-30] RAW ERROR: ${lastError}`
        });

    } catch (error: any) {
        return NextResponse.json({ 
            success: false, 
            error: `CRITICAL ROUTE ERROR: ${error.message}`
        });
    }
}
