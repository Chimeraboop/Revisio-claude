// Extension « Claude » pour Révisio : Révisio envoie une demande JSON sur l'entrée standard,
// l'extension la confie à Claude Code (`claude -p`, connecté avec l'abonnement Claude de l'élève)
// et renvoie la réponse JSON sur la sortie standard. Révisio vérifie la réponse, écrit les notes
// et garde l'historique : l'extension ne touche jamais au dossier de notes.
//
// Demande : { version, tache, systeme, consigne, images: [chemins], schema }
// Réponse : { ok: true, reponse, modele } ou { ok: false, erreur }

import { execFile, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const VERSION_PROTOCOLE = 1;
const MODELE_PAR_DEFAUT = "sonnet";

function repondre(objet) {
  process.stdout.write(JSON.stringify(objet) + "\n");
}

function echouer(erreur) {
  repondre({ ok: false, erreur });
  process.exitCode = 1;
}

/** Réglages facultatifs de l'extension (config.json à côté de ce fichier). */
function lireConfig() {
  try {
    return JSON.parse(readFileSync(join(ICI, "config.json"), "utf8").replace(/^﻿/, ""));
  } catch {
    return {};
  }
}

/** Programme Claude Code : réglage, installation native, installation npm, sinon le PATH. */
function trouverClaude(config) {
  const windows = process.platform === "win32";
  const candidats = [
    config.claude,
    process.env.REVISIO_CLAUDE,
    join(homedir(), ".local", "bin", windows ? "claude.exe" : "claude"),
    windows && process.env.APPDATA ? join(process.env.APPDATA, "npm", "claude.cmd") : null,
    windows ? null : "/opt/homebrew/bin/claude",
    windows ? null : "/usr/local/bin/claude",
  ].filter(Boolean);
  return candidats.find((c) => existsSync(c)) ?? "claude";
}

/** Message en français pour les échecs connus de Claude Code. */
function expliquer(texte) {
  const t = (texte || "").toLowerCase();
  if (t.includes("not logged in") || t.includes("/login") || t.includes("invalid api key") || t.includes("authentication")) {
    return "Claude Code n'est pas connecté : ouvre un terminal, lance « claude », puis connecte-toi avec ton compte Claude (/login).";
  }
  if (t.includes("usage limit") || t.includes("rate limit") || t.includes("limit reached")) {
    return "Limite d'utilisation de ton abonnement Claude atteinte : réessaie plus tard (bouton « Réessayer » dans Photos de cours).";
  }
  if (t.includes("overloaded")) return "Claude est surchargé en ce moment : réessaie dans quelques minutes.";
  return `Claude Code a échoué : ${(texte || "erreur inconnue").slice(0, 400)}`;
}

function consigneComplete(demande) {
  const photos = demande.images.map((c) => `- ${basename(c)}`).join("\n");
  return [
    `Les ${demande.images.length} photo(s) du cours sont dans ces fichiers du dossier courant. Lis-les toutes avec l'outil Read avant de répondre, dans cet ordre :`,
    photos,
    "N'utilise aucun autre outil et ne cherche aucun autre fichier : tout ce qu'il te faut est dans les photos et dans le texte ci-dessous.",
    "",
    demande.consigne,
  ].join("\n");
}

/** Commande simple (sans shell) qui doit réussir. */
function executer(programme, args) {
  return new Promise((resolve, reject) => {
    execFile(programme, args, { windowsHide: true, timeout: 60_000 }, (erreur, _sortie, erreurs) =>
      erreur ? reject(new Error((erreurs || erreur.message).trim().slice(0, 300))) : resolve(),
    );
  });
}

/**
 * Claude ne lit pas le HEIC (photos d'iPhone) : conversion en JPEG à côté de la photo, avec le décodeur
 * d'images du système (Windows : script PowerShell ; macOS : sips). Les autres photos sont gardées telles quelles.
 */
async function enJpeg(chemin) {
  if (!/\.(heic|heif)$/i.test(chemin)) return chemin;
  const cible = chemin.replace(/\.(heic|heif)$/i, ".jpg");
  if (process.platform === "win32") {
    await executer("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(ICI, "heic-en-jpeg.ps1"), chemin, cible]);
  } else {
    await executer("sips", ["-s", "format", "jpeg", "-Z", "2000", chemin, "--out", cible]);
  }
  return cible;
}

function lancer(claude, args, entree, dossier) {
  return new Promise((resolve, reject) => {
    // Un .cmd (installation npm sous Windows) ne se lance que par l'interpréteur de commandes.
    const parShell = claude.toLowerCase().endsWith(".cmd");
    const enfant = spawn(parShell ? `"${claude}"` : claude, args.map((a) => (parShell ? `"${a.replace(/"/g, '\\"')}"` : a)), {
      cwd: dossier,
      shell: parShell,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let sortie = "";
    let erreurs = "";
    enfant.stdout.on("data", (d) => (sortie += d));
    enfant.stderr.on("data", (d) => (erreurs += d));
    enfant.on("error", (e) => reject(e));
    enfant.on("close", (code) => resolve({ code, sortie, erreurs }));
    enfant.stdin.end(entree);
  });
}

async function main() {
  let texte = "";
  for await (const morceau of process.stdin) texte += morceau;
  let demande;
  try {
    demande = JSON.parse(texte);
  } catch {
    return echouer("Demande illisible.");
  }
  if (demande.version !== VERSION_PROTOCOLE) {
    return echouer(`Version de Révisio non prise en charge (protocole ${demande.version}) : mets l'extension à jour.`);
  }
  if (demande.tache !== "photos") return echouer(`Tâche inconnue : ${demande.tache}`);
  if (!Array.isArray(demande.images) || demande.images.length === 0) return echouer("Aucune photo reçue.");
  try {
    demande.images = await Promise.all(demande.images.map(enJpeg));
  } catch (e) {
    return echouer(
      `Photo HEIC impossible à convertir (${e?.message ?? e}). Règle l'appareil photo sur « Le plus compatible » (JPEG), ou repasse sur Gemini.`,
    );
  }

  const config = lireConfig();
  const args = [
    "-p",
    "--output-format", "json",
    "--tools", "Read",
    "--allowedTools", "Read",
    "--permission-mode", "dontAsk",
    "--no-session-persistence",
    // Ni réglages, ni extensions (hooks, plugins, serveurs MCP) de l'utilisateur : un appel propre.
    "--setting-sources", "project",
    "--strict-mcp-config",
    "--disable-slash-commands",
    "--max-turns", String(demande.images.length + 8),
  ];
  if (demande.systeme) args.push("--system-prompt", demande.systeme);
  if (demande.schema) args.push("--json-schema", JSON.stringify(demande.schema));
  // Sans réglage, Claude Code prend son plus petit modèle en mode automatique : Sonnet lit mieux l'écriture manuscrite.
  args.push("--model", String(config.modele || MODELE_PAR_DEFAUT));

  const claude = trouverClaude(config);
  let resultat;
  try {
    resultat = await lancer(claude, args, consigneComplete(demande), dirname(demande.images[0]));
  } catch (e) {
    return echouer(
      e && e.code === "ENOENT"
        ? "Claude Code est introuvable : installe-le (https://code.claude.com), puis connecte-toi avec ton compte Claude."
        : `Impossible de lancer Claude Code : ${e?.message ?? e}`,
    );
  }
  let json;
  try {
    json = JSON.parse(resultat.sortie.trim().split("\n").filter(Boolean).pop() ?? "");
  } catch {
    return echouer(expliquer(resultat.erreurs || resultat.sortie));
  }
  if (json.is_error || json.structured_output === undefined) {
    return echouer(expliquer(json.result || resultat.erreurs || json.subtype));
  }
  // Claude Code utilise aussi un petit modèle pour ses tâches annexes : le rédacteur est celui qui a le plus écrit.
  const [modele] = Object.entries(json.modelUsage ?? {}).sort((a, b) => (b[1]?.outputTokens ?? 0) - (a[1]?.outputTokens ?? 0))[0] ?? [];
  repondre({ ok: true, reponse: json.structured_output, modele: modele ?? config.modele ?? MODELE_PAR_DEFAUT });
}

main().catch((e) => echouer(`Erreur de l'extension : ${e?.message ?? e}`));
