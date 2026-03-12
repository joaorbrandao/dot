import fs from "fs";
import path from "path";
import os from "os";
import { DotfileEntry, FileOperationResult } from "../types/index.js";

/**
 * Expands a leading `~` in a file path to the current user's home directory.
 *
 * @param filePath - A raw path that may start with `~`.
 * @returns The resolved absolute path.
 */
export function expandHome(filePath: string): string {
  if (filePath.startsWith("~")) {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return filePath;
}

/**
 * Ensures every directory in the given path exists, creating them as needed.
 * Equivalent to `mkdir -p`.
 *
 * @param dirPath - Absolute path to the directory to create.
 */
export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Creates a symbolic link at `target` that points to `source`.
 * If a file, directory, or existing symlink already exists at `target` it is
 * removed first so the operation is idempotent.
 *
 * @param source - Absolute path that the symlink should point to (the file in the repo).
 * @param target - Absolute path where the symlink will be created on the system.
 */
export function createSymlink(source: string, target: string): void {
  // Remove any pre-existing file/symlink at the destination.
  if (fs.existsSync(target) || isSymlink(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }

  ensureDir(path.dirname(target));
  fs.symlinkSync(source, target);
}

/**
 * Copies `source` to `target`, overwriting the destination if it already exists.
 * Parent directories are created automatically.
 *
 * @param source - Absolute path to the file or directory to copy.
 * @param target - Absolute path of the copy destination.
 */
export function copyFile(source: string, target: string): void {
  ensureDir(path.dirname(target));
  fs.cpSync(source, target, { recursive: true, force: true });
}

/**
 * Installs a list of dotfile entries by either symlinking or copying each entry
 * from the repo into the system.  Errors for individual entries are collected
 * rather than thrown so the caller receives a complete result set.
 *
 * @param entries  - Array of `{ source, target }` pairs from `dot.yaml`.
 * @param repoDir  - Absolute path to the local dotfiles repository root.
 * @param useCopy  - When `true`, files are copied instead of symlinked.
 * @returns An array of `FileOperationResult` describing each operation's outcome.
 */
export function installDotfiles(
  entries: DotfileEntry[],
  repoDir: string,
  useCopy: boolean
): FileOperationResult[] {
  return entries.map((entry) => {
    const source = path.resolve(repoDir, entry.source);
    const target = expandHome(entry.target);

    try {
      if (!fs.existsSync(source)) {
        throw new Error(`Source path does not exist in repo: ${entry.source}`);
      }

      if (useCopy) {
        copyFile(source, target);
      } else {
        createSymlink(source, target);
      }

      return { source: entry.source, target, success: true };
    } catch (err) {
      return {
        source: entry.source,
        target,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });
}

/**
 * Backs up a list of dotfile entries by copying each system file back into the
 * dotfiles repository at its declared `source` path.  Errors for individual
 * entries are collected rather than thrown.
 *
 * @param entries - Array of `{ source, target }` pairs from `dot.yaml`.
 * @param repoDir - Absolute path to the local dotfiles repository root.
 * @returns An array of `FileOperationResult` describing each operation's outcome.
 */
export function backupDotfiles(
  entries: DotfileEntry[],
  repoDir: string
): FileOperationResult[] {
  return entries.map((entry) => {
    const systemPath = expandHome(entry.target);
    const repoPath = path.resolve(repoDir, entry.source);

    try {
      if (!fs.existsSync(systemPath)) {
        throw new Error(`Target not found on system: ${entry.target}`);
      }

      copyFile(systemPath, repoPath);

      return { source: entry.source, target: systemPath, success: true };
    } catch (err) {
      return {
        source: entry.source,
        target: systemPath,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });
}

/**
 * Checks whether a path is a symbolic link, even if the link's target is broken.
 *
 * @param filePath - Absolute path to check.
 * @returns `true` if the path is a symlink.
 */
function isSymlink(filePath: string): boolean {
  try {
    fs.lstatSync(filePath);
    return fs.lstatSync(filePath).isSymbolicLink();
  } catch {
    return false;
  }
}
