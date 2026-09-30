import type { ReactNode } from 'react'

export const PRIVACY_VERSION = '2026-09-30'
const CONTACT = 'gosamsan1122@gmail.com'

function S({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="font-semibold text-ink">{n}. {title}</h3>
      <div className="space-y-2 text-sm leading-relaxed text-ink-soft">{children}</div>
    </section>
  )
}

/** Politique de confidentialité de Budget.Go.Family (texte standard, en français). */
export function PrivacyText() {
  return (
    <div className="space-y-5 text-ink">
      <p className="text-sm text-ink-muted">Dernière mise à jour : 30 septembre 2026</p>
      <p className="text-sm leading-relaxed text-ink-soft">
        Budget.Go.Family est une application de gestion du budget familial éditée par <b>NORD DIGITAL</b> (Madagascar).
        Cette politique explique quelles données nous collectons, pourquoi, comment elles sont protégées et quels sont tes droits.
        En créant un compte, tu acceptes cette politique.
      </p>
      <S n={1} title="Données collectées">
        <p><b>Compte :</b> nom complet, adresse email, numéro de téléphone, mot de passe (enregistré chiffré, nous ne le voyons jamais).</p>
        <p><b>Profil (facultatif) :</b> date de naissance, sexe, région, ville, profession, situation familiale, prénom, âge et scolarité des enfants.</p>
        <p><b>Données du budget :</b> opérations (montants, catégories, dates, notes, références Mobile Money), comptes, membres, budgets, épargnes, dettes, listes de courses.</p>
        <p><b>Photos :</b> les pièces jointes que tu ajoutes aux épargnes et aux dettes (réduites automatiquement, 200 Mo maximum par compte).</p>
        <p><b>Abonnement :</b> Go Codes utilisés et date de fin d'accès. <b>Messages :</b> remarques que tu envoies à l'équipe.</p>
        <p>Nous ne collectons <b>pas</b> ta position, tes contacts, ni tes codes Mobile Money ou bancaires. L'empreinte ou le visage restent sur ton téléphone : l'application reçoit seulement « reconnu / non reconnu ».</p>
      </S>
      <S n={2} title="Pourquoi nous les utilisons">
        <p>Uniquement pour faire fonctionner l'application : afficher ton budget, partager un carnet avec ta famille, gérer ton abonnement, répondre à tes remarques et t'envoyer des informations sur le service.</p>
        <p>Les réponses du profil nous aident aussi à améliorer l'application, sous forme de statistiques globales et anonymes.</p>
        <p><b>Nous ne vendons pas tes données</b> et ne faisons pas de publicité ciblée.</p>
      </S>
      <S n={3} title="Qui peut voir tes données">
        <p><b>Toi</b>, et les personnes à qui tu as donné le code de ton carnet (elles voient le contenu de ce carnet partagé).</p>
        <p><b>L'administrateur NORD DIGITAL</b> voit seulement ce qui est nécessaire au service : nom, email, téléphone, dates d'inscription et de connexion, abonnement et remarques envoyées.</p>
        <p><b>Hébergeur :</b> les données sont stockées chez Supabase (serveurs sécurisés, connexion chiffrée HTTPS). Aucune autre entreprise n'y a accès, sauf obligation légale.</p>
      </S>
      <S n={4} title="Sécurité">
        <p>Connexion chiffrée, accès aux données limité par des règles de sécurité (chaque compte ne voit que ses carnets), photos privées accessibles par lien temporaire, déconnexion automatique à 8 h et 18 h, connexion par empreinte ou visage possible.</p>
        <p>Garde ton mot de passe et le code de ton carnet pour toi : toute personne qui a ce code peut rejoindre le carnet.</p>
      </S>
      <S n={5} title="Durée de conservation">
        <p>Tes données sont conservées tant que ton compte existe. Si tu supprimes un carnet ou efface des données, elles sont supprimées définitivement. Un compte inactif ou sans abonnement depuis plus de 24 mois peut être supprimé après un message de prévenance.</p>
      </S>
      <S n={6} title="Tes droits">
        <p>Tu peux à tout moment : <b>consulter et corriger</b> ton profil, <b>exporter</b> tes données (Mon profil › Extraction, fichiers JSON / Excel), <b>effacer</b> les données d'un carnet ou supprimer un carnet, et demander la <b>suppression complète de ton compte</b> en écrivant à {CONTACT}.</p>
        <p>Ces droits sont prévus par la loi malgache n° 2014-038 sur la protection des données à caractère personnel.</p>
      </S>
      <S n={7} title="Enfants">
        <p>Le compte est destiné aux adultes. Les informations sur les enfants (prénom, âge, scolarité) sont saisies par le parent, sont facultatives et ne servent qu'à classer les dépenses de la famille.</p>
      </S>
      <S n={8} title="Modifications et contact">
        <p>Nous pouvons mettre à jour cette politique ; tu en seras informé dans la Boîte de réception de l'application.</p>
        <p>Questions : <b>{CONTACT}</b> ou le bouton « Remarque / suggestion ». — NORD DIGITAL, Madagascar.</p>
      </S>
    </div>
  )
}

export function PrivacyPage() {
  return <div className="px-5 pb-10 pt-2"><PrivacyText /></div>
}
