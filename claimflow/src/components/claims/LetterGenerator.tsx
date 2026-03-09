"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { LetterResult, LetterType } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Copy, Check, Send } from "lucide-react";

const LETTER_TYPES: { value: LetterType; label: string }[] = [
  { value: "ACKNOWLEDGMENT", label: "Accusé de réception" },
  { value: "DOCUMENT_REQUEST", label: "Demande de pièces" },
  { value: "APPROVAL", label: "Notification d'approbation" },
  { value: "REJECTION", label: "Notification de refus" },
  { value: "INFO_REQUEST", label: "Demande d'information" },
];

interface LetterGeneratorProps {
  claimId: string;
  policyholderEmail?: string;
}

export function LetterGenerator({ claimId, policyholderEmail }: LetterGeneratorProps) {
  const [letterType, setLetterType] = useState<LetterType>("ACKNOWLEDGMENT");
  const [loading, setLoading] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [letter, setLetter] = useState<LetterResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Email state
  const [emailTo, setEmailTo] = useState(policyholderEmail || "");
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const generateLetter = async () => {
    setLoading(true);
    setLetter(null);
    setStreamedText("");
    setError(null);
    setSendSuccess(false);
    setSendError(null);

    try {
      const res = await fetch("/api/ai/letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimId, letterType, stream: true }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json();
        throw new Error(data.error ?? "Erreur serveur");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;

        // Check for metadata marker at end
        const metaIdx = accumulated.indexOf("__META__");
        const errIdx = accumulated.indexOf("__ERROR__");

        if (errIdx !== -1) {
          throw new Error(accumulated.slice(errIdx + 9));
        }

        if (metaIdx !== -1) {
          // Display body up to the marker
          setStreamedText(accumulated.slice(0, metaIdx));
          // Parse the final structured result
          try {
            const meta = JSON.parse(accumulated.slice(metaIdx + 8));
            setLetter(meta.result);
          } catch {
            // fallback: show raw streamed text
          }
        } else {
          setStreamedText(accumulated);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  const copyLetter = async () => {
    const text = letter
      ? `Objet: ${letter.subject}\n\n${cleanText(letter.body)}\n\n${cleanText(letter.closing ?? "")}`
      : streamedClean;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendEmail = async () => {
    if (!letter || !emailTo) return;
    if (!letter.subject || !letter.body) {
      setSendError("Le courrier est incomplet (sujet ou corps manquant). Régénérez le courrier.");
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch("/api/ai/letter/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimId,
          to: emailTo,
          subject: letter.subject,
          body: letter.body,
          closing: letter.closing,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.sent) {
        setSendSuccess(true);
        setTimeout(() => setSendSuccess(false), 4000);
      } else if (data.mailto) {
        // Open in local email client
        window.open(data.mailto);
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Erreur envoi");
    } finally {
      setSending(false);
    }
  };

  // Strip only markdown code block markers — never touch the actual content
  const cleanText = (text: string) =>
    text
      .replace(/```json\s*/gi, "")
      .replace(/```/g, "")
      .trim();

  // Detect JSON/code artifacts in streamed text (should not be shown raw)
  const streamedClean = cleanText(streamedText);
  const isRawJson = streamedClean.length === 0 ||
    streamedText.trim().startsWith("{") ||
    streamedText.trim().startsWith("[") ||
    streamedText.trim().startsWith("```");

  return (
    <Card className="border-2 border-indigo-100 bg-indigo-50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-5 w-5 text-indigo-600" />
          Génération de courrier
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-3">
          <Select
            value={letterType}
            onChange={(e) => setLetterType(e.target.value as LetterType)}
            options={LETTER_TYPES}
            className="flex-1"
            disabled={loading}
          />
          <Button
            onClick={generateLetter}
            disabled={loading}
            variant="outline"
            className="border-indigo-300 text-indigo-700 hover:bg-indigo-100"
          >
            {loading ? <><Spinner size="sm" /><span className="ml-2">Rédaction…</span></> : "Générer"}
          </Button>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
        )}

        {/* Streaming display — appears while generating */}
        {loading && streamedText && !letter && (
          <div className="bg-white rounded border border-indigo-200 p-4">
            {isRawJson ? (
              <span className="text-sm text-indigo-500 italic flex items-center gap-2">
                <Spinner size="sm" />
                Mise en forme du courrier…
              </span>
            ) : (
              <p className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                {streamedClean}
                <span className="inline-block w-1.5 h-4 bg-indigo-400 ml-0.5 animate-pulse" />
              </p>
            )}
          </div>
        )}

        {/* Final structured letter */}
        {letter && (
          <div className="bg-white rounded border p-4 space-y-3">
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase">Objet</span>
              <p className="font-medium text-sm mt-1">{letter.subject}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase">Corps</span>
              <p className="text-sm mt-1 whitespace-pre-line text-gray-700">{cleanText(letter.body)}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase">Formule de politesse</span>
              <p className="text-sm mt-1 italic text-gray-600">{cleanText(letter.closing ?? "")}</p>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-1 border-t">
              <Button onClick={copyLetter} variant="ghost" size="sm" className="text-indigo-600">
                {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                {copied ? "Copié !" : "Copier"}
              </Button>
            </div>

            {/* Email send section */}
            <div className="pt-2 border-t space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase">Envoyer par email</p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="Email du destinataire"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  className="flex-1 text-sm"
                  disabled={sending}
                />
                <Button
                  onClick={sendEmail}
                  disabled={sending || !emailTo}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {sending ? <Spinner size="sm" /> : <Send className="h-4 w-4" />}
                  <span className="ml-1.5">{sending ? "Envoi…" : "Envoyer"}</span>
                </Button>
              </div>
              {sendSuccess && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <Check className="h-3 w-3" /> Email envoyé avec succès
                </p>
              )}
              {sendError && (
                <p className="text-xs text-red-600">{sendError}</p>
              )}
            </div>
          </div>
        )}

        {/* Fallback: stream completed but JSON parse totally failed */}
        {!loading && !letter && streamedText && (
          <div className="bg-yellow-50 rounded border border-yellow-200 p-4 space-y-2">
            <p className="text-xs text-yellow-700 font-medium">
              La mise en forme automatique a échoué. Voici le courrier brut :
            </p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{streamedClean}</p>
            <Button onClick={copyLetter} variant="ghost" size="sm" className="text-indigo-600">
              {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
              {copied ? "Copié !" : "Copier le courrier"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
