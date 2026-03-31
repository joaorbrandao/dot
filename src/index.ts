#!/usr/bin/env node

/**
 * dot — Dotfiles Manager CLI
 *
 * Entry point.  Registers all sub-commands via `commander` and delegates
 * execution to the appropriate command handler.
 */

import { Command } from "commander";
import os from "os";
import path from "path";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { installCommand } from "./commands/install.js";
import { backupCommand } from "./commands/backup.js";
import { InstallOptions, BackupOptions } from "./types/index.js";

/** Read version from package.json at build‑time location. */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, "..", "package.json"), "utf-8")
);

/** Default local directory where dotfiles repositories are cloned. */
const DEFAULT_DOTFILES_DIR = path.join(os.homedir(), ".dotfiles");

const program = new Command();

program
  .name("dot")
  .description("A CLI tool to install and backup dotfiles from a Git repository")
  .version(pkg.version);

// ── install ──────────────────────────────────────────────────────────────────

program
  .command("install [repo-url]")
  .description(
    "Clone (or update) a dotfiles repository and install its contents onto the system.\n" +
      "Pass a remote URL as the first argument, or use --local to point to an existing\n" +
      "local repository and skip the clone/pull step entirely.\n" +
      "Packages declared in dot.yaml are installed via the appropriate package manager,\n" +
      "and each dotfile is symlinked (or copied) to its target location.\n" +
      "The repository path is saved to ~/.dot/config.yaml for use by other commands."
  )
  .option(
    "-d, --dir <path>",
    "Local directory to clone the repository into",
    DEFAULT_DOTFILES_DIR
  )
  .option(
    "-l, --local <path>",
    "Use an existing local repository at this path (skips clone/pull)"
  )
  .option(
    "-c, --copy",
    "Copy files instead of creating symlinks",
    false
  )
  .option(
    "--skip-packages",
    "Skip package manager installation steps",
    false
  )
  .action(async (repoUrl: string | undefined, opts: InstallOptions) => {
    if (!repoUrl && !opts.local) {
      console.error(
        "error: must provide either a <repo-url> argument or the --local <path> option"
      );
      process.exit(1);
    }
    await installCommand(repoUrl, opts);
  });

// ── backup ───────────────────────────────────────────────────────────────────

program
  .command("backup")
  .description(
    "Copy system dotfiles back into the local repository, then commit and push the changes.\n" +
      "The repository path is read from ~/.dot/config.yaml (written by `dot install`).\n" +
      "The repository must contain a dot.yaml describing which files to back up."
  )
  .option(
    "-m, --message <msg>",
    "Git commit message",
    `backup: ${new Date().toISOString().split("T")[0]}`
  )
  .option(
    "--no-push",
    "Commit changes locally without pushing to the remote",
    false
  )
  .action(async (opts: BackupOptions) => {
    await backupCommand(opts);
  });

// ── parse ─────────────────────────────────────────────────────────────────────

program.parse(process.argv);
