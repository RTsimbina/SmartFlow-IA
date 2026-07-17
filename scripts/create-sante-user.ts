/**
 * Script d'insertion de l'utilisateur SANTE dans la base de données.
 * Utilisation : npx tsx scripts/create-sante-user.ts
 * ou : node -e "require('./scripts/create-sante-user.cjs')"
 */
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'sante@suivisante.mg';
  const nom = 'Naina Santé';
  const role = 'SANTE';
  const password = 'SuiviSante@2026';

  // Vérifier si l'utilisateur existe déjà
  const existing = await prisma.utilisateur.findUnique({ where: { email } });

  if (existing) {
    console.log(`✅ L'utilisateur "${email}" existe déjà (rôle: ${existing.role}).`);
    // Mettre à jour le rôle si nécessaire
    if (existing.role !== role) {
      await prisma.utilisateur.update({ where: { email }, data: { role } });
      console.log(`🔄 Rôle mis à jour : ${existing.role} → ${role}`);
    }
    return;
  }

  // Créer l'utilisateur
  const passwordHash = await hash(password, 10);
  const user = await prisma.utilisateur.create({
    data: { email, nom, password: passwordHash, role },
  });

  console.log(`✅ Utilisateur créé avec succès !`);
  console.log(`   Email    : ${user.email}`);
  console.log(`   Nom      : ${user.nom}`);
  console.log(`   Rôle     : ${user.role}`);
  console.log(`   Mot de passe : ${password}`);
}

main()
  .catch((e) => { console.error('❌ Erreur :', e); process.exit(1); })
  .finally(() => prisma.$disconnect());