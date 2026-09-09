import { NextResponse } from "next/server";
import { readdir } from "fs/promises";
import path from "path";

/* GET /api/vitrine — liste les visuels de vitrine déposés dans `public/vitrine/`.
 *
 * POURQUOI UNE ROUTE PLUTÔT QU'UNE LISTE ÉCRITE À LA MAIN. La page d'offre doit
 * montrer les plus beaux visuels, et c'est Martin qui les choisit. Lui demander
 * de tenir une liste dans le code à chaque ajout, c'est une occasion d'oubli à
 * chaque fois : le fichier est là mais n'apparaît pas, ou il est retiré et la
 * page pointe dans le vide. Ici on lit le dossier, donc déposer le fichier
 * SUFFIT.
 *
 * L'ordre est celui du nom de fichier : `01-…`, `02-…` décident de la place
 * dans la rangée.
 */

export const dynamic = "force-dynamic";

const EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

export async function GET() {
  try {
    const dossier = path.join(process.cwd(), "public", "vitrine");
    const fichiers = await readdir(dossier);
    const visuels = fichiers
      .filter(f => !f.startsWith(".") && EXTENSIONS.has(path.extname(f).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, "fr", { numeric: true }))
      .map(f => `/vitrine/${f}`);
    return NextResponse.json({ visuels });
  } catch {
    // Dossier absent ou illisible : la page compose ses propres visuels.
    return NextResponse.json({ visuels: [] });
  }
}
