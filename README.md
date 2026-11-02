# Révisio + Claude

Extension pour [Révisio](https://github.com/Chimeraboop/Revisio) : les notes tirées de tes **photos de cours**
sont rédigées par **Claude** (avec ton abonnement Claude) au lieu de Gemini.

Révisio garde tout le reste : il surveille ton dossier de photos, prépare les photos (réduites, remises à l'endroit),
vérifie ce que Claude propose (dossier existant, pas de doublon, une note existante n'est jamais modifiée sans ton
accord), écrit les notes et les garde dans son historique (annulables). L'extension ne touche jamais à ton dossier de
notes : elle transmet seulement la demande de Révisio à Claude Code et lui rapporte la réponse.

## Ce qu'il faut

- Révisio 0.14.0 ou plus récent (Windows, ou macOS en version expérimentale).
- [Node.js](https://nodejs.org) 20 ou plus récent.
- [Claude Code](https://code.claude.com), connecté à un compte Claude **Pro, Max ou plus** (le forfait gratuit de
  claude.ai ne donne pas accès à Claude Code).

## Installer

1. Installe Claude Code (PowerShell sous Windows) :

   ```powershell
   irm https://claude.ai/install.ps1 | iex
   ```

   Sur Mac : `curl -fsSL https://claude.ai/install.sh | bash`.

2. Ouvre un **nouveau** terminal, lance `claude` et connecte-toi avec ton compte Claude (le navigateur s'ouvre).
   Ferme ensuite Claude Code (`/exit`).

3. Télécharge ce dépôt (bouton « Code », puis « Download ZIP ») et décompresse-le, puis, dans ce dossier :

   ```powershell
   node installer.mjs
   ```

4. Dans Révisio, ouvre **Photos de cours** et choisis **Rédigées par : Claude**.

Pour revenir à Gemini, choisis « Gemini » au même endroit. Pour retirer l'extension : `node installer.mjs --retirer`.

## Réglages facultatifs

Crée un fichier `config.json` à côté de `extension.json`, dans le dossier où l'extension est installée
(`%APPDATA%\Revisio\extensions\claude` sous Windows, `~/Library/Application Support/Revisio/extensions/claude` sur Mac) :

```json
{
  "modele": "sonnet",
  "claude": "C:\\chemin\\vers\\claude.exe"
}
```

- `modele` : modèle Claude utilisé (`sonnet`, `opus`, `haiku`… ou un nom complet). Par défaut : `sonnet`. `opus` écrit
  un peu mieux mais use plus vite les limites de l'abonnement ; `haiku` est rapide mais lit moins bien l'écriture.
- `claude` : chemin de Claude Code, seulement s'il n'est pas trouvé tout seul.

## Bon à savoir

- Chaque lot de photos compte dans les limites d'utilisation de ton abonnement Claude (deux demandes par lot : repérage
  du chapitre, puis rédaction). Si la limite est atteinte, le lot passe en erreur : « Réessayer » dans Photos de cours.
- Les photos HEIC (iPhone) sont converties en JPEG avant d'être lues par Claude, avec le décodeur d'images du système
  (Windows : extension « HEIF Image Extensions » de Microsoft, en général déjà installée ; Mac : `sips`).
- Claude Code est lancé sans tes réglages, extensions, serveurs MCP ni compétences, avec un seul outil autorisé : lire
  les photos du lot (préparées par Révisio dans son dossier de données).

## Comment ça marche (pour les curieux)

Révisio lance `node extension.mjs` (voir `extension.json`) et lui écrit une demande JSON sur l'entrée standard :

```json
{ "version": 1, "tache": "photos", "systeme": "…", "consigne": "…", "images": ["…/photo-1.jpg"], "schema": { } }
```

L'extension appelle `claude -p` avec la consigne, les photos à lire et le schéma JSON attendu (`--json-schema`), puis
répond sur une seule ligne : `{ "ok": true, "reponse": { … }, "modele": "…" }` ou `{ "ok": false, "erreur": "…" }`.
N'importe quel programme qui respecte ce format peut servir d'extension à Révisio.

## Licence

MIT
