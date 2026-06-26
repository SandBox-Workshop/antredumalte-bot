# Antre du Malt Bot

Bot Discord privé pour le serveur **V Rising** de l'Antre du Malt.

## Fonctionnalités

* `/ping` : teste si le bot répond
* `/status` : affiche le statut du serveur V Rising
* `/infos` : affiche les infos détaillées du serveur
* `/faille` : gère un timer manuel pour les failles V Rising
* Alertes de faille par MP ou ping dans un salon Discord

## Prérequis

* Node.js
* pnpm
* Un bot Discord configuré dans le Discord Developer Portal
* Un serveur V Rising avec un `QueryPort` accessible

## Installation

Installer les dépendances :

```bash
pnpm install
```

Copier le fichier de configuration d'exemple :

```bash
cp config.example.json config.json
```

Puis remplir `config.json` avec les informations du bot Discord et du serveur V Rising.

## Configuration

Le fichier `config.json` n'est pas versionné.

Exemple attendu :

```json
{
  "token": "TON_TOKEN_DISCORD",
  "clientId": "TON_APPLICATION_ID",
  "guildId": "TON_GUILD_ID",
  "vrising": {
    "host": "IP_DU_SERVEUR",
    "queryPort": 9877
  }
}
```

## Commandes utiles

Déployer les slash commands Discord :

```bash
pnpm run deploy
```

Lancer le bot :

```bash
pnpm start
```

Lancer le bot en mode développement :

```bash
pnpm run dev
```

Vérifier le code avec ESLint :

```bash
pnpm run lint
```

## Versioning

Le projet utilise un versioning automatique avec `release-it` et les commits conventionnels.

Exemples de commits :

```bash
feat: add faille timer command
fix: prevent expired Discord interactions
docs: update readme
```

Tester une release sans modifier les fichiers :

```bash
pnpm run release:dry
```

Créer une release :

```bash
pnpm run release
```

## Changelog

Les changements de version sont générés automatiquement avec `release-it`.

Voir le fichier [`CHANGELOG.md`](./CHANGELOG.md) pour l'historique complet des versions.

La version actuelle du bot est indiquée dans [`package.json`](./package.json).

## Licence

Ce projet est sous licence **ISC**.

Voir le fichier [`LICENSE`](./LICENSE).
