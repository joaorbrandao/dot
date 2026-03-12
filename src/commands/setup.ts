import fs from "fs";
import path from "path";
import os from "os";
import { SetupOptions } from "../types/index.js";
import { CONFIG_FILENAME } from "../utils/config.js";
import * as logger from "../utils/logger.js";

/**
 * The example `dot.yaml` written by the `setup` command.
 *
 * It includes an entry for `dot.yaml` itself so the configuration is
 * version-controlled alongside the rest of the dotfiles, plus commented-out
 * examples to guide users.
 */
const EXAMPLE_CONFIG = `# dot.yaml — Dotfiles Manager configuration
# https://github.com/joaorbrandao/dot
#
# Each entry under "dotfiles" maps a file (or directory) inside this
# repository to its destination on the system.
#
# source : path relative to the root of this dotfiles repository
# target : absolute destination path on the system (~ is expanded)

dotfiles:
  # Track this configuration file itself so it is always backed up.
  - source: .dotfiles/dot.yaml
    target: ~/.dotfiles/dot.yaml

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
 * Executes the `setup` command.
 *
 * Creates the dotfiles directory if it does not already exist, then writes
 * an example `dot.yaml` into it.  The example pre-populates an entry for
 * `dot.yaml` itself so the configuration file is tracked as a dotfile from
 * the start.  If a `dot.yaml` already exists the command aborts unless
 * `--force` is passed.
 *
 * @param options - Parsed CLI options for this command.
 */
export async function setupCommand(options: SetupOptions): Promise<void> {
  const dotfilesDir = path.resolve(expandHome(options.dir));
  const configPath = path.join(dotfilesDir, CONFIG_FILENAME);

  // ── Guard against accidental overwrite ───────────────────────────────────
  if (fs.existsSync(configPath) && !options.force) {
    logger.warn(
      `${configPath} already exists. Use --force to overwrite it.`
    );
    process.exit(1);
  }

  // ── Ensure the dotfiles directory exists ─────────────────────────────────
  if (!fs.existsSync(dotfilesDir)) {
    fs.mkdirSync(dotfilesDir, { recursive: true });
    logger.info(`Created directory: ${dotfilesDir}`);
  }

  // ── Write the example config ─────────────────────────────────────────────
  fs.writeFileSync(configPath, EXAMPLE_CONFIG, "utf8");
  logger.success(`Created ${configPath}`);

  logger.info(
    `Edit ${CONFIG_FILENAME} to describe your dotfiles, then run:\n` +
      `  dot install <repo-url>   — to install dot files from a remote repo\n` +
      `  dot backup               — to commit your current dotfiles`
  );
}

/**
 * Expands a leading `~` in a path to the user's home directory.
 *
 * @param p - The raw path string.
 * @returns The resolved absolute path.
 */
function expandHome(p: string): string {
  return p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p;
}
