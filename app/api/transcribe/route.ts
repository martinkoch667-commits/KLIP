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
      // État attendu (feature non configurée) : on renvoie 200 pour éviter une
      // erreur "Failed to load resource" rouge dans la console — le client lit
      // { ok:false } et affiche un toast explicatif.
      return NextResponse.json(
        { ok: false, error: "missing_api_key", message: "Sous-titres auto indisponibles : aucune clé de transcription (GROQ_API_KEY ou OPENAI_API_KEY) n'est configurée sur le serveur." },
        { status: 200 },
      );
    }

    // Deux modes d'entrée :
    //  • multipart/form-data avec un champ "audio" → le client a déjà extrait le son
    //    (WAV léger). C'est le chemin normal : évite d'envoyer une vidéo entière trop
    //    lourde pour l'API ("Request Entity Too Large").
    //  • JSON { url } → repli : le serveur télécharge le média et le transmet tel quel.
    const reqCt = req.headers.get("content-type") || "";
    let mediaBlob: Blob;
    let filename = "clip.mp4";

    if (reqCt.includes("multipart/form-data")) {
      const fd = await req.formData();
      const audio = fd.get("audio");
      if (!(audio instanceof Blob)) {
        return NextResponse.json({ ok: false, error: "missing_audio" }, { status: 400 });
      }
      mediaBlob = audio;
      filename = "audio.wav";
    } else {
      const { url } = await req.json();
      if (!url || typeof url !== "string") {
        return NextResponse.json({ ok: false, error: "missing_url" }, { status: 400 });
      }
      const mediaRes = await fetch(url);
      if (!mediaRes.ok) {
        return NextResponse.json({ ok: false, error: "fetch_media_failed" }, { status: 502 });
      }
      mediaBlob = await mediaRes.blob();
      const contentType = mediaRes.headers.get("content-type") || "video/mp4";
      const ext = contentType.includes("webm") ? "webm" : contentType.includes("quicktime") ? "mov" : "mp4";
      filename = `clip.${ext}`;
    }

    const form = new FormData();
    form.append("file", mediaBlob, filename);
    form.append("model", provider.model);
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "segment");
    // Horodatage au MOT : nécessaire à la découpe fine (hésitations, faux départs,
    // répétitions). Whisper l'ignore silencieusement s'il ne le supporte pas.
    form.append("timestamp_granularities[]", "word");

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

    // Mots horodatés (peut être absent selon le fournisseur/modèle).
    const words: { start: number; end: number; word: string }[] = (data.words || []).map(
      (w: { start: number; end: number; word: string }) => ({
        start: w.start,
        end: w.end,
        word: (w.word || "").trim(),
      }),
    ).filter((w: { word: string }) => w.word);

    return NextResponse.json({ ok: true, segments, words });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[transcribe] fatal:", msg);
    return NextResponse.json({ ok: false, error: "fatal", message: msg }, { status: 500 });
  }
}
