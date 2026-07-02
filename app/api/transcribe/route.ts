import { NextRequest, NextResponse } from "next/server";

// ─── /api/transcribe ────────────────────────────────────────────────────────
// Transcription IA (sous-titres auto) via l'API OpenAI Whisper.
// Reçoit { url } (URL publique Storage d'un clip vidéo/audio), télécharge le
// fichier, l'envoie à Whisper avec des timestamps par segment, renvoie
// [{ start, end, text }].
//
// Nécessite la variable d'env OPENAI_API_KEY. Si absente, renvoie 501 avec un
// message clair — le bouton "Générer automatiquement" du panneau Sous-titres
// affiche alors une explication plutôt qu'une erreur muette.

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "missing_api_key", message: "OPENAI_API_KEY n'est pas configurée sur le serveur." },
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
    form.append("model", "whisper-1");
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "segment");

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
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
