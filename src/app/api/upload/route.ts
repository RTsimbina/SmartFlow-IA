import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAuth } from "@/lib/authorize";
import { promises as fs } from "fs";
import path from "path";

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const VALID_JUSTIFICATIF_TYPES = [
  "FACTURE",
  "ORDONNANCE",
  "RIB",
  "CARNET_SOINS",
  "DECOMPTE",
  "AUTRE",
];

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "justificatifs");

// ─── POST : Upload d'un justificatif ─────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const authError = await checkAuth(request);
    if (authError) return authError;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const dossierId = formData.get("dossierId") as string | null;
    const type = formData.get("type") as string | null;

    // Validations
    if (!file) {
      return NextResponse.json(
        { erreur: "Fichier manquant" },
        { status: 400 }
      );
    }

    if (!dossierId) {
      return NextResponse.json(
        { erreur: "dossierId manquant" },
        { status: 400 }
      );
    }

    if (!type || !VALID_JUSTIFICATIF_TYPES.includes(type)) {
      return NextResponse.json(
        {
          erreur: `Type invalide. Valeurs autorisées : ${VALID_JUSTIFICATIF_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // MIME type check
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          erreur: `Type MIME non autorisé. Types acceptés : ${ALLOWED_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // File size check
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { erreur: "Fichier trop volumineux (max 10 Mo)" },
        { status: 400 }
      );
    }

    // Vérifier que le dossier existe
    const dossier = await db.dossier.findUnique({
      where: { id: dossierId },
    });

    if (!dossier) {
      return NextResponse.json(
        { erreur: "Dossier introuvable" },
        { status: 404 }
      );
    }

    // S'assurer que le répertoire d'upload existe
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    // Construire un nom de fichier unique
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueName = `${dossierId}_${timestamp}_${safeName}`;
    const filePath = path.join(UPLOAD_DIR, uniqueName);

    // Écrire le fichier sur le disque
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await fs.writeFile(filePath, buffer);

    // Récupérer l'ID de l'utilisateur
    const userId = request.headers.get("x-user-id") || null;

    // Créer l'enregistrement en base
    const justificatif = await db.justificatif.create({
      data: {
        dossierId,
        type,
        nomFichier: file.name,
        chemin: `uploads/justificatifs/${uniqueName}`,
        tailleKo: Math.round((file.size / 1024) * 100) / 100,
        uploadedBy: userId,
      },
    });

    return NextResponse.json(justificatif, { status: 201 });
  } catch (error) {
    console.error("Erreur lors de l'upload :", error);
    return NextResponse.json(
      { erreur: "Erreur lors de l'upload du justificatif" },
      { status: 500 }
    );
  }
}

// ─── GET : Téléchargement d'un justificatif ──────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const authError = await checkAuth(request);
    if (authError) return authError;

    const id = request.nextUrl.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { erreur: "Paramètre 'id' manquant" },
        { status: 400 }
      );
    }

    const justificatif = await db.justificatif.findUnique({
      where: { id },
    });

    if (!justificatif) {
      return NextResponse.json(
        { erreur: "Justificatif introuvable" },
        { status: 404 }
      );
    }

    // Lire le fichier depuis le disque
    const filePath = path.join(process.cwd(), justificatif.chemin);
    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(filePath);
    } catch {
      return NextResponse.json(
        { erreur: "Fichier introuvable sur le disque" },
        { status: 404 }
      );
    }

    // Déterminer le Content-Type à partir de l'extension
    const ext = path.extname(justificatif.nomFichier).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".pdf": "application/pdf",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
    };
    const contentType = mimeMap[ext] || "application/octet-stream";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(justificatif.nomFichier)}"`,
      },
    });
  } catch (error) {
    console.error("Erreur lors du téléchargement :", error);
    return NextResponse.json(
      { erreur: "Erreur lors du téléchargement du justificatif" },
      { status: 500 }
    );
  }
}