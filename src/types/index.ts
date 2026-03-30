/**
 * Represents a single dotfile mapping in dot.yaml.
 * `source` is the path inside the dotfiles repository.
 * `target` is the absolute (or ~-prefixed) destination path on the system.
 */
export interface DotfileEntry {
  source: string;
  target: string;
}

/**
 * Describes the package manager sections supported in dot.yaml.
 * Each key is a package manager name and its value is the list of packages to install.
 */
export interface PackageMap {
  brew?: string[];
  npm?: string[];
  pip?: string[];
  apt?: string[];
  [manager: string]: string[] | undefined;
}

/**
 * Root structure of the dot.yaml configuration file that lives in the dotfiles repo.
 */
export interface DotfilesConfig {
  dotfiles: DotfileEntry[];
  packages?: PackageMap;
}

/**
 * Options accepted by the `install` command.
 */
export interface InstallOptions {
  /** Local directory where the repo will be cloned / already exists. */
  dir: string;
  /**
   * Path to an already-present local repository.
   * When provided, the clone/pull step is skipped entirely and this path
   * is used directly as the dotfiles directory.
   */
  local?: string;
  /** When true, files are copied instead of symlinked. */
  copy: boolean;
  /** When true, skip package installation. */
  skipPackages: boolean;
}

/**
 * Options accepted by the `setup` command.
 */
export interface SetupOptions {
  /** Directory where the example `dot.yaml` will be written. */
  dir: string;
  /** When true, overwrite an existing `dot.yaml` without prompting. */
  force: boolean;
}

/**
 * Options accepted by the `backup` command.
 *
 * Note: Commander maps `--no-push` to the `push` property (boolean, default true).
 * When the user passes `--no-push`, Commander sets `push = false`.
 */
export interface BackupOptions {
  /** Local path of the dotfiles repository. */
  dir: string;
  /** Git commit message override. */
  message: string;
  /**
   * Controls whether changes are pushed to the remote after committing.
   * Set to `false` by Commander when the user passes `--no-push`.
   */
  push: boolean;
  /** When true, skip the gitleaks secret scan before committing. */
  skipSecretsCheck?: boolean;
}

/**
 * Outcome of a single file install/backup operation used for result reporting.
 */
export interface FileOperationResult {
  source: string;
  target: string;
  success: boolean;
  error?: string;
}
