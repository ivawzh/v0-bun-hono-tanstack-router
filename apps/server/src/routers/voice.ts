import { protectedProcedure, o } from "../lib/orpc";
import * as v from "valibot";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const voiceRouter = o.router({
  // Transcribe audio to text using OpenAI Whisper
  transcribe: protectedProcedure
    .input(v.object({
      audio: v.string(), // Base64 encoded audio data
      format: v.optional(v.picklist(["webm", "mp3", "wav", "m4a"]), "webm"),
      language: v.optional(v.string()), // ISO 639-1 language code
    }))
    .handler(async ({ input }) => {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("OpenAI API key not configured");
      }

      try {
        // Convert base64 to buffer
        const audioBuffer = Buffer.from(input.audio, "base64");
        
        // Create a File object from the buffer
        const file = new File(
          [audioBuffer],
          `audio.${input.format}`,
          { type: `audio/${input.format}` }
        );

        // Call OpenAI Whisper API
        const transcription = await openai.audio.transcriptions.create({
          file,
          model: "whisper-1",
          language: input.language,
          response_format: "json",
        });

        return {
          text: transcription.text,
          success: true,
        };
      } catch (error: any) {
        console.error("Voice transcription error:", error);
        throw new Error(`Failed to transcribe audio: ${error.message}`);
      }
    }),

  // Get supported languages for transcription
  getSupportedLanguages: protectedProcedure
    .handler(async () => {
      return {
        languages: [
          { code: "en", name: "English" },
          { code: "es", name: "Spanish" },
          { code: "fr", name: "French" },
          { code: "de", name: "German" },
          { code: "it", name: "Italian" },
          { code: "pt", name: "Portuguese" },
          { code: "nl", name: "Dutch" },
          { code: "ru", name: "Russian" },
          { code: "zh", name: "Chinese" },
          { code: "ja", name: "Japanese" },
          { code: "ko", name: "Korean" },
          { code: "ar", name: "Arabic" },
          { code: "hi", name: "Hindi" },
          // Add more languages as needed
        ],
      };
    }),
});