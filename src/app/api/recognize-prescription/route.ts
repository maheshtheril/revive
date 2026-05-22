import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { auth } from "@/auth";
import { getAIConfig } from "@/app/actions/settings";

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        const config = await getAIConfig(session?.user?.companyId || "", session?.user?.tenantId || "");
        const key = config?.apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";

        if (!key) {
            return NextResponse.json({
                error: 'AI service not configured. Please add Gemini API Key in Global Settings.'
            }, { status: 503 })
        }

        const genAI = new GoogleGenerativeAI(key);

        const formData = await request.formData()
        const imageFile = formData.get('image') as File

        if (!imageFile) {
            return NextResponse.json({ error: 'No image provided' }, { status: 400 })
        }

        // Convert to base64
        const buffer = Buffer.from(await imageFile.arrayBuffer())
        const base64Image = buffer.toString('base64')

        // Use Gemini to extract structured prescription data
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }, { apiVersion: 'v1beta' })

        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType: imageFile.type || 'image/jpeg',
                    data: base64Image
                }
            },
            `You are a medical prescription OCR system. Extract handwritten text from this prescription image and return ONLY a JSON object with these exact fields:
{
  "vitals": "extracted vitals text",
  "diagnosis": "extracted diagnosis text", 
  "complaint": "extracted presenting complaint text",
  "examination": "extracted general examination findings",
  "plan": "extracted plan text"
}

Rules:
- Return ONLY the JSON object, nothing else
- If a section has no text, use empty string ""
- Do NOT add any explanations or markdown formatting
- Extract text exactly as written`
        ])

        const text = result.response.text()

        // Try to parse as JSON
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0])
                return NextResponse.json({
                    success: true,
                    ...data
                })
            }
        } catch (parseError) {
            console.error('JSON parse error:', parseError)
        }

        // Fallback: return empty structure
        return NextResponse.json({
            success: true,
            vitals: '',
            diagnosis: '',
            complaint: '',
            examination: '',
            plan: ''
        })

    } catch (error: any) {
        console.error('Prescription recognition error:', error)
        return NextResponse.json({
            error: 'Failed to recognize prescription',
            details: error.message
        }, { status: 500 })
    }
}
