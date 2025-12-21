
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { VISION_MODEL, TTS_MODEL } from "../constants";
import { AppMode, DetectionResult } from "../types";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
  }

  async detectObjects(base64Image: string, mode: AppMode): Promise<DetectionResult> {
    const prompt = this.getPromptForMode(mode);
    
    try {
      const response = await this.ai.models.generateContent({
        model: VISION_MODEL,
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              detections: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    confidence: { type: Type.NUMBER },
                    box_2d: {
                      type: Type.OBJECT,
                      properties: {
                        ymin: { type: Type.NUMBER },
                        xmin: { type: Type.NUMBER },
                        ymax: { type: Type.NUMBER },
                        xmax: { type: Type.NUMBER }
                      },
                      required: ['ymin', 'xmin', 'ymax', 'xmax']
                    },
                    status: { type: Type.STRING, description: 'Context specific status: low-stock, suspicious, normal' },
                    count: { type: Type.NUMBER }
                  },
                  required: ['label', 'confidence', 'box_2d']
                }
              },
              summary: { type: Type.STRING },
              reasoning: { type: Type.STRING }
            },
            required: ['detections', 'summary']
          }
        }
      });

      const result = JSON.parse(response.text || '{}') as DetectionResult;
      result.timestamp = Date.now();
      return result;
    } catch (error) {
      console.error("Detection failed:", error);
      throw error;
    }
  }

  async speak(text: string): Promise<ArrayBuffer> {
    try {
      const response = await this.ai.models.generateContent({
        model: TTS_MODEL,
        contents: [{ parts: [{ text: `Say naturally: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) throw new Error("No audio returned");

      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    } catch (error) {
      console.error("Speech failed:", error);
      throw error;
    }
  }

  private getPromptForMode(mode: AppMode): string {
    const common = "Identify objects and provide bounding boxes in [ymin, xmin, ymax, xmax] format normalized to 1000. Provide a detailed summary.";
    switch (mode) {
      case AppMode.RETAIL:
        return `${common} Focus on inventory. Count items, identify product names, and flag 'low-stock' if a shelf area looks sparse.`;
      case AppMode.ACCESSIBILITY:
        return `${common} Provide spatial guidance (e.g., 'A cup is on your right'). Focus on obstacles and useful objects. Keep summary concise for voice output.`;
      case AppMode.SECURITY:
        return `${common} Detect people, packages, and vehicles. Flag any 'suspicious' activity or unauthorized presence.`;
      case AppMode.EDUCATIONAL:
        return `${common} Include 'reasoning' explaining why you categorized the object as such (e.g., 'Shape and handle suggest a mug').`;
      default:
        return `${common} Detect common objects and summarize the scene accurately.`;
    }
  }
}
