import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

/**
 * Endpoint unique pour créer l'utilisateur SANTE dans une base existante.
 * Appeler UNE FOIS : GET /api/setup/create-sante?token=VOTRE_SETUP_TOKEN
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token || token !== process.env.SETUP_TOKEN) {
    return NextResponse.json({ erreur: 'Token invalide' }, { status: 403 });
  }

  try {
    const db = new PrismaClient();
    const email = 'sante@suivisante.mg';
    const nom = 'Naina Santé';
    const role = 'SANTE';
    const password = 'SuiviSante@2026';

    // Vérifier si l'utilisateur existe déjà
    const existing = await db.utilisateur.findUnique({ where: { email } });

    if (existing) {
      await db.$disconnect();
      if (existing.role !== role) {
        const db2 = new PrismaClient();
        await db2.utilisateur.update({ where: { email }, data: { role } });
        await db2.$disconnect();
        return NextResponse.json({
          success: true,
          message: `Rôle mis à jour pour ${email}`,
          ancienRole: existing.role,
          nouveauRole: role,
        });
      }
      return NextResponse.json({
        success: true,
        message: `L'utilisateur ${email} existe déjà avec le rôle ${role}`,
      });
    }

    // Créer l'utilisateur
    const passwordHash = await hash(password, 10);
    const user = await db.utilisateur.create({
      data: { email, nom, password: passwordHash, role },
    });

    await db.$disconnect();

    return NextResponse.json({
      success: true,
      message: 'Utilisateur Contrôleur Santé créé avec succès',
      utilisateur: {
        email: user.email,
        nom: user.nom,
        role: user.role,
        motDePasse: password,
      },
    });
  } catch (error) {
    console.error('Erreur création utilisateur SANTE:', error);
    return NextResponse.json(
      { erreur: 'Erreur lors de la création de l\'utilisateur' },
      { status: 500 }
    );
  }
}