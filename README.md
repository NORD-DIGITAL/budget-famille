# Budget Famille

Application de gestion de budget familial : carnet des dépenses/revenus, catégories, graphiques,
comptes (Espèces, MVola, Orange Money, Banque), membres, budgets mensuels et objectifs d'épargne.
Données dans Supabase (projet **BUDGET FAMILLE**), partagées entre les membres de la famille grâce à un code d'invitation.

## 1. Réglage Supabase à faire une fois (2 minutes)

Dans le tableau de bord Supabase → projet **BUDGET FAMILLE** → **Authentication** :

- **Sign In / Providers → Email** : désactive **Confirm email** (le plus simple pour un usage familial),
  sinon chaque nouveau compte doit cliquer sur un lien reçu par email avant de se connecter.

## 2. Obtenir l'APK Android (sans rien installer sur ton PC)

1. Crée un dépôt GitHub vide (ex : `budget-famille`), privé si tu veux.
2. Envoie tout le contenu de ce dossier dans le dépôt (bouton « uploading an existing file » sur GitHub,
   en glissant les dossiers — **sans** `node_modules`).
3. Onglet **Actions** → le workflow « Construire l'APK Android » démarre tout seul (≈ 5 min).
4. Ouvre l'exécution terminée → section **Artifacts** → télécharge `BudgetFamille-apk` (zip contenant `app-debug.apk`).
5. Envoie l'APK sur ton téléphone Android et installe-le (autoriser « sources inconnues »).

Chaque nouveau push sur `main` reconstruit un APK à jour.

## 3. Version iPhone et web (PWA)

1. Construis le site : `npm install` puis `npm run build` → dossier `dist/`
   (ou utilise le `dist/` déjà fourni).
2. Glisse le dossier `dist/` sur https://app.netlify.com/drop (gratuit) → tu obtiens une adresse web.
3. Sur iPhone : ouvre l'adresse dans **Safari** → Partager → **Sur l'écran d'accueil**. L'app s'ouvre en plein écran comme une vraie app.

## Développement

```bash
npm install
npm run dev          # aperçu dans le navigateur
npm run build        # version de production (dist/)
npx cap sync android # copie dist/ dans le projet Android
npx cap open android # ouvrir dans Android Studio (si installé)
```

Structure : `src/screens` (Carnet, Portefeuille, Graphiques, Plus, Budget, gestion), `src/components`,
`src/lib/data.tsx` (chargement des données Supabase). Base de données : tables `carnets`, `carnet_users`,
`members`, `accounts`, `categories`, `transactions`, `budgets`, `savings_goals`, protégées par RLS
(chaque famille ne voit que son carnet).
