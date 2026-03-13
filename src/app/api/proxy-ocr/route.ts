import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
    try {
        const { image } = await req.json();

        if (!image) {
            return NextResponse.json({ error: 'No image provided' }, { status: 400 });
        }

        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!apiKey) {
            console.error('GOOGLE_GENERATIVE_AI_API_KEY is not set');
            return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        // Remove the data area from the base64 string
        const base64Data = image.split(',')[1] || image;

        const prompt = `
            Extract the following information from this proxy document image:
            1. Owner's identification number (Cédula del Propietario).
            2. Representative's identification number (Cédula del Apoderado).
            3. Representative's full name (Nombre del Apoderado).

            Return the data STRICTLY in the following JSON format:
            {
                "owner_id": "string",
                "representative_id": "string",
                "representative_name": "string"
            }

            If any information is not found, use an empty string. Only return the JSON object, nothing else.
        `;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Data,
                    mimeType: 'image/jpeg',
                },
            },
        ]);

        const response = await result.response;
        const text = response.text();
        
        // Extract JSON from the response text (in case there's markdown formatting)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : '{}';
        const data = JSON.parse(jsonString);

        return NextResponse.json(data);
    } catch (error: any) {
        console.error('OCR Error:', error);
        return NextResponse.json({ error: error.message || 'Error processing image' }, { status: 500 });
    }
}
