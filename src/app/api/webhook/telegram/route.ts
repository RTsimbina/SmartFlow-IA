import { NextRequest, NextResponse } from "next/server";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

// GET: Information sur le bot (healthcheck)
export async function GET() {
  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ status: 'not_configured', message: 'TELEGRAM_BOT_TOKEN non défini' });
  }
  return NextResponse.json({ status: 'active', bot: 'SmartFlow IA Telegram Bot' });
}

// POST: Réception des messages Telegram
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = body.message;

    if (!message) {
      return NextResponse.json({ status: 'no_message' });
    }

    const chatId = message.chat.id;
    const text = message.text || '';
    const from = message.from;

    console.log(`[TELEGRAM] Message de ${from?.first_name || 'Inconnu'} (${chatId}): ${text}`);

    // TODO: Intégrer la réponse IA ici
    return NextResponse.json({ status: 'received', chatId, text: text.substring(0, 50) });
  } catch (error) {
    console.error('[TELEGRAM] Erreur:', error);
    return NextResponse.json({ error: 'Erreur de traitement' }, { status: 500 });
  }
}