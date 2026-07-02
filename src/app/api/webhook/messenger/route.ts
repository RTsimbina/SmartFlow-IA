import { NextRequest, NextResponse } from "next/server";

const MESSENGER_VERIFY_TOKEN = process.env.MESSENGER_VERIFY_TOKEN || "smartflow_verify_token";

// GET: Vérification du webhook (configuration Meta)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === MESSENGER_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'Échec de la vérification' }, { status: 403 });
}

// POST: Réception des messages Messenger
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const entry = body.entry?.[0];
    const messaging = entry?.messaging?.[0];

    if (!messaging?.message) {
      return NextResponse.json({ status: 'no_message' });
    }

    const senderId = messaging.sender?.id;
    const text = messaging.message?.text || '';

    console.log(`[MESSENGER] Message de ${senderId}: ${text}`);

    // TODO: Intégrer la réponse IA ici
    return NextResponse.json({ status: 'received', senderId, text: text.substring(0, 50) });
  } catch (error) {
    console.error('[MESSENGER] Erreur:', error);
    return NextResponse.json({ error: 'Erreur de traitement' }, { status: 500 });
  }
}