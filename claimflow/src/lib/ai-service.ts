import Groq from "groq-sdk";
import {
  ExtractionResult,
  FraudAnalysisResult,
  EstimationResult,
  LetterResult,
  LetterType,
} from "@/types";
import {
  EXTRACTION_SYSTEM_PROMPT,
  extractionUserPrompt,
} from "@/lib/prompts/extraction";
import {
  FRAUD_SYSTEM_PROMPT,
  fraudUserPrompt,
} from "@/lib/prompts/fraud";
import {
  ESTIMATION_SYSTEM_PROMPT,
  estimationUserPrompt,
} from "@/lib/prompts/estimation";
import {
  LETTER_SYSTEM_PROMPT,
  letterUserPrompt,
} from "@/lib/prompts/letter";
import { getNetworkScoreForClaim } from "@/lib/fraud-network-service";

let _client: Groq | null = null;
function getClient(): Groq {
  if (!_client) {
    _client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _client;
}

const MODEL = "llama-3.3-70b-versatile";

function parseJSON<T>(text: string): T {
  // 1. Code block ```json ... ```
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return JSON.parse(codeBlock[1].trim()) as T;

  // 2. Raw JSON direct
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed) as T;
  }

  // 3. JSON embedded in prose — extract first { ... } block
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return JSON.parse(text.slice(firstBrace, lastBrace + 1)) as T;
  }

  throw new Error(`Réponse IA non parseable : ${text.slice(0, 200)}`);
}

function getText(response: Groq.Chat.ChatCompletion): string {
  return response.choices[0]?.message?.content ?? "{}";
}

// 1. Information Extraction
export async function extractClaimInfo(
  description: string,
  claimContext?: Record<string, unknown>
): Promise<{ result: ExtractionResult; tokensUsed: number; durationMs: number }> {
  const start = Date.now();

  const response = await getClient().chat.completions.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      { role: "user", content: extractionUserPrompt(description, claimContext) },
    ],
  });

  const durationMs = Date.now() - start;
  const tokensUsed = (response.usage?.total_tokens ?? 0);
  const result = parseJSON<ExtractionResult>(getText(response));

  return { result, tokensUsed, durationMs };
}

// 2. Fraud Scoring
export async function analyzeFraud(
  claimData: Record<string, unknown>,
  claimId?: string
): Promise<{ result: FraudAnalysisResult; tokensUsed: number; durationMs: number }> {
  const start = Date.now();

  // Inject network risk context if claimId is provided
  const enrichedClaimData = { ...claimData };
  if (claimId) {
    try {
      const { networkScore, networkRisk } = await getNetworkScoreForClaim(claimId);
      enrichedClaimData.networkScore = networkScore;
      enrichedClaimData.networkRisk = networkRisk;
    } catch {
      // Non-blocking: if network score lookup fails, proceed without it
    }
  }

  const response = await getClient().chat.completions.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      { role: "system", content: FRAUD_SYSTEM_PROMPT },
      { role: "user", content: fraudUserPrompt(enrichedClaimData) },
    ],
  });

  const durationMs = Date.now() - start;
  const tokensUsed = (response.usage?.total_tokens ?? 0);
  const result = parseJSON<FraudAnalysisResult>(getText(response));

  return { result, tokensUsed, durationMs };
}

// 3. Indemnization Estimation
export async function estimateIndemnization(
  claimData: Record<string, unknown>
): Promise<{ result: EstimationResult; tokensUsed: number; durationMs: number }> {
  const start = Date.now();

  const response = await getClient().chat.completions.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      { role: "system", content: ESTIMATION_SYSTEM_PROMPT },
      { role: "user", content: estimationUserPrompt(claimData) },
    ],
  });

  const durationMs = Date.now() - start;
  const tokensUsed = (response.usage?.total_tokens ?? 0);
  const result = parseJSON<EstimationResult>(getText(response));

  return { result, tokensUsed, durationMs };
}

// 4. Letter Generation
export async function generateLetter(
  claimData: Record<string, unknown>,
  letterType: LetterType
): Promise<{ result: LetterResult; tokensUsed: number; durationMs: number }> {
  const start = Date.now();

  const response = await getClient().chat.completions.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      { role: "system", content: LETTER_SYSTEM_PROMPT(letterType) },
      { role: "user", content: letterUserPrompt(claimData, letterType) },
    ],
  });

  const durationMs = Date.now() - start;
  const tokensUsed = (response.usage?.total_tokens ?? 0);
  const result = parseJSON<LetterResult>(getText(response));

  return { result, tokensUsed, durationMs };
}
