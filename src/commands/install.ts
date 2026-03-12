import path from "path";
import os from "os";
import { InstallOptions, FileOperationResult } from "../types/index.js";
import { cloneOrPull } from "../utils/git.js";
import { readConfig } from "../utils/config.js";
import { installDotfiles } from "../utils/files.js";
import { installPackages } from "../utils/packages.js";
import * as logger from "../utils/logger.js";

/**
 * Executes the `install` command.
 *
 * Workflow:
 *  1. Clone the remote repository (or pull if already present locally).
 *  2. Read `dot.yaml` from the repo root.
 *  3. Install declared packages (unless `--skip-packages` is passed).
 *  4. Link or copy each dotfile entry to its system target.
 *  5. Print a consolidated result summary.
 *
 * @param repoUrl - Remote git URL of the dotfiles repository.
 * @param options - Parsed CLI options for this command.
 */
export async function installCommand(
  repoUrl: string,
  options: InstallOptions
): Promise<void> {
  const localDir = path.resolve(expandHome(options.dir));

  // ── 1. Clone / pull ──────────────────────────────────────────────────────
  logger.section("Syncing repository");
  const spin = logger.spinner(`Fetching ${repoUrl} → ${localDir}`);

  try {
    await cloneOrPull(repoUrl, localDir);
    spin.succeed("Repository ready");
  } catch (err) {
    spin.fail("Failed to sync repository");
    logger.error("Git operation failed", err);
    process.exit(1);
  }

  // ── 2. Read config ───────────────────────────────────────────────────────
  let config;
  try {
    config = readConfig(localDir);
  } catch (err) {
    logger.error("Could not read dot.yaml", err);
    process.exit(1);
  }

  // ── 3. Install packages ──────────────────────────────────────────────────
  if (!options.skipPackages && config.packages) {
    try {
      await installPackages(config.packages);
    } catch (err) {
      logger.error("Package installation encountered an error", err);
      // Non-fatal: continue with dotfile linking.
    }
  } else if (options.skipPackages) {
    logger.info("Skipping package installation (--skip-packages)");
  }

  // ── 4. Link / copy dotfiles ──────────────────────────────────────────────
  logger.section("Installing dotfiles");
  const results: FileOperationResult[] = installDotfiles(
    config.dotfiles,
    localDir,
    options.copy
  );

  // ── 5. Report results ────────────────────────────────────────────────────
  printResults(results, options.copy ? "copied" : "symlinked");
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
 * Logs a human-readable summary of file operation results, grouped into
 * successes and failures.
 *
 * @param results - Array of operation outcomes.
 * @param verb    - Descriptive verb for successful operations (e.g. "symlinked").
 */
function printResults(results: FileOperationResult[], verb: string): void {
  const passed = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  passed.forEach((r) => logger.success(`${r.source} → ${r.target} (${verb})`));
  failed.forEach((r) =>
    logger.error(`${r.source} → ${r.target} failed: ${r.error}`)
  );

  logger.section("Summary");
  logger.info(`${passed.length} succeeded, ${failed.length} failed`);

  if (failed.length > 0) {
    process.exit(1);
  }
}
