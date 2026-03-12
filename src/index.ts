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
import { installCommand } from "./commands/install.js";
import { backupCommand } from "./commands/backup.js";
import { setupCommand } from "./commands/setup.js";
import { InstallOptions, BackupOptions, SetupOptions } from "./types/index.js";

/** Default local directory where dotfiles repositories are stored. */
const DEFAULT_DOTFILES_DIR = path.join(os.homedir(), ".dotfiles");

const program = new Command();

program
  .name("dot")
  .description("A CLI tool to install and backup dotfiles from a Git repository")
  .version("1.0.0");

// ── install ──────────────────────────────────────────────────────────────────

program
  .command("install <repo-url>")
  .description(
    "Clone (or update) a dotfiles repository and install its contents onto the system.\n" +
      "Packages declared in dot.yaml are installed via the appropriate package manager,\n" +
      "and each dotfile is symlinked (or copied) to its target location."
  )
  .option(
    "-d, --dir <path>",
    "Local directory to clone the repository into",
    DEFAULT_DOTFILES_DIR
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
  .action(async (repoUrl: string, opts: InstallOptions) => {
    await installCommand(repoUrl, opts);
  });

// ── backup ───────────────────────────────────────────────────────────────────

program
  .command("backup [repo-dir]")
  .description(
    "Copy system dotfiles back into the local repository, then commit and push the changes.\n" +
      "The repository must already exist locally and contain a dot.yaml.\n" +
      "Pass the repo path as a positional argument or with --dir."
  )
  .option(
    "-d, --dir <path>",
    "Path to the local dotfiles repository",
    DEFAULT_DOTFILES_DIR
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
  .action(async (repoDir: string | undefined, opts: BackupOptions) => {
    // A positional path overrides the --dir default so users can write:
    //   dot backup ~/my/dotfiles
    // as well as the explicit form:
    //   dot backup --dir ~/my/dotfiles
    if (repoDir) {
      opts.dir = repoDir;
    }
    await backupCommand(opts);
  });

// ── setup ────────────────────────────────────────────────────────────────────

program
  .command("setup")
  .description(
      "Initialise a dotfiles directory by creating an example dot.yaml.\n" +
      "The generated file includes an entry for dot.yaml itself so the\n" +
      "configuration is tracked alongside your other dotfiles."
  )
  .option(
    "-d, --dir <path>",
    "Directory where dot.yaml will be created",
    DEFAULT_DOTFILES_DIR
  )
  .option(
    "-f, --force",
    "Overwrite an existing dot.yaml",
    false
  )
  .action(async (opts: SetupOptions) => {
    await setupCommand(opts);
  });

// ── parse ─────────────────────────────────────────────────────────────────────

program.parse(process.argv);
