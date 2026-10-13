# Budget.Go.Family — passation (état au 30/09/2026, version 3.0)

Application de budget familial **Budget.Go.Family by NORD DIGITAL** (propriétaire : Sam-san, Madagascar, admin `gosamsan1122@gmail.com`). Vendue par **Go Codes**.

## Stack
- Vite + React 19 + TypeScript + Tailwind v3 (thèmes par variables CSS : menthe par défaut, soleil, lagon, tropique, océan). Police Poppins embarquée.
- Supabase (projet `lzvycmzrmxctklurdlsu`) : Postgres + RLS, RPC SECURITY DEFINER, Storage `attachments` (200 Mo/compte, photos ~150 Ko), Auth email/mot de passe.
- Capacitor 8 Android (appId `mg.budgetfamille.app`) : empreinte, notifications locales, fichiers, partage. PWA pour le web (`base: './'`).
- GitHub Actions : `apk.yml` (APK debug → release `apk-latest`, fichier `BudgetFamille.apk`) et `pages.yml` (dist → branche gh-pages).
- Dépôt : anciennement `satanatenaizy-lab/budget-famille`, **déplacé** (probablement `nord-digital-go/budget-famille`). Web attendu : https://nord-digital-go.github.io/budget-famille/

## Règles NORD DIGITAL (tous les projets)
- « By NORD DIGITAL » obligatoire (accueil et sous le bouton de déconnexion).
- Blocage des anciennes versions avec le message exact : « Vous utilisez l'ancienne version de Budget.Go.Family, merci de contacter Nord Digital svp. »

## Versions et mises à jour
- `src/lib/version.ts` : `APP_VERSION = 30`, `APP_LABEL = '3.0'`. **Augmenter à chaque publication.**
- Table `app_config` (lecture publique) : `min_version` (=30), `latest_version` (=30), `apk_url`, `web_url`.
  - APK avec version < `latest_version` → bandeau « Nouvelle version disponible ».
  - version < `min_version` → écran bloquant avec le message NORD DIGITAL.
- **À FAIRE** : les versions ≤ 2.2 ne lisent pas `app_config`. Une fois l'APK 3.0 confirmée installée, les bloquer côté serveur :
  - modifier `my_access()` pour renvoyer `(false, null)` ;
  - modifier `redeem_go_code(text)` pour lever l'exception avec le message NORD DIGITAL.
  - La 3.0 utilise `my_access_v3` et `redeem_go_code_v3`.
- Mettre `apk_url` / `web_url` de `app_config` sur le nouveau propriétaire du dépôt.

## Fonctionnalités en place
- Carnets partagés par code : changement de carnet, suppression (`delete_carnet`, créateur, pas le seul carnet), sortie (`leave_carnet`). Couleur différente par carnet.
- Opérations : catégories à sous-niveaux (natives verrouillées, « Perso » modifiables, icônes), kg/kapoaka, enfants/école, « Pour qui », référence MVola/Orange.
- Accueil : filtres (type, jour, catégorie, compte, membre) et résumé du jour ou de la sélection. Le nom mène à « Mon profil ». Icône ✉ avec pastille.
- Budget, Épargne (banque/MVola/Orange, mensuel + rappel, photos), Dettes (historique, photos), Graphiques (global, catégories, évolution).
- Faire les courses : date de la liste (`shopping_lists.planned_on`), statuts brouillon → prête → terminée/annulée ; la finalisation crée une dépense par article dans sa catégorie, à la date choisie.
- Catégories v6 : Véhicule, Maison, Électronique (Téléphone/Ordinateur › Achat/Réparation). Informatique retirée de Loisirs.
- Boîte de réception pour tous : tables `admin_messages` (to_user null = tous) et `admin_message_reads`. Lecture seule pour les utilisateurs, l'admin envoie (Boîte de réception ou fiche utilisateur). Pastilles de non lus.
- Remarques des utilisateurs → table `feedback` (vue admin avec statuts).
- Go Codes : format `BF` + 7 caractères + initiale du prénom, usage unique, durées 30/90/180/365 jours. Section admin « Utilisateurs » (`admin_users`, `admin_create_go_code`, `admin_revoke_go_code`). Écran Go Code bloquant si l'abonnement a expiré.
- Politique de confidentialité (`src/screens/Privacy.tsx`, page dans Compte), case obligatoire à l'inscription (métadonnées `privacy_accepted_at`, `privacy_version`).
- Sécurité : verrou empreinte/visage, déconnexion automatique 8 h / 18 h, effacement des données par le créateur, export JSON/CSV.

## Carnet de travail (v3.7.0)
- Section « Carnet de travail » (Compte, Voir tout › Suivre, barre latérale), **réservée au compte gosamsan1122@gmail.com** (`src/lib/owner.ts` côté appli, RLS sur l'e-mail côté serveur) : rendez-vous, tâches, notes, chaque élément s'ouvre en fiche détaillée (modifier, supprimer, marquer terminée), au style du carnet WORK YAS (bleu encre, Bricolage Grotesque / IBM Plex Sans / JetBrains Mono, CSS limité à `.ct` dans `src/screens/travail.css`).
- Tables `work_events`, `work_tasks`, `work_notes` (RLS : chaque utilisateur ne voit que ses lignes). SQL : `supabase/carnet_travail.sql` — **à exécuter dans Supabase avant de publier la 3.7.0** (sinon l'écran affiche « pas encore activé »).
- Rappels : notifications locales de l'APK (`src/lib/travail.ts`, ids 2 000 000+, `extra.kind = 'travail'`), reprogrammées à chaque ouverture de l'écran. Journée entière : la veille à 20h ou 8h. Hebdomadaire : notification répétée le même jour de la semaine.

- Thème **Encre** (bleu encre, polices Bricolage Grotesque / IBM Plex Sans / JetBrains Mono) dans Compte › Thème de couleur, visible seulement pour le compte propriétaire (`ownerOnly` dans `src/lib/theme.ts`).

## Business Pro (v3.8.0)
- Section **Business Pro** réservée aux partenaires `gosamsan1122@gmail.com` et `raharisoamaevahchloe@gmail.com` (Chloé, nièce et partenaire de Sam-san) : `PARTNER_EMAILS` / `isPartner()` dans `src/lib/owner.ts`, table `app_partners` + fonction `is_partner()` côté serveur (fait foi pour les données).
- Contenu : fournisseurs (nom, quartier, téléphone, produits, saison par mois), clients (nom, région, téléphone, produits), transactions achat/vente (quantité, unité, prix, montant en Ar, paiement), historique par contact et bilan par produit. Bouton « Contacter » : appel, SMS, WhatsApp, copier le numéro. Données **communes aux deux partenaires**.
- Accueil : carte sombre « Business Pro » (achats/ventes du mois, fournisseurs en saison). Aussi dans Compte, « Voir tout » et la barre latérale.
- Thème sombre repris de l'artifact « Carnets fournisseurs », CSS limité à `.bp` / `.bp-glance` dans `src/screens/business.css`.
- Accès illimité des partenaires : `my_access_v3()` renvoie une fin d'accès au 31/12/2999 pour eux (même signature, marche aussi avec l'APK déjà installée). Chloé n'est pas administratrice. Carte « Partenaire · accès illimité » dans Compte.
- Tables `bp_fournisseurs`, `bp_clients`, `bp_transactions` (RLS : `is_partner()`). SQL : `supabase/business_pro.sql` — **à exécuter dans Supabase avant de publier la 3.8.0** (sinon l'écran affiche « pas encore activé »).
- v3.8.1 : en haut de Business Pro, les deux partenaires se voient (nom, téléphone, e-mail, bouton Contacter) et chaque fiche/transaction indique « par … ». Seulement dans cette section. RPC `bp_partners()` (renvoie quelque chose uniquement à un partenaire) : `supabase/business_pro_partenaires.sql`, à exécuter après `business_pro.sql`.
- v3.8.1 : Carnet de travail — plus de formulaire affiché d'office. Boutons « + Nouveau rendez-vous », « + Nouvelle tâche », « + Nouvelle note » qui ouvrent le formulaire dans une fiche (`AddSheet` dans `Travail.tsx`). Règle de Sam-san pour toutes ses apps : un bouton d'ajout d'abord, le formulaire ensuite.

## Fichiers clés
- `src/App.tsx` : ordre des écrans = chargement → version → connexion → verrou → profil → Go Code → carnet.
- `src/lib/data.tsx` : chargement des données.
- `src/lib/inbox.ts` : messages et pastilles.
- `src/lib/version.ts` : version et mises à jour.
- `src/screens/*` : écrans.
- `src/components/ui.tsx` : icônes par regex, Sheet (texte forcé en `text-ink`).

## Tests
- Captures Playwright avec Supabase simulé (Chromium dans `/opt/pw-browsers`).
- Tests SQL en se faisant passer pour un utilisateur :
  - `set_config('request.jwt.claims', '{"sub":"<uid>","role":"authenticated"}', true)`
  - puis `set local role authenticated`, dans un `begin … rollback`.

## Questions en attente de réponse de Sam-san
- Confirmer le nouveau propriétaire du dépôt et que l'APK 3.0 s'installe (en bas de Compte : « version 3.0 ») → puis « bloque les anciennes ».
- Mode hors ligne (saisie sans internet, synchronisation au retour) : proposé, pas lancé.
- Publication sur le Google Play Store : suggérée.
- Décisions Go Code non confirmées : 30 jours offerts aux comptes existants, un code par personne et non par carnet.
