import { NextRequest, NextResponse } from "next/server";

const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "smartflow_verify_token";

// GET: Vérification du webhook (configuration Meta)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'Échec de la vérification' }, { status: 403 });
}

// POST: Réception des messages WhatsApp
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Extraire le message et le numéro de téléphone
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages?.[0];
    const contacts = value?.contacts?.[0];

    if (!messages) {
      return NextResponse.json({ status: 'no_message' });
    }

    const from = messages.from;
    const text = messages.text?.body || '';
    const contactName = contacts?.profile?.name || 'Inconnu';

    console.log(`[WHATSAPP] Message de ${contactName} (${from}): ${text}`);

    // TODO: Intégrer la réponse IA ici
    // Pour l'instant, répondre avec un accusé de réception
    return NextResponse.json({ status: 'received', from, text: text.substring(0, 50) });
  } catch (error) {
    console.error('[WHATSAPP] Erreur:', error);
    return NextResponse.json({ error: 'Erreur de traitement' }, { status: 500 });
  }
}