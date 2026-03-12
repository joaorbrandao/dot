import fs from "fs";
import path from "path";
import os from "os";
import yaml from "js-yaml";
import { DotfilesConfig } from "../types/index.js";

/** Fallback location created by `dot setup` when no config exists in the repo. */
const DEFAULT_CONFIG_DIR = path.join(os.homedir(), ".dotfiles");

/** The expected filename for the dot configuration at the repo root. */
export const CONFIG_FILENAME = "dot.yaml";

/**
 * Reads and parses the `dot.yaml` configuration file.
 *
 * Resolution order:
 *  1. `<repoDir>/dot.yaml`  — the config committed inside the dotfiles repo.
 *  2. `~/.dotfiles/dot.yaml` — the file created by `dot setup` (fallback).
 *
 * Throws a descriptive error when neither location contains the file, or when
 * the file exists but contains invalid YAML or an unexpected structure.
 *
 * @param repoDir - Absolute path to the local dotfiles repository root.
 * @returns The parsed `DotfilesConfig` object.
 */
export function readConfig(repoDir: string): DotfilesConfig {
  const primaryPath = path.join(repoDir, CONFIG_FILENAME);
  const fallbackPath = path.join(DEFAULT_CONFIG_DIR, CONFIG_FILENAME);

  // Resolve which path to use, preferring the repo-local config.
  let configPath: string;
  if (fs.existsSync(primaryPath)) {
    configPath = primaryPath;
  } else if (fs.existsSync(fallbackPath)) {
    configPath = fallbackPath;
  } else {
    throw new Error(
      `No ${CONFIG_FILENAME} found in ${repoDir} or ${fallbackPath}. ` +
        `Run \`dot setup\` to create one.`
    );
  }

  const raw = fs.readFileSync(configPath, "utf8");

  let parsed: unknown;
  try {
    parsed = yaml.load(raw);
  } catch (err) {
    throw new Error(`Failed to parse ${CONFIG_FILENAME}: ${(err as Error).message}`);
  }

  if (!isValidConfig(parsed)) {
    throw new Error(
      `${CONFIG_FILENAME} must contain a top-level "dotfiles" array.`
    );
  }

  return parsed;
}

/**
 * Writes a `DotfilesConfig` object to `dot.yaml` inside the given repository directory.
 * Overwrites any existing file.
 *
 * @param repoDir - Absolute path to the local dotfiles repository root.
 * @param config  - The configuration to serialise and write.
 */
export function writeConfig(repoDir: string, config: DotfilesConfig): void {
  const configPath = path.join(repoDir, CONFIG_FILENAME);
  const content = yaml.dump(config, { lineWidth: 120 });
  fs.writeFileSync(configPath, content, "utf8");
}

/**
 * Type guard that verifies a parsed YAML value conforms to the `DotfilesConfig` shape.
 *
 * @param value - The raw parsed value from `js-yaml`.
 * @returns `true` when `value` satisfies the minimum required shape.
 */
function isValidConfig(value: unknown): value is DotfilesConfig {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return Array.isArray(obj["dotfiles"]);
}
