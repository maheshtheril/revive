import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "")

export async function POST(request: NextRequest) {
    try {
        // Check if API key exists
        if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
            console.error('GOOGLE_GENERATIVE_AI_API_KEY is missing')
            return NextResponse.json({
                error: 'AI service not configured. Please add handwriting text manually.',
                details: 'Gemini API key not found in environment'
            }, { status: 503 })
        }

        const formData = await request.formData()
        const imageFile = formData.get('image') as File

        if (!imageFile) {
            return NextResponse.json({ error: 'No image provided' }, { status: 400 })
        }

        // Convert file to base64
        const buffer = Buffer.from(await imageFile.arrayBuffer())
        const base64Image = buffer.toString('base64')

        // Use Gemini Vision to extract text  
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }, { apiVersion: 'v1beta' })

        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType: imageFile.type || 'image/png',
                    data: base64Image
                }
            },
            "You are an OCR system. Extract ALL handwritten text from this image. Return ONLY the extracted text with NO explanations, apologies, or conversational text. If no text is found, return empty string."
        ])

        const text = result.response.text()

        return NextResponse.json({
            success: true,
            text: text.trim()
        })

    } catch (error: any) {
        console.error('Handwriting recognition error:', error)
        return NextResponse.json({
            error: 'Failed to recognize handwriting',
            details: error.message || 'Unknown error'
        }, { status: 500 })
    }
}

