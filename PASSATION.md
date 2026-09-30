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
