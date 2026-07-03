import { NextRequest, NextResponse } from "next/server";

// ─── /api/transcribe ────────────────────────────────────────────────────────
// Transcription IA (sous-titres auto) via une API Whisper.
// Reçoit { url } (URL publique Storage d'un clip vidéo/audio), télécharge le
// fichier, l'envoie à Whisper avec des timestamps par segment, renvoie
// [{ start, end, text }].
//
// Providers supportés (par ordre de priorité) :
//   1. GROQ_API_KEY   → Groq (Whisper large-v3-turbo, palier GRATUIT généreux)
//   2. OPENAI_API_KEY → OpenAI (whisper-1)
// Si aucune clé n'est configurée, renvoie 501 avec un message clair — le bouton
// "Générer automatiquement" affiche alors une explication plutôt qu'une erreur muette.

export async function POST(req: NextRequest) {
  try {
    const groqKey = process.env.GROQ_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    // Groq d'abord (gratuit), sinon OpenAI. Endpoint compatible OpenAI dans les deux cas.
    const provider = groqKey
      ? { key: groqKey, endpoint: "https://api.groq.com/openai/v1/audio/transcriptions", model: "whisper-large-v3-turbo" }
      : openaiKey
        ? { key: openaiKey, endpoint: "https://api.openai.com/v1/audio/transcriptions", model: "whisper-1" }
        : null;

    if (!provider) {
      return NextResponse.json(
        { ok: false, error: "missing_api_key", message: "Aucune clé de transcription configurée sur le serveur (GROQ_API_KEY ou OPENAI_API_KEY)." },
        { status: 501 },
      );
    }

    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ ok: false, error: "missing_url" }, { status: 400 });
    }

    const mediaRes = await fetch(url);
    if (!mediaRes.ok) {
      return NextResponse.json({ ok: false, error: "fetch_media_failed" }, { status: 502 });
    }
    const mediaBlob = await mediaRes.blob();

    const contentType = mediaRes.headers.get("content-type") || "video/mp4";
    const ext = contentType.includes("webm") ? "webm" : contentType.includes("quicktime") ? "mov" : "mp4";

    const form = new FormData();
    form.append("file", mediaBlob, `clip.${ext}`);
    form.append("model", provider.model);
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "segment");

    const whisperRes = await fetch(provider.endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${provider.key}` },
      body: form,
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      console.error("[transcribe] Whisper error:", errText);
      return NextResponse.json({ ok: false, error: "whisper_failed", message: errText }, { status: 502 });
    }

    const data = await whisperRes.json();
    const segments: { start: number; end: number; text: string }[] = (data.segments || []).map(
      (s: { start: number; end: number; text: string }) => ({
        start: s.start,
        end: s.end,
        text: s.text.trim(),
      }),
    );

    return NextResponse.json({ ok: true, segments });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[transcribe] fatal:", msg);
    return NextResponse.json({ ok: false, error: "fatal", message: msg }, { status: 500 });
  }
}
