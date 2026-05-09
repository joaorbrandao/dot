import fs from "fs";
import path from "path";
import os from "os";
import yaml from "js-yaml";
import {
  AppConfig,
  AppConfigSchema,
  DotfilesConfig,
  DotfilesConfigSchema,
} from "../types/index.js";

/** The expected filename for the dot configuration at the repo root. */
export const CONFIG_FILENAME = "dot.yaml";

/** Directory where the application-level config is stored. */
export const APP_CONFIG_DIR = path.join(os.homedir(), ".dot");

/** Full path to the application-level config file. */
export const APP_CONFIG_PATH = path.join(APP_CONFIG_DIR, "config.yaml");

/**
 * The example `dot.yaml` written when a repository has no config file.
 *
 * Written as a raw string (not via `yaml.dump`) so comments are preserved.
 */
export const EXAMPLE_CONFIG = `# dot.yaml — Dotfiles Manager configuration
# https://github.com/joaorbrandao/dot
#
# Each entry under "dotfiles" maps a file (or directory) inside this
# repository to its destination on the system.
#
# source : path relative to the root of this dotfiles repository
# target : absolute destination path on the system (~ is expanded)

dotfiles:
  # ── Examples — uncomment and adjust as needed ──────────────────────────

  # - source: .zshrc
  #   target: ~/.zshrc

  # - source: .gitconfig
  #   target: ~/.gitconfig

  # - source: .config/nvim
  #   target: ~/.config/nvim

  # - source: .config/starship.toml
  #   target: ~/.config/starship.toml

# Packages to install before linking dotfiles.
# Supported managers: brew, npm, pip, apt
#
# packages:
#   brew:
#     - neovim
#     - zsh
#     - starship
#   npm:
#     - typescript
`;

/**
 * Reads and parses the `dot.yaml` configuration file from the repository root.
 *
 * Throws a descriptive error when the file is missing, contains invalid YAML,
 * or has an unexpected structure.
 *
 * @param repoDir - Absolute path to the local dotfiles repository root.
 * @returns The parsed `DotfilesConfig` object.
 */
export function readConfig(repoDir: string): DotfilesConfig {
  const configPath = path.join(repoDir, CONFIG_FILENAME);

  if (!fs.existsSync(configPath)) {
    throw new Error(
      `No ${CONFIG_FILENAME} found in ${repoDir}. ` +
        `Run \`dot install <repo-url>\` first.`
    );
  }

  const raw = fs.readFileSync(configPath, "utf8");

  let parsed: unknown;
  try {
    parsed = yaml.load(raw);
  } catch (err) {
    throw new Error(`Failed to parse ${CONFIG_FILENAME}: ${(err as Error).message}`);
  }

  const result = DotfilesConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `${CONFIG_FILENAME} must contain a top-level "dotfiles" array.`
    );
  }

  return result.data;
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
 * Writes the EXAMPLE_CONFIG template to `dot.yaml` inside the given directory.
 * Preserves comments by writing the raw string (not via yaml.dump).
 *
 * @param repoDir - Absolute path to the local dotfiles repository root.
 */
export function writeDefaultConfig(repoDir: string): void {
  const configPath = path.join(repoDir, CONFIG_FILENAME);
  fs.writeFileSync(configPath, EXAMPLE_CONFIG, "utf8");
}

/**
 * Reads and parses the application-level config at ~/.dot/config.yaml.
 *
 * @returns The parsed `AppConfig` object.
 */
export function readAppConfig(): AppConfig {
  if (!fs.existsSync(APP_CONFIG_PATH)) {
    throw new Error(
      `No config found at ${APP_CONFIG_PATH}. ` +
        `Run \`dot install <repo-url>\` first.`
    );
  }

  const raw = fs.readFileSync(APP_CONFIG_PATH, "utf8");

  let parsed: unknown;
  try {
    parsed = yaml.load(raw);
  } catch (err) {
    throw new Error(`Failed to parse ${APP_CONFIG_PATH}: ${(err as Error).message}`);
  }

  const result = AppConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `${APP_CONFIG_PATH} must contain repository.localPath.`
    );
  }

  return result.data;
}

/**
 * Writes the application-level config to ~/.dot/config.yaml.
 * Creates the ~/.dot/ directory if it does not exist.
 *
 * @param config - The application config to write.
 */
export function writeAppConfig(config: AppConfig): void {
  if (!fs.existsSync(APP_CONFIG_DIR)) {
    fs.mkdirSync(APP_CONFIG_DIR, { recursive: true });
  }
  const content = yaml.dump(config, { lineWidth: 120 });
  fs.writeFileSync(APP_CONFIG_PATH, content, "utf8");
}
