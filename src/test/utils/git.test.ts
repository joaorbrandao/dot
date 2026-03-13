import fs from "fs";
import { simpleGit } from "simple-git";

import {
  cloneOrPull,
  stageAll,
  gitCommit,
  gitPush,
  commitAndPush,
  getRepoStatus,
} from "../../utils/git.js";

jest.mock("fs");
jest.mock("simple-git");

const mockFs = fs as jest.Mocked<typeof fs>;
const mockSimpleGit = simpleGit as jest.MockedFunction<typeof simpleGit>;

// ── helpers ───────────────────────────────────────────────────────────────────

/** Creates a fully-mocked simple-git instance. */
function makeGitMock(statusOverride?: Partial<{ isClean: () => boolean; staged: string[]; modified: string[]; not_added: string[] }>) {
  const status = {
    isClean: () => false,
    staged: [],
    modified: [],
    not_added: [],
    ...statusOverride,
  };

  return {
    pull: jest.fn().mockResolvedValue({}),
    clone: jest.fn().mockResolvedValue({}),
    add: jest.fn().mockResolvedValue({}),
    status: jest.fn().mockResolvedValue(status),
    commit: jest.fn().mockResolvedValue({}),
    push: jest.fn().mockResolvedValue({}),
  };
}

let gitMock: ReturnType<typeof makeGitMock>;

beforeEach(() => {
  jest.resetAllMocks();
  gitMock = makeGitMock();
  mockSimpleGit.mockReturnValue(gitMock as any);
});

// ── cloneOrPull ───────────────────────────────────────────────────────────────

describe("cloneOrPull()", () => {
  const REPO_URL = "https://github.com/user/dotfiles";
  const LOCAL_DIR = "/home/user/dotfiles";

  it("pulls when the .git directory already exists", async () => {
    mockFs.existsSync.mockReturnValue(true);

    await cloneOrPull(REPO_URL, LOCAL_DIR);

    expect(gitMock.pull).toHaveBeenCalled();
    expect(gitMock.clone).not.toHaveBeenCalled();
  });

  it("clones the repository when the directory does not exist", async () => {
    mockFs.existsSync.mockReturnValue(false);

    await cloneOrPull(REPO_URL, LOCAL_DIR);

    expect(gitMock.clone).toHaveBeenCalledWith(REPO_URL, LOCAL_DIR);
    expect(gitMock.pull).not.toHaveBeenCalled();
  });

  it("returns a SimpleGit instance bound to the local directory", async () => {
    mockFs.existsSync.mockReturnValue(false);
    const git = await cloneOrPull(REPO_URL, LOCAL_DIR);
    expect(git).toBeDefined();
  });
});

// ── stageAll ──────────────────────────────────────────────────────────────────

describe("stageAll()", () => {
  it("runs git add . and returns true when there are uncommitted changes", async () => {
    const result = await stageAll("/repo");
    expect(gitMock.add).toHaveBeenCalledWith(".");
    expect(result).toBe(true);
  });

  it("returns false when the working tree is already clean", async () => {
    gitMock.status.mockResolvedValue({ isClean: () => true } as any);

    const result = await stageAll("/repo");
    expect(result).toBe(false);
  });
});

// ── gitCommit ─────────────────────────────────────────────────────────────────

describe("gitCommit()", () => {
  it("commits with the provided message", async () => {
    await gitCommit("/repo", "feat: add dotfiles");
    expect(gitMock.commit).toHaveBeenCalledWith("feat: add dotfiles");
  });

  it("propagates errors thrown by simple-git", async () => {
    gitMock.commit.mockRejectedValue(new Error("nothing to commit"));
    await expect(gitCommit("/repo", "msg")).rejects.toThrow("nothing to commit");
  });
});

// ── gitPush ───────────────────────────────────────────────────────────────────

describe("gitPush()", () => {
  it("pushes to the current remote tracking branch", async () => {
    await gitPush("/repo");
    expect(gitMock.push).toHaveBeenCalled();
  });

  it("propagates errors thrown by simple-git", async () => {
    gitMock.push.mockRejectedValue(new Error("remote rejected"));
    await expect(gitPush("/repo")).rejects.toThrow("remote rejected");
  });
});

// ── commitAndPush ─────────────────────────────────────────────────────────────

describe("commitAndPush()", () => {
  it("stages, commits, and pushes when there are changes", async () => {
    await commitAndPush("/repo", "backup: dotfiles", true);

    expect(gitMock.add).toHaveBeenCalledWith(".");
    expect(gitMock.commit).toHaveBeenCalledWith("backup: dotfiles");
    expect(gitMock.push).toHaveBeenCalled();
  });

  it("does nothing when the working tree is already clean", async () => {
    gitMock.status.mockResolvedValue({ isClean: () => true } as any);

    await commitAndPush("/repo", "backup: dotfiles", true);

    expect(gitMock.commit).not.toHaveBeenCalled();
    expect(gitMock.push).not.toHaveBeenCalled();
  });

  it("commits but does not push when push is false", async () => {
    await commitAndPush("/repo", "backup: dotfiles", false);

    expect(gitMock.commit).toHaveBeenCalled();
    expect(gitMock.push).not.toHaveBeenCalled();
  });
});

// ── getRepoStatus ─────────────────────────────────────────────────────────────

describe("getRepoStatus()", () => {
  it("returns staged, modified, and untracked file lists", async () => {
    gitMock.status.mockResolvedValue({
      staged: ["a.ts"],
      modified: ["b.ts"],
      not_added: ["c.ts"],
    } as any);

    const result = await getRepoStatus("/repo");

    expect(result.staged).toEqual(["a.ts"]);
    expect(result.modified).toEqual(["b.ts"]);
    expect(result.untracked).toEqual(["c.ts"]);
  });

  it("returns empty arrays when the working tree is clean", async () => {
    gitMock.status.mockResolvedValue({
      staged: [],
      modified: [],
      not_added: [],
    } as any);

    const result = await getRepoStatus("/repo");

    expect(result.staged).toHaveLength(0);
    expect(result.modified).toHaveLength(0);
    expect(result.untracked).toHaveLength(0);
  });
});
