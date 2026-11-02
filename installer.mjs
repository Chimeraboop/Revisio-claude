// Installe (ou retire) l'extension « Claude » dans le dossier des données de Révisio :
//   node installer.mjs              installer ou mettre à jour
//   node installer.mjs --retirer    retirer
// Le dossier des données est %APPDATA%\Revisio (Windows) ou ~/Library/Application Support/Revisio (macOS),
// ou celui de la variable REVISIO_DOSSIER_DONNEES.

import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const FICHIERS = ["extension.json", "extension.mjs", "heic-en-jpeg.ps1"];

function dossierDonnees() {
  if (process.env.REVISIO_DOSSIER_DONNEES) return process.env.REVISIO_DOSSIER_DONNEES;
  if (process.platform === "win32") return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "Revisio");
  if (process.platform === "darwin") return join(homedir(), "Library", "Application Support", "Revisio");
  throw new Error("Révisio fonctionne sous Windows et macOS seulement.");
}

const cible = join(dossierDonnees(), "extensions", "claude");

if (process.argv.includes("--retirer")) {
  rmSync(cible, { recursive: true, force: true });
  console.log(`Extension retirée (${cible}).`);
  console.log("Dans Révisio, Photos de cours : les notes seront de nouveau rédigées par Gemini.");
} else {
  mkdirSync(cible, { recursive: true });
  for (const f of FICHIERS) copyFileSync(join(ICI, f), join(cible, f));
  // config.json (modèle choisi…) : copié seulement s'il n'existe pas déjà là-bas.
  if (existsSync(join(ICI, "config.json")) && !existsSync(join(cible, "config.json"))) {
    copyFileSync(join(ICI, "config.json"), join(cible, "config.json"));
  }
  console.log(`Extension installée dans ${cible}.`);
  console.log("Dans Révisio, ouvre Photos de cours et choisis « Rédigées par : Claude ».");
}
