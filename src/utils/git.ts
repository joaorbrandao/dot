import path from "path";
import fs from "fs";
import { simpleGit, SimpleGit } from "simple-git";

/**
 * Clones a remote repository into `localDir` when the directory does not exist yet.
 * If the directory already exists it is assumed to be the correct repository and a
 * `git pull` is performed to bring it up to date instead.
 *
 * @param repoUrl  - HTTPS or SSH URL of the remote repository.
 * @param localDir - Absolute path where the repo should be cloned / updated.
 * @returns The `SimpleGit` instance bound to `localDir`.
 */
export async function cloneOrPull(
  repoUrl: string,
  localDir: string
): Promise<SimpleGit> {
  const git = simpleGit();

  if (fs.existsSync(path.join(localDir, ".git"))) {
    // Repository already exists locally — just pull latest changes.
    const localGit = simpleGit(localDir);
    await localGit.pull();
    return localGit;
  }

  // Clone from remote into the target directory.
  await git.clone(repoUrl, localDir);
  return simpleGit(localDir);
}

/**
 * Stages all new, modified, and deleted files in the repository (`git add .`).
 *
 * @param repoDir - Absolute path to the local repository root.
 * @returns `true` when there are staged changes ready to commit, `false` when
 *          the working tree is already clean (nothing to commit).
 */
export async function stageAll(repoDir: string): Promise<boolean> {
  const git = simpleGit(repoDir);
  await git.add(".");
  const status = await git.status();
  return !status.isClean();
}

/**
 * Creates a commit in the repository with the provided message.
 * Callers should ensure there are staged changes before calling this
 * (see `stageAll`).
 *
 * @param repoDir - Absolute path to the local repository root.
 * @param message - Commit message string.
 */
export async function gitCommit(repoDir: string, message: string): Promise<void> {
  const git = simpleGit(repoDir);
  await git.commit(message);
}

/**
 * Pushes the current branch to its tracked remote.
 *
 * @param repoDir - Absolute path to the local repository root.
 */
export async function gitPush(repoDir: string): Promise<void> {
  const git = simpleGit(repoDir);
  await git.push();
}

/**
 * Stages all changes in the repository, creates a commit with the given message,
 * and optionally pushes to the tracked remote branch.
 *
 * @param repoDir - Absolute path to the local repository root.
 * @param message - Commit message string.
 * @param push    - When `true`, `git push` is executed after the commit.
 */
export async function commitAndPush(
  repoDir: string,
  message: string,
  push: boolean
): Promise<void> {
  const hasChanges = await stageAll(repoDir);
  if (!hasChanges) return;
  await gitCommit(repoDir, message);
  if (push) await gitPush(repoDir);
}

/**
 * Returns the current status summary of the repository located at `repoDir`.
 * Useful for reporting what changes were staged before a commit.
 *
 * @param repoDir - Absolute path to the local repository root.
 * @returns An object with `staged`, `modified`, and `untracked` file lists.
 */
export async function getRepoStatus(repoDir: string): Promise<{
  staged: string[];
  modified: string[];
  untracked: string[];
}> {
  const git = simpleGit(repoDir);
  const status = await git.status();

  return {
    staged: status.staged,
    modified: status.modified,
    untracked: status.not_added,
  };
}
