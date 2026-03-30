import { $ } from "zx";

/**
 * Result of a gitleaks secret scan.
 */
export interface SecretsResult {
  /** Whether no secrets were found. */
  clean: boolean;
  /** Whether gitleaks is installed on the system. */
  installed: boolean;
  /** Raw gitleaks output when secrets are detected. */
  output?: string;
}

/**
 * Runs `gitleaks detect` against the given directory to scan for secrets.
 *
 * Scanning is done with `--no-git` so that freshly copied files that have not
 * yet been staged are included in the scan.
 *
 * @param repoDir - Absolute path to the directory to scan.
 * @returns A `SecretsResult` describing whether secrets were found.
 */
export async function scanForSecrets(repoDir: string): Promise<SecretsResult> {
  try {
    await $`gitleaks detect --source ${repoDir} --no-git --exit-code 1`;
    return { clean: true, installed: true };
  } catch (err: any) {
    // Binary not found — gitleaks is not installed
    if (err.code === "ENOENT") {
      return { clean: true, installed: false };
    }

    // gitleaks exits with code 1 when secrets are detected
    if (err.exitCode === 1) {
      const output = [err.stdout, err.stderr]
        .filter(Boolean)
        .join("\n")
        .trim();
      return { clean: false, installed: true, output: output || undefined };
    }

    throw err;
  }
}
