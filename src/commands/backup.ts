import path from "path";
import os from "os";
import fs from "fs";
import { BackupOptions, FileOperationResult } from "../types/index.js";
import { stageAll, gitCommit, gitPush, getRepoStatus } from "../utils/git.js";
import { readConfig } from "../utils/config.js";
import { backupDotfiles } from "../utils/files.js";
import * as logger from "../utils/logger.js";

/**
 * Executes the `backup` command.
 *
 * Workflow:
 *  1. Read `dot.yaml` from the local dotfiles repository.
 *  2. Copy each system dotfile back into the repo at its declared source path.
 *  3. Print a per-file result summary.
 *  4. Commit all changes (and optionally push) with the given message.
 *
 * @param options - Parsed CLI options for this command.
 */
export async function backupCommand(options: BackupOptions): Promise<void> {
  const repoDir = path.resolve(expandHome(options.dir));

  // ── Guard: ensure the target directory is a git repository ───────────────
  if (!fs.existsSync(path.join(repoDir, ".git"))) {
    logger.error(
      `${repoDir} is not a git repository.\n` +
        `  Make sure you are pointing to the correct directory.\n` +
        `  Example: dot backup ~/joaorbrandao/dotfiles --no-push`
    );
    process.exit(1);
  }

  // ── 1. Read config ───────────────────────────────────────────────────────
  let config;
  try {
    config = readConfig(repoDir);
  } catch (err) {
    logger.error("Could not read dot.yaml", err);
    process.exit(1);
  }

  // ── 2. Copy system files → repo ──────────────────────────────────────────
  logger.section("Backing up dotfiles");
  const results: FileOperationResult[] = backupDotfiles(
    config.dotfiles,
    repoDir
  );

  // ── 3. Report per-file results ───────────────────────────────────────────
  printResults(results);

  const failed = results.filter((r) => !r.success);
  if (failed.length > 0) {
    logger.warn("Some files could not be backed up — committing the rest.");
  }

  // ── 4. Commit & optionally push ──────────────────────────────────────────
  logger.section("Committing changes");

  // ── 4a. Stage ────────────────────────────────────────────────────────────
  const stageSpin = logger.spinner("Staging files…");
  let hasChanges: boolean;
  try {
    hasChanges = await stageAll(repoDir);
  } catch (err) {
    stageSpin.fail("Failed to stage files");
    logger.error("git add failed", err);
    process.exit(1);
  }

  if (!hasChanges) {
    stageSpin.succeed("Nothing to commit — repository is already up to date");
    return;
  }

  const { staged, modified, untracked } = await getRepoStatus(repoDir);
  const totalChanges = staged.length + modified.length + untracked.length;
  stageSpin.succeed(`${totalChanges} file(s) staged`);

  // ── 4b. Commit ───────────────────────────────────────────────────────────
  const commitSpin = logger.spinner(`Committing: "${options.message}"…`);
  try {
    await gitCommit(repoDir, options.message);
    commitSpin.succeed(`Committed: "${options.message}"`);
  } catch (err) {
    commitSpin.fail("Commit failed");
    logger.error("git commit failed", err);
    process.exit(1);
  }

  // ── 4c. Push (optional) ──────────────────────────────────────────────────
  // Commander sets options.push = false when --no-push is passed.
  if (options.push) {
    const pushSpin = logger.spinner("Pushing to remote…");
    try {
      await gitPush(repoDir);
      pushSpin.succeed("Pushed to remote");
    } catch (err) {
      pushSpin.fail("Push failed");
      logger.error("git push failed", err);
      process.exit(1);
    }
  } else {
    logger.info("Skipping push (--no-push)");
  }
}

/**
 * Expands a leading `~` in a path to the user's home directory.
 * Duplicated here to avoid a circular import with `utils/files.ts`.
 *
 * @param p - The raw path string.
 * @returns The resolved absolute path.
 */
function expandHome(p: string): string {
  return p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p;
}

/**
 * Logs a human-readable summary of file backup operation results.
 *
 * @param results - Array of operation outcomes from `backupDotfiles`.
 */
function printResults(results: FileOperationResult[]): void {
  const passed = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  passed.forEach((r) => logger.success(`${r.target} → ${r.source}`));
  failed.forEach((r) =>
    logger.error(`${r.target} failed: ${r.error}`)
  );

  logger.section("Summary");
  logger.info(`${passed.length} backed up, ${failed.length} failed`);
}
