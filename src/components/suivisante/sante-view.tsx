'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, CheckCircle2, XCircle, Info, Search, Shield, User, Building2, Activity, History, DollarSign, AlertOctagon } from 'lucide-react';
import { formatDate, formatMontant } from './format';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Alerte {
  type: 'danger' | 'warning' | 'info';
  message: string;
}

interface AssureData {
  id: string;
  nom: string;
  prenom: string | null;
  nSS: string | null;
  dateNaissance: string | null;
  sexe: string | null;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  actif: boolean;
}

interface SocieteData {
  id: string;
  nom: string;
}

interface ContratData {
  id: string;
  reference: string;
  budgetAnnuel: number;
  budgetUtilise: number;
  dateDebut: string;
  dateFin: string;
  statut: string;
}

interface PlafondGlobalData {
  budgetAnnuel: number;
  consommation: number;
  tauxConsommation: number;
  reliquat: number;
  seuil: 'ok' | 'attention' | 'atteint' | 'depasse';
}

interface PlafondActeData {
  prestation: string;
  tauxCouverture: number;
  plafond: number;
  description: string | null;
  consommation: number;
  reliquat: number;
  seuil: 'ok' | 'attention' | 'atteint' | 'depasse' | 'non_defini';
}

interface MontantCouvertureData {
  montantBrut: number;
  tauxCouverture: number;
  montantCouvert: number;
  partAssure: number;
  depasseReliquat: boolean;
  ecartReliquat: number;
}

interface ActePasse {
  id: string;
  numeroDossier: string;
  typeDossier: string;
  dateSoins: string | null;
  montantReclame: number;
  montantValide: number | null;
  statut: string;
  prestataire: string | null;
}

interface VerificationResult {
  assure: AssureData;
  societe: SocieteData;
  contrat: ContratData | null;
  plafondGlobal: PlafondGlobalData;
  plafondActe: PlafondActeData | null;
  montantDemande: number | null;
  montantCouverture: MontantCouvertureData | null;
  actesPasses: ActePasse[];
  alertes: Alerte[];
  verificationPossible: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SanteView() {
  const [identifiant, setIdentifiant] = useState('');
  const [typePrestation, setTypePrestation] = useState('');
  const [montantDemande, setMontantDemande] = useState('');
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!identifiant.trim()) {
      setError("Veuillez saisir l'identifiant de l'assuré.");
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    setSearched(true);

    try {
      const params = new URLSearchParams({ identifiant: identifiant.trim() });
      if (typePrestation.trim()) params.set('typePrestation', typePrestation.trim());
      if (montantDemande.trim()) params.set('montantDemande', montantDemande.trim());

      const res = await fetch(`/api/sante/verifier-assure?${params}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.erreur || 'Erreur lors de la vérification.');
        return;
      }

      setResult(data);
    } catch {
      setError('Erreur de connexion au serveur.');
    } finally {
      setLoading(false);
    }
  }, [identifiant, typePrestation, montantDemande]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  // ─── Rendu de la jauge de consommation ──────────────────────────────────────

  function SeuilBar({ taux, seuil, label }: { taux: number; seuil: string; label: string }) {
    const getColor = () => {
      if (seuil === 'depasse' || seuil === 'atteint') return 'bg-red-500';
      if (seuil === 'attention') return 'bg-amber-500';
      return 'bg-emerald-500';
    };
    const getTextColor = () => {
      if (seuil === 'depasse' || seuil === 'atteint') return 'text-red-600 dark:text-red-400';
      if (seuil === 'attention') return 'text-amber-600 dark:text-amber-400';
      return 'text-emerald-600 dark:text-amber-400';
    };
    const getLabel = () => {
      if (seuil === 'depasse') return 'Dépassé';
      if (seuil === 'atteint') return 'Atteint 100%';
      if (seuil === 'attention') return 'Attention 70%+';
      return 'Normal';
    };

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{label}</span>
          <span className={`font-semibold ${getTextColor()}`}>{taux.toFixed(1)}% — {getLabel()}</span>
        </div>
        <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getColor()}`}
            style={{ width: `${Math.min(taux, 100)}%` }}
          />
        </div>
        {/* Marqueurs 70% et 100% */}
        <div className="relative h-2">
          <div className="absolute left-[70%] -translate-x-1/2 flex flex-col items-center">
            <div className="h-3 w-px bg-amber-400" />
            <span className="text-[9px] text-amber-500 mt-0.5">70%</span>
          </div>
          <div className="absolute left-[100%] -translate-x-1/2 flex flex-col items-center">
            <div className="h-3 w-px bg-red-400" />
            <span className="text-[9px] text-red-500 mt-0.5">100%</span>
          </div>
        </div>
      </div>
    );
  }

  // ─── Rendu des alertes ─────────────────────────────────────────────────────

  function AlertesPanel({ alertes }: { alertes: Alerte[] }) {
    if (alertes.length === 0) {
      return (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-700 dark:text-emerald-300">Aucune alerte. La vérification est positive.</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {alertes.map((a, i) => {
          const config = {
            danger: {
              bg: 'bg-red-50 dark:bg-red-950/30',
              border: 'border-red-200 dark:border-red-900',
              text: 'text-red-700 dark:text-red-300',
              Icon: XCircle,
              iconColor: 'text-red-500',
            },
            warning: {
              bg: 'bg-amber-50 dark:bg-amber-950/30',
              border: 'border-amber-200 dark:border-amber-900',
              text: 'text-amber-700 dark:text-amber-300',
              Icon: AlertTriangle,
              iconColor: 'text-amber-500',
            },
            info: {
              bg: 'bg-sky-50 dark:bg-sky-950/30',
              border: 'border-sky-200 dark:border-sky-900',
              text: 'text-sky-700 dark:text-sky-300',
              Icon: Info,
              iconColor: 'text-sky-500',
            },
          }[a.type];

          const Icon = config.Icon;
          return (
            <div key={i} className={`flex items-start gap-2 p-3 rounded-lg border ${config.bg} ${config.border}`}>
              <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${config.iconColor}`} />
              <p className={`text-sm ${config.text}`}>{a.message}</p>
            </div>
          );
        })}
      </div>
    );
  }

  // ─── Contenu principal ──────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Carte de recherche */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Vérification de Couverture Assuré
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Recherchez un assuré par son numéro de sécurité sociale ou identifiant pour vérifier ses droits de couverture.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Identifiant Assuré (nSS ou ID)</label>
              <Input
                placeholder="Ex: 1234567890123"
                value={identifiant}
                onChange={(e) => setIdentifiant(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Type de prestation (optionnel)</label>
              <Input
                placeholder="Ex: Consultation, Chirurgie..."
                value={typePrestation}
                onChange={(e) => setTypePrestation(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Montant demandé (optionnel)</label>
              <Input
                type="number"
                placeholder="Ex: 150000"
                value={montantDemande}
                onChange={(e) => setMontantDemande(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
          </div>
          <Button
            onClick={handleSearch}
            disabled={loading || !identifiant.trim()}
            className="mt-4 bg-emerald-600 hover:bg-emerald-700"
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            {loading ? 'Vérification...' : 'Vérifier la couverture'}
          </Button>
        </CardContent>
      </Card>

      {/* Erreur */}
      {error && (
        <Card className="border-red-200 dark:border-red-900">
          <CardContent className="flex items-center gap-3 p-4">
            <XCircle className="h-5 w-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-60 w-full rounded-xl" />
        </div>
      )}

      {/* Résultats */}
      {result && !loading && (
        <div className="space-y-4">
          {/* Aperçu : vérification possible ou non */}
          <div className={`flex items-center gap-3 p-4 rounded-xl border ${
            result.verificationPossible
              ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900'
              : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900'
          }`}>
            {result.verificationPossible ? (
              <>
                <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-700 dark:text-emerald-300">Vérification favorable</p>
                  <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80">
                    L&apos;assuré est éligible pour la prise en demandée, sous réserve de validation finale.
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertOctagon className="h-6 w-6 text-red-600 dark:text-red-400 shrink-0" />
                <div>
                  <p className="font-semibold text-red-700 dark:text-red-300">Vérification défavorable</p>
                  <p className="text-sm text-red-600/80 dark:text-red-400/80">
                    Un ou plusieurs blocages empêchent la prise en charge. Consultez les alertes ci-dessous.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Alerte des dossiers */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Alertes et Avertissements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AlertesPanel alertes={result.alertes} />
            </CardContent>
          </Card>

          {/* Infos Assuré + Société */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Fiche Assuré */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Informations de l&apos;Assuré
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Statut</span>
                    <Badge className={result.assure.actif
                      ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800'
                      : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800'
                    }>
                      {result.assure.actif ? 'Actif' : 'Inactif'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Nom complet</span>
                    <span className="text-sm font-medium">{result.assure.prenom} {result.assure.nom}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">N° Sécurité Sociale</span>
                    <span className="text-sm font-mono">{result.assure.nSS || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Date de naissance</span>
                    <span className="text-sm">{result.assure.dateNaissance ? formatDate(result.assure.dateNaissance) : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Sexe</span>
                    <span className="text-sm">{result.assure.sexe || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Téléphone</span>
                    <span className="text-sm">{result.assure.telephone || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Email</span>
                    <span className="text-sm">{result.assure.email || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Adresse</span>
                    <span className="text-sm text-right max-w-[200px] truncate">{result.assure.adresse || '—'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Fiche Société + Contrat */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Société Cliente &amp; Contrat
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Société</span>
                    <span className="text-sm font-medium">{result.societe.nom}</span>
                  </div>
                  {result.contrat ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Référence contrat</span>
                        <span className="text-sm font-mono">{result.contrat.reference}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Statut contrat</span>
                        <Badge variant="outline" className={
                          result.contrat.statut === 'ACTIF'
                            ? 'border-emerald-300 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400'
                            : 'border-red-300 dark:border-red-800 text-red-600 dark:text-red-400'
                        }>
                          {result.contrat.statut}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Période</span>
                        <span className="text-sm">
                          {formatDate(result.contrat.dateDebut)} → {formatDate(result.contrat.dateFin)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Budget annuel</span>
                        <span className="text-sm font-semibold">{formatMontant(result.contrat.budgetAnnuel)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Budget utilisé</span>
                        <span className="text-sm">{formatMontant(result.contrat.budgetUtilise)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                      <span className="text-xs text-amber-600 dark:text-amber-400">Aucun contrat actif trouvé</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Plafonds */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Plafond Annuel Global */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Plafond Annuel Global
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <SeuilBar
                  taux={result.plafondGlobal.tauxConsommation}
                  seuil={result.plafondGlobal.seuil}
                  label="Taux de consommation"
                />
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="text-center p-2 rounded-lg bg-muted/50">
                    <p className="text-[10px] text-muted-foreground">Budget annuel</p>
                    <p className="text-sm font-semibold">{formatMontant(result.plafondGlobal.budgetAnnuel)}</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/50">
                    <p className="text-[10px] text-muted-foreground">Consommé</p>
                    <p className="text-sm font-semibold">{formatMontant(result.plafondGlobal.consommation)}</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/50">
                    <p className="text-[10px] text-muted-foreground">Reliquat</p>
                    <p className={`text-sm font-bold ${result.plafondGlobal.reliquat > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {formatMontant(result.plafondGlobal.reliquat)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Plafond par Acte */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Plafond Spécifique par Acte
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.plafondActe ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Type de prestation</span>
                      <Badge variant="outline">{result.plafondActe.prestation}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Taux de couverture</span>
                      <span className="text-sm font-semibold">{result.plafondActe.tauxCouverture}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Plafond de l&apos;acte</span>
                      <span className="text-sm font-bold">{formatMontant(result.plafondActe.plafond)}</span>
                    </div>
                    {result.plafondActe.description && (
                      <div className="text-xs text-muted-foreground italic">{result.plafondActe.description}</div>
                    )}
                    <SeuilBar
                      taux={result.plafondActe.plafond > 0 ? (result.plafondActe.consommation / result.plafondActe.plafond) * 100 : 0}
                      seuil={result.plafondActe.seuil}
                      label="Consommation acte"
                    />
                    <div className="grid grid-cols-3 gap-3 pt-1">
                      <div className="text-center p-2 rounded-lg bg-muted/50">
                        <p className="text-[10px] text-muted-foreground">Déjà consommé</p>
                        <p className="text-sm font-semibold">{formatMontant(result.plafondActe.consommation)}</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-muted/50">
                        <p className="text-[10px] text-muted-foreground">Reliquat acte</p>
                        <p className={`text-sm font-bold ${result.plafondActe.reliquat > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {formatMontant(result.plafondActe.reliquat)}
                        </p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-muted/50">
                        <p className="text-[10px] text-muted-foreground">Plafond</p>
                        <p className="text-sm font-semibold">{formatMontant(result.plafondActe.plafond)}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <Info className="h-8 w-8 text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {typePrestation
                        ? `Aucun barème trouvé pour "${typePrestation}"`
                        : "Saisissez un type de prestation pour voir le plafond spécifique."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Simulation Montant Demandé */}
          {result.montantCouverture && (
            <Card className={result.montantCouverture.depasseReliquat ? 'border-red-200 dark:border-red-900' : 'border-emerald-200 dark:border-emerald-900'}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <DollarSign className={`h-4 w-4 ${result.montantCouverture.depasseReliquat ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`} />
                  Simulation de Couverture
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-[10px] text-muted-foreground">Montant demandé</p>
                    <p className="text-lg font-bold">{formatMontant(result.montantCouverture.montantBrut)}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                    <p className="text-[10px] text-muted-foreground">Montant couvert ({result.montantCouverture.tauxCouverture}%)</p>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatMontant(result.montantCouverture.montantCouvert)}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                    <p className="text-[10px] text-muted-foreground">Part de l&apos;assuré</p>
                    <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{formatMontant(result.montantCouverture.partAssure)}</p>
                  </div>
                  <div className={`text-center p-3 rounded-lg ${result.montantCouverture.depasseReliquat ? 'bg-red-50 dark:bg-red-950/30' : 'bg-emerald-50 dark:bg-emerald-950/30'}`}>
                    <p className="text-[10px] text-muted-foreground">Dépasse reliquat</p>
                    {result.montantCouverture.depasseReliquat ? (
                      <>
                        <p className="text-lg font-bold text-red-600 dark:text-red-400">OUI</p>
                        <p className="text-[10px] text-red-500">Écart : {formatMontant(result.montantCouverture.ecartReliquat)}</p>
                      </>
                    ) : (
                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">NON</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actes identiques passés */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <History className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Actes {typePrestation ? `« ${typePrestation} »` : ''} Passés ({result.actesPasses.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result.actesPasses.length > 0 ? (
                <div className="overflow-x-auto">
                  <div className="min-w-[700px]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">N° Dossier</th>
                          <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Type</th>
                          <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Date soins</th>
                          <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">Réclamé</th>
                          <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">Validé</th>
                          <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Prestataire</th>
                          <th className="text-center py-2 px-2 text-xs font-medium text-muted-foreground">Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.actesPasses.map((acte) => (
                          <tr key={acte.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                            <td className="py-2 px-2 font-mono text-xs">{acte.numeroDossier}</td>
                            <td className="py-2 px-2">{acte.typeDossier}</td>
                            <td className="py-2 px-2">{acte.dateSoins ? formatDate(acte.dateSoins) : '—'}</td>
                            <td className="py-2 px-2 text-right">{formatMontant(acte.montantReclame)}</td>
                            <td className="py-2 px-2 text-right">{acte.montantValide ? formatMontant(acte.montantValide) : '—'}</td>
                            <td className="py-2 px-2">{acte.prestataire || '—'}</td>
                            <td className="py-2 px-2 text-center">
                              <Badge variant="outline" className="text-[10px]">
                                {acte.statut}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <History className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">Aucun acte passé trouvé pour cet assuré.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* État initial (aucune recherche) */}
      {!result && !loading && !error && !searched && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Shield className="h-16 w-16 text-muted-foreground/20 mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground mb-1">Vérification de Couverture</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Saisissez l&apos;identifiant d&apos;un assuré (numéro de sécurité sociale) pour vérifier sa couverture santé, ses plafonds, et calculer le reliquat disponible.
            </p>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left max-w-lg w-full">
              {[
                { icon: User, label: 'Vérifier l\'assuré', desc: 'Statut actif, société rattachée' },
                { icon: Activity, label: 'Plafonds', desc: 'Global 70%/100% et par acte' },
                { icon: DollarSign, label: 'Reliquat', desc: 'Calcul automatique du reste' },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                  <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium">{label}</p>
                    <p className="text-[10px] text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}