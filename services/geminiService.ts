import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { ModuleType, DifficultyLevel, DictationText, EvaluationResult, DictationMetadata } from "../types";

const getApiKey = () => process.env.API_KEY || '';

// Helper to decode PCM
export function decode(base64: string) {
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

/**
 * Génère un catalogue de métadonnées pour un module donné.
 */
export const generateCatalog = async (
  type: ModuleType,
  level?: DifficultyLevel,
  count: number = 50
): Promise<DictationMetadata[]> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const context = type === ModuleType.TRAINING ? `niveau de difficulté ${level} sur 4` : "type Brevet des collèges (officiel)";
  
  const prompt = `Génère une liste de ${count} textes célèbres adaptés pour une dictée de 3ème, ${context}.
  Varie les auteurs classiques et contemporains.
  Renvoie UNIQUEMENT un JSON contenant un tableau d'objets avec les champs : author, source (titre de l'oeuvre), date (année).`;

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
  const data = JSON.parse(text);
  return (data.items || []).map((item: any, idx: number) => ({
    ...item,
    index: idx + 1,
    id: type === ModuleType.TRAINING ? `level-${level}-text-${idx + 1}` : `brevet-text-${idx + 1}`
  }));
};

/**
 * Génère le contenu d'une dictée.
 */
export const generateDictationTextFromMetadata = async (
  metadata: DictationMetadata,
  type: ModuleType,
  level: DifficultyLevel = 1
): Promise<DictationText> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const wordRange = type === ModuleType.TRAINING ? "50 à 60" : "120 à 140";

  const prompt = `Génère un extrait de texte pour une dictée de troisième.
  Auteur : ${metadata.author}
  Oeuvre : ${metadata.source} (${metadata.date})
  Le texte doit être fidèle à l'oeuvre originale et faire exactement entre ${wordRange} mots.
  Renvoie UNIQUEMENT un JSON avec les champs : content, wordCount.`;

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
  if (!text) throw new Error("Réponse vide de l'IA");
  const data = JSON.parse(text);
  return {
    ...metadata,
    content: data.content,
    wordCount: data.wordCount,
    level,
    type
  };
};

export const evaluateDictation = async (
  original: string,
  userSubmission: string
): Promise<EvaluationResult> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const prompt = `Évalue cette dictée.
  Texte original: "${original}"
  Texte élève: "${userSubmission}"
  Retire 1 pt par faute de grammaire, 0,5 pt par faute lexicale.
  Renvoie un JSON avec: score (0-10), comment (pédagogique), correctText, et errors (tableau d'objets avec text, type, hint, startIndex, endIndex).`;

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

  const text = response.text;
  if (!text) throw new Error("Réponse vide de l'IA");
  return JSON.parse(text);
};

export const generateSpeech = async (text: string, slowMode: boolean, retryCount = 0): Promise<Uint8Array> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  
  const cleanText = text
    .replace(/[^\w\sàâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ.,!?;:'"()\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Prompt ultra-simplifié pour forcer le mode AUDIO et éviter le fallback TEXT
  const speed = slowMode ? "very slowly" : "clearly";
  const prompt = `Read this text for a dictation, ${speed}, pronouncing all punctuation: ${cleanText}`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!part || !part.inlineData) {
       // Si le modèle a renvoyé du texte au lieu de l'audio malgré nos précautions
       throw new Error("Le modèle a renvoyé une réponse textuelle au lieu de l'audio.");
    }

    return decode(part.inlineData.data);
  } catch (error: any) {
    console.error(`Gemini TTS Error (Attempt ${retryCount + 1}):`, error);
    
    // Retry logic pour les erreurs temporaires
    if (retryCount < 2) {
      await new Promise(r => setTimeout(r, 1500 * (retryCount + 1)));
      return generateSpeech(text, slowMode, retryCount + 1);
    }
    
    throw error;
  }
};