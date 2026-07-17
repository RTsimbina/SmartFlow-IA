import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { checkAuth } from '@/lib/authorize';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  const authError = await checkAuth(request);
  if (authError) return authError;

  const { searchParams } = request.nextUrl;
  const identifiant = searchParams.get('identifiant')?.trim();
  const typePrestation = searchParams.get('typePrestation')?.trim() || '';
  const montantDemande = parseFloat(searchParams.get('montantDemande') || '0');

  if (!identifiant) {
    return Response.json(
      { erreur: "L'identifiant de l'assuré est requis (nSS ou ID)." },
      { status: 400 }
    );
  }

  try {
    // 1. Rechercher l'assuré par nSS ou id
    const assure = await prisma.assure.findFirst({
      where: {
        OR: [
          { nSS: identifiant },
          { id: identifiant },
        ],
      },
      include: {
        societe: {
          include: {
            contrats: {
              where: { statut: 'ACTIF' },
              orderBy: { dateDebut: 'desc' },
              take: 1,
            },
            baremes: {
              where: { active: true },
            },
          },
        },
      },
    });

    if (!assure) {
      return Response.json(
        { erreur: `Aucun assuré trouvé avec l'identifiant "${identifiant}".` },
        { status: 404 }
      );
    }

    const societe = assure.societe;
    const contratActif = societe.contrats[0] || null;
    const baremes = societe.baremes;

    // 2. Vérifier que l'assuré est actif
    const assureActif = assure.actif;
    const alertes: { type: 'danger' | 'warning' | 'info'; message: string }[] = [];

    if (!assureActif) {
      alertes.push({
        type: 'danger',
        message: "L'assuré est INACTIF. Aucune prise en charge ne peut être effectuée.",
      });
    }

    // 3. Vérifier le plafond annuel global (via Contrat)
    let plafondAnnuelGlobal = 0;
    let consommationAnnuelle = 0;
    let tauxConsommationGlobal = 0;
    let seuilGlobal: 'ok' | 'attention' | 'atteint' | 'depasse' = 'ok';

    if (contratActif) {
      plafondAnnuelGlobal = contratActif.budgetAnnuel;
      consommationAnnuelle = contratActif.budgetUtilise;
      tauxConsommationGlobal = plafondAnnuelGlobal > 0
        ? (consommationAnnuelle / plafondAnnuelGlobal) * 100
        : 0;

      if (tauxConsommationGlobal >= 100) {
        seuilGlobal = 'depasse';
        alertes.push({
          type: 'danger',
          message: `Le plafond annuel global est DÉPASSÉ (${tauxConsommationGlobal.toFixed(1)}%). L'assuré ne peut plus bénéficier de prise en charge cette année.`,
        });
      } else if (tauxConsommationGlobal >= 100) {
        seuilGlobal = 'atteint';
        alertes.push({
          type: 'danger',
          message: `Le plafond annuel global est ATTEINT à 100%. Plus aucune prise en charge possible cette année.`,
        });
      } else if (tauxConsommationGlobal >= 70) {
        seuilGlobal = 'attention';
        alertes.push({
          type: 'warning',
          message: `Le plafond annuel global est atteint à ${tauxConsommationGlobal.toFixed(1)}% (seuil d'alerte 70%). Reste ${formatMontant(plafondAnnuelGlobal - consommationAnnuelle)}.`,
        });
      }
    } else {
      alertes.push({
        type: 'warning',
        message: "Aucun contrat actif trouvé pour la société. Vérification des plafonds impossible.",
      });
    }

    // 4. Vérifier le plafond spécifique par acte (via Bareme)
    let baremeActe: { prestation: string; tauxCouverture: number; plafond: number; description?: string | null } | null = null;
    let consommationActe = 0;
    let plafondActe = 0;
    let tauxCouverture = 0;
    let reliquatActe = 0;
    let seuilActe: 'ok' | 'attention' | 'atteint' | 'depasse' | 'non_defini' = 'non_defini';

    if (typePrestation && baremes.length > 0) {
      baremeActe = baremes.find(
        (b) => b.prestation.toLowerCase() === typePrestation.toLowerCase()
      ) || baremes.find(
        (b) => typePrestation.toLowerCase().includes(b.prestation.toLowerCase()) ||
               b.prestation.toLowerCase().includes(typePrestation.toLowerCase())
      ) || null;

      if (baremeActe) {
        plafondActe = baremeActe.plafond;
        tauxCouverture = baremeActe.tauxCouverture;

        // Calculer la consommation pour cet acte depuis les dossiers de l'assuré
        const dossiersActe = await prisma.dossier.findMany({
          where: {
            assureId: assure.id,
            typeDossier: { contains: typePrestation },
            statut: { not: 'REJETE' },
          },
          select: {
            montantValide: true,
            montantReclame: true,
            statut: true,
          },
        });

        consommationActe = dossiersActe.reduce(
          (sum, d) => sum + (d.montantValide ?? d.montantReclame),
          0
        );

        reliquatActe = Math.max(0, plafondActe - consommationActe);
        const tauxConsommationActe = plafondActe > 0
          ? (consommationActe / plafondActe) * 100
          : 0;

        if (tauxConsommationActe >= 100) {
          seuilActe = 'depasse';
          alertes.push({
            type: 'danger',
            message: `Le plafond spécifique pour l'acte "${typePrestation}" est DÉPASSÉ (${tauxConsommationActe.toFixed(1)}%). L'acte ne peut pas être pris en charge.`,
          });
        } else if (tauxConsommationActe >= 100) {
          seuilActe = 'atteint';
          alertes.push({
            type: 'danger',
            message: `Le plafond spécifique pour l'acte "${typePrestation}" est ATTEINT à 100%. L'acte ne peut plus être effectué.`,
          });
        } else if (tauxConsommationActe >= 70) {
          seuilActe = 'attention';
          alertes.push({
            type: 'warning',
            message: `Le plafond pour l'acte "${typePrestation}" est atteint à ${tauxConsommationActe.toFixed(1)}%. Reliquat : ${formatMontant(reliquatActe)}.`,
          });
        } else {
          seuilActe = 'ok';
        }

        // 5. Vérifier que le montant demandé ne dépasse pas le reliquat
        if (montantDemande > 0 && reliquatActe > 0) {
          if (montantDemande > reliquatActe) {
            alertes.push({
              type: 'danger',
              message: `Le montant demandé (${formatMontant(montantDemande)}) dépasse le reliquat disponible (${formatMontant(reliquatActe)}). L'acte ne peut pas être intégralement pris en charge. Part non couverte : ${formatMontant(montantDemande - reliquatActe)}.`,
            });
          } else {
            alertes.push({
              type: 'info',
              message: `Le montant demandé (${formatMontant(montantDemande)}) est inférieur au reliquat disponible (${formatMontant(reliquatActe)}). L'acte peut être pris en charge.`,
            });
          }
        }
      } else {
        alertes.push({
          type: 'warning',
          message: `Aucun barème trouvé pour l'acte "${typePrestation}" dans la société ${societe.nom}. Vérification impossible.`,
        });
      }
    }

    // 6. Rechercher les actes identiques déjà réalisés par l'assuré
    const actesPasse = await prisma.dossier.findMany({
      where: {
        assureId: assure.id,
        ...(typePrestation ? { typeDossier: { contains: typePrestation } } : {}),
        statut: { not: 'REJETE' },
      },
      include: {
        societe: { select: { nom: true } },
        prestataire: { select: { nom: true } },
      },
      orderBy: { dateSoins: 'desc' },
      take: 20,
    });

    // Calculer le reliquat global
    const reliquatGlobal = contratActif
      ? Math.max(0, plafondAnnuelGlobal - consommationAnnuelle)
      : 0;

    return Response.json({
      assure: {
        id: assure.id,
        nom: assure.nom,
        prenom: assure.prenom,
        nSS: assure.nSS,
        dateNaissance: assure.dateNaissance,
        sexe: assure.sexe,
        telephone: assure.telephone,
        email: assure.email,
        adresse: assure.adresse,
        actif: assure.actif,
      },
      societe: {
        id: societe.id,
        nom: societe.nom,
      },
      contrat: contratActif
        ? {
            id: contratActif.id,
            reference: contratActif.reference,
            budgetAnnuel: contratActif.budgetAnnuel,
            budgetUtilise: contratActif.budgetUtilise,
            dateDebut: contratActif.dateDebut,
            dateFin: contratActif.dateFin,
            statut: contratActif.statut,
          }
        : null,
      plafondGlobal: {
        budgetAnnuel: plafondAnnuelGlobal,
        consommation: consommationAnnuelle,
        tauxConsommation: Math.round(tauxConsommationGlobal * 10) / 10,
        reliquat: reliquatGlobal,
        seuil: seuilGlobal,
      },
      plafondActe: typePrestation && baremeActe
        ? {
            prestation: baremeActe.prestation,
            tauxCouverture: baremeActe.tauxCouverture,
            plafond: baremeActe.plafond,
            description: baremeActe.description,
            consommation: consommationActe,
            reliquat: reliquatActe,
            seuil: seuilActe,
          }
        : null,
      montantDemande: montantDemande > 0 ? montantDemande : null,
      montantCouverture: montantDemande > 0 && baremeActe
        ? {
            montantBrut: montantDemande,
            tauxCouverture: baremeActe.tauxCouverture,
            montantCouvert: Math.min(montantDemande, reliquatActe) * (baremeActe.tauxCouverture / 100),
            partAssure: montantDemande - (Math.min(montantDemande, reliquatActe) * (baremeActe.tauxCouverture / 100)),
            depasseReliquat: montantDemande > reliquatActe,
            ecartReliquat: montantDemande > reliquatActe ? montantDemande - reliquatActe : 0,
          }
        : null,
      actesPasses: actesPasse.map((d) => ({
        id: d.id,
        numeroDossier: d.numeroDossier,
        typeDossier: d.typeDossier,
        dateSoins: d.dateSoins,
        montantReclame: d.montantReclame,
        montantValide: d.montantValide,
        statut: d.statut,
        prestataire: d.prestataire?.nom || d.prestataireLegacy || null,
      })),
      alertes,
      verificationPossible: assureActif && seuilGlobal !== 'depasse' && seuilActe !== 'depasse' && seuilActe !== 'atteint',
    });
  } catch (error) {
    console.error('Erreur vérification assuré:', error);
    return Response.json(
      { erreur: 'Erreur interne lors de la vérification de l\'assuré.' },
      { status: 500 }
    );
  }
}

function formatMontant(montant: number): string {
  return new Intl.NumberFormat('fr-FR').format(montant) + ' Ar';
}