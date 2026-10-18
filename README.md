Antre du Malt

Bot Discord privé multi-jeux pour organiser les sessions de jeu de l'Antre du Malt.

Le bot centralise la création de sessions, les inscriptions, les rôles temporaires, les notifications de début de session et le catalogue de jeux utilisé par les commandes générales.

Fonctionnalités

Sessions de jeu

création d'une session avec jeu, date, heure et description ;

inscription en tant que participant ou « peut-être » ;

départ d'une session ;

hôte protégé contre un départ accidentel ;

transfert de l'hôte ;

modification de la date, de l'heure et de la description ;

changement du jeu ;

annulation et clôture manuelle ;

clôture automatique 6 heures après l'heure prévue ;

historique des sessions ;

persistance SQLite ;

rôles Discord temporaires par session ;

notification automatique au début de la session ;

suppression des rôles temporaires quand la session est terminée ou annulée.

Catalogue de jeux

Les jeux disponibles sont stockés dans :

data/games.json

/game add permet d'ajouter un jeu depuis Discord avec :

son nom ;

son emoji.

Le bot utilise automatiquement l'identifiant GameDig lorsqu'un jeu correspondant est connu. Sinon, un identifiant local est généré à partir du nom.

data/games.json est une donnée runtime et n'est pas versionné par Git.

V Rising

Le projet contient encore les fonctionnalités historiques dédiées à V Rising.

Ce module est conservé mais n'est plus au centre du développement actuel.

Stack

Node.js

TypeScript

discord.js

SQLite via node:sqlite

GameDig

pnpm

PM2

GitHub Actions

Prérequis

Node.js 24 recommandé ;

pnpm ;

un bot Discord configuré ;

Git pour le développement et le déploiement.

Installation

Cloner le dépôt puis installer les dépendances :

git clone <repository-url>
cd antredumalte-bot
pnpm install

Créer la configuration privée à partir du fichier d'exemple :

config/config.example.json
→
config/config.json

config/config.json contient des données privées et ne doit jamais être commit.

Le catalogue de jeux est lui aussi local à chaque installation. S'il n'existe pas encore, créer :

data/games.json

avec comme contenu initial :

[]

Les premiers jeux peuvent ensuite être ajoutés avec /game add.

Développement

Lancer le bot en mode développement :

pnpm dev

Vérifier le projet :

pnpm check

Cette commande exécute :

ESLint
+
TypeScript

Déployer les commandes slash manuellement :

pnpm run deploy

Scripts

pnpm start         Démarre le bot
pnpm dev           Démarre le bot avec rechargement automatique
pnpm lint          Lance ESLint
pnpm typecheck     Vérifie TypeScript
pnpm check         Lance lint + typecheck
pnpm run deploy    Déploie les commandes Discord
pnpm db:reset      Réinitialise la base SQLite
pnpm release       Crée une release
pnpm release:dry   Simule une release

Données locales

Les principales données runtime sont :

data/yolo.sqlite
data/games.json

Elles ne doivent pas être écrasées lors d'un déploiement.

La base SQLite utilise WAL et contient notamment les sessions et leurs membres.

Sauvegardes de production

Le VPS sauvegarde automatiquement :

data/yolo.sqlite
data/games.json

Les sauvegardes sont stockées dans :

~/antredumalte-backups/

Chaque sauvegarde contient :

yolo.sqlite
games.json
backup.json

Le snapshot SQLite est vérifié avec PRAGMA integrity_check.

Les sauvegardes de plus de 14 jours sont supprimées automatiquement.

Le script utilisé est :

scripts/backup-production.sh

et appelle :

scripts/backup-production-data.ts

Déploiement en production

La production tourne sur un VPS avec PM2.

Le déploiement est automatisé avec GitHub Actions.

Un push sur main déclenche :

GitHub Actions
    ↓
connexion SSH au VPS
    ↓
git pull
    ↓
pnpm install --frozen-lockfile
    ↓
pnpm check
    ↓
pnpm run deploy
    ↓
pm2 restart antredumalte-bot

Le workflow est défini dans :

.github/workflows/deploy.yml

Les accès SSH utilisés par GitHub Actions sont stockés dans les Repository Secrets et ne doivent jamais être commit.

Workflow Git

Organisation utilisée pour le développement :

main
└── dev
    └── feat/*
    └── fix/*
    └── refactor/*
    └── chore/*
    └── ci/*

Principes :

main représente la production ;

dev sert de branche d'intégration locale ;

une branche par sujet ;

éviter de mélanger feature, bugfix et refactor dans le même commit ;

main est poussée sur le dépôt distant ;

chaque push sur main peut déclencher un déploiement automatique.

Structure principale

commands/
├── general/
└── vrising/

config/

database/

data/

events/

features/
└── sessions/

interactions/

scripts/

services/

types/

utils/

Sécurité

Ne jamais versionner ou partager :

config/config.json
google-service-account.json
data/yolo.sqlite*
data/games.json

Les secrets GitHub Actions doivent rester exclusivement dans les paramètres du dépôt GitHub.

Licence

Projet privé destiné à l'Antre du Malt.