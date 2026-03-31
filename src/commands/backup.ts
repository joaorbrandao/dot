import path from "path";
import fs from "fs";
import { BackupOptions, FileOperationResult } from "../types/index.js";
import { stageAll, gitCommit, gitPush, getRepoStatus } from "../utils/git.js";
import { readConfig, readAppConfig } from "../utils/config.js";
import { backupDotfiles } from "../utils/files.js";
import * as logger from "../utils/logger.js";

/**
 * Executes the `backup` command.
 *
 * Workflow:
 *  1. Read `~/.dot/config.yaml` to discover the local repository path.
 *  2. Read `dot.yaml` from the local dotfiles repository.
 *  3. Copy each system dotfile back into the repo at its declared source path.
 *  4. Print a per-file result summary.
 *  5. Commit all changes (and optionally push) with the given message.
 *
 * @param options - Parsed CLI options for this command.
 */
export async function backupCommand(options: BackupOptions): Promise<void> {
  // ── 1. Discover repository path from ~/.dot/config.yaml ─────────────────
  let repoDir: string;
  try {
    const appConfig = readAppConfig();
    repoDir = path.resolve(appConfig.repository.localPath);
  } catch (err) {
    logger.error("Could not determine repository location", err);
    process.exit(1);
  }

  // ── Guard: ensure the target directory is a git repository ───────────────
  if (!fs.existsSync(path.join(repoDir, ".git"))) {
    logger.error(
      `${repoDir} is not a git repository.\n` +
        `  Make sure you are pointing to the correct directory.\n` +
        `  Run \`dot install <repo-url>\` to set up your repository.`
    );
    process.exit(1);
  }

  // ── 2. Read config ───────────────────────────────────────────────────────
  let config;
  try {
    config = readConfig(repoDir);
  } catch (err) {
    logger.error("Could not read dot.yaml", err);
    process.exit(1);
  }

  // ── 3. Copy system files → repo ──────────────────────────────────────────
  logger.section("Backing up dotfiles");
  const results: FileOperationResult[] = backupDotfiles(
    config.dotfiles,
    repoDir
  );

  // ── 4. Report per-file results ───────────────────────────────────────────
  printResults(results);

  const failed = results.filter((r) => !r.success);
  if (failed.length > 0) {
    logger.warn("Some files could not be backed up — committing the rest.");
  }

  // ── 5. Commit & optionally push ──────────────────────────────────────────
  logger.section("Committing changes");

  // ── 5a. Stage ────────────────────────────────────────────────────────────
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

  // ── 5b. Commit ───────────────────────────────────────────────────────────
  const commitSpin = logger.spinner(`Committing: "${options.message}"…`);
  try {
    await gitCommit(repoDir, options.message);
    commitSpin.succeed(`Committed: "${options.message}"`);
  } catch (err) {
    commitSpin.fail("Commit failed");
    logger.error("git commit failed", err);
    process.exit(1);
  }

  // ── 5c. Push (optional) ──────────────────────────────────────────────────
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
 * Logs a human-readable summary of file backup operation results.
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
