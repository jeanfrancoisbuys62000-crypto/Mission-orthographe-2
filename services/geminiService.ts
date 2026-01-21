import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { ModuleType, DifficultyLevel, DictationText, EvaluationResult, DictationMetadata } from "../types";

// Sécurisation de la clé d'API pour TypeScript
const getApiKey = (): string => (process.env as any).API_KEY || '';

/**
 * Nettoie une chaîne JSON potentiellement entourée de balises Markdown
 */
const cleanJsonString = (str: string): string => {
  return str.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
};

export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const generateCatalog = async (
  type: ModuleType,
  level?: DifficultyLevel,
  count: number = 50
): Promise<DictationMetadata[]> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const context = type === ModuleType.TRAINING ? `niveau de difficulté ${level} sur 4` : "type Brevet des collèges (officiel)";
  
  const prompt = `Génère une liste de ${count} textes célèbres adaptés pour une dictée de 3ème, ${context}.
  Varie les auteurs classiques et contemporains. Renvoie UNIQUEMENT un JSON contenant un tableau d'objets avec les champs : author, source, date.`;

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                author: { type: Type.STRING },
                source: { type: Type.STRING },
                date: { type: Type.STRING },
              },
              required: ["author", "source", "date"],
            }
          }
        },
        required: ["items"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("Réponse vide de l'IA");
  const data = JSON.parse(cleanJsonString(text));
  return (data.items || []).map((item: any, idx: number) => ({
    ...item,
    index: idx + 1,
    id: type === ModuleType.TRAINING ? `level-${level}-text-${idx + 1}` : `brevet-text-${idx + 1}`
  }));
};

export const generateDictationTextFromMetadata = async (
  metadata: DictationMetadata,
  type: ModuleType,
  level: DifficultyLevel = 1
): Promise<DictationText> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const wordRange = type === ModuleType.TRAINING ? "50 à 60" : "120 à 140";

  const prompt = `Génère un extrait de texte pour une dictée de troisième.
  Auteur : ${metadata.author}. Oeuvre : ${metadata.source}.
  Le texte doit faire entre ${wordRange} mots. Renvoie UNIQUEMENT un JSON avec content et wordCount.`;

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          content: { type: Type.STRING },
          wordCount: { type: Type.NUMBER },
        },
        required: ["content", "wordCount"],
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("Réponse vide");
  const data = JSON.parse(cleanJsonString(text));
  return { ...metadata, content: data.content, wordCount: data.wordCount, level, type };
};

export const evaluateDictation = async (
  original: string,
  userSubmission: string
): Promise<EvaluationResult> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const prompt = `Évalue cette dictée. Texte original: "${original}". Texte élève: "${userSubmission}".
  Renvoie un JSON avec: score (0-10), comment, correctText, et errors (text, type, hint, startIndex, endIndex).`;

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          comment: { type: Type.STRING },
          errors: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                type: { type: Type.STRING },
                hint: { type: Type.STRING },
                startIndex: { type: Type.NUMBER },
                endIndex: { type: Type.NUMBER },
              },
              required: ["text", "type", "hint", "startIndex", "endIndex"]
            }
          },
          correctText: { type: Type.STRING },
        },
        required: ["score", "comment", "errors", "correctText"]
      }
    }
  });

  const resultText = response.text || '{}';
  return JSON.parse(cleanJsonString(resultText));
};

export const generateSpeech = async (text: string, _slowMode: boolean, retryCount = 0): Promise<Uint8Array> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  
  // Nettoyage minimal
  const cleanText = text.replace(/[\r\n]+/g, ' ').replace(/"/g, "'").trim();

  // FIX: Format "Read: ..." est le plus stable pour garantir une réponse purement audio
  const prompt = `Read: ${cleanText}`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Puck' },
          },
        },
      },
    });

    // RÉSOUDRE TS2345: Vérification explicite et extraction dans une variable typée
    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) throw new Error("Aucun candidat");
    
    const parts = candidates[0].content.parts;
    const audioPart = parts.find(p => p.inlineData);
    
    if (!audioPart || !audioPart.inlineData || !audioPart.inlineData.data) {
       throw new Error("L'IA n'a pas renvoyé de flux audio valide.");
    }

    // Ici TypeScript sait que audioPart.inlineData.data est une string non-nulle
    const base64Data: string = audioPart.inlineData.data;
    return decode(base64Data);
    
  } catch (error: any) {
    console.error(`Erreur TTS (Tentative ${retryCount + 1}):`, error);
    
    if (retryCount < 1) {
      await new Promise(r => setTimeout(r, 2000));
      return generateSpeech(text, _slowMode, retryCount + 1);
    }
    
    throw error;
  }
};