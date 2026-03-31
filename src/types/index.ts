import { z } from "zod";

// ── Zod schemas for config files ─────────────────────────────────────────────

export const DotfileEntrySchema = z.object({
  source: z.string(),
  target: z.string(),
});

export const PackageMapSchema = z.record(
  z.string(),
  z.array(z.string()).nullable().optional()
);

export const DotfilesConfigSchema = z.object({
  dotfiles: z.array(DotfileEntrySchema),
  packages: PackageMapSchema.optional(),
});

export const AppConfigSchema = z.object({
  repository: z.object({
    localPath: z.string(),
  }),
});

// ── Derived TypeScript types ─────────────────────────────────────────────────

export type DotfileEntry = z.infer<typeof DotfileEntrySchema>;
export type PackageMap = z.infer<typeof PackageMapSchema>;
export type DotfilesConfig = z.infer<typeof DotfilesConfigSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;

// ── CLI option types (not config file types) ─────────────────────────────────

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
 * Options accepted by the `backup` command.
 *
 * Note: Commander maps `--no-push` to the `push` property (boolean, default true).
 * When the user passes `--no-push`, Commander sets `push = false`.
 */
export interface BackupOptions {
  /** Git commit message override. */
  message: string;
  /**
   * Controls whether changes are pushed to the remote after committing.
   * Set to `false` by Commander when the user passes `--no-push`.
   */
  push: boolean;
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
