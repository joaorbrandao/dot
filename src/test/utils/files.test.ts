import path from "path";
import fs from "fs";
import os from "os";

import {
  expandHome,
  ensureDir,
  createSymlink,
  copyFile,
  installDotfiles,
  backupDotfiles,
} from "../../utils/files.js";

jest.mock("fs");
jest.mock("os");

const mockFs = fs as jest.Mocked<typeof fs>;
const mockOs = os as jest.Mocked<typeof os>;

const HOME = "/home/testuser";

beforeEach(() => {
  jest.resetAllMocks();
  mockOs.homedir.mockReturnValue(HOME);
});

// ── expandHome ────────────────────────────────────────────────────────────────

describe("expandHome()", () => {
  it("replaces a leading ~ with the home directory", () => {
    expect(expandHome("~/.zshrc")).toBe(`${HOME}/.zshrc`);
  });

  it("replaces ~ alone with the home directory", () => {
    expect(expandHome("~")).toBe(path.join(HOME, ""));
  });

  it("leaves absolute paths unchanged", () => {
    expect(expandHome("/etc/hosts")).toBe("/etc/hosts");
  });

  it("leaves relative paths unchanged", () => {
    expect(expandHome("relative/path")).toBe("relative/path");
  });
});

// ── ensureDir ─────────────────────────────────────────────────────────────────

describe("ensureDir()", () => {
  it("calls fs.mkdirSync with the recursive flag", () => {
    mockFs.mkdirSync.mockImplementation(() => undefined);
    ensureDir("/some/nested/dir");
    expect(mockFs.mkdirSync).toHaveBeenCalledWith("/some/nested/dir", {
      recursive: true,
    });
  });
});

// ── createSymlink ─────────────────────────────────────────────────────────────

describe("createSymlink()", () => {
  const SOURCE = "/repo/.zshrc";
  const TARGET = `${HOME}/.zshrc`;

  it("removes an existing target before creating the symlink", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.rmSync.mockImplementation(() => {});
    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.symlinkSync.mockImplementation(() => {});

    createSymlink(SOURCE, TARGET);

    expect(mockFs.rmSync).toHaveBeenCalledWith(TARGET, {
      recursive: true,
      force: true,
    });
    expect(mockFs.symlinkSync).toHaveBeenCalledWith(SOURCE, TARGET);
  });

  it("does not call rmSync when the target does not exist and is not a symlink", () => {
    mockFs.existsSync.mockReturnValue(false);
    // lstatSync throws for a missing path (simulates ENOENT)
    mockFs.lstatSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.symlinkSync.mockImplementation(() => {});

    createSymlink(SOURCE, TARGET);

    expect(mockFs.rmSync).not.toHaveBeenCalled();
    expect(mockFs.symlinkSync).toHaveBeenCalledWith(SOURCE, TARGET);
  });

  it("creates parent directories for the symlink target", () => {
    mockFs.existsSync.mockReturnValue(false);
    mockFs.lstatSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.symlinkSync.mockImplementation(() => {});

    createSymlink(SOURCE, TARGET);

    expect(mockFs.mkdirSync).toHaveBeenCalledWith(path.dirname(TARGET), {
      recursive: true,
    });
  });
});

// ── copyFile ──────────────────────────────────────────────────────────────────

describe("copyFile()", () => {
  it("creates parent directories and copies the file", () => {
    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.cpSync.mockImplementation(() => {});

    copyFile("/src/file.txt", "/dest/subdir/file.txt");

    expect(mockFs.mkdirSync).toHaveBeenCalledWith(
      path.dirname("/dest/subdir/file.txt"),
      { recursive: true }
    );
    expect(mockFs.cpSync).toHaveBeenCalledWith(
      "/src/file.txt",
      "/dest/subdir/file.txt",
      { recursive: true, force: true }
    );
  });
});

// ── installDotfiles ───────────────────────────────────────────────────────────

describe("installDotfiles()", () => {
  const REPO = "/repo";
  const ENTRIES = [
    { source: ".zshrc", target: "~/.zshrc" },
    { source: ".gitconfig", target: "~/.gitconfig" },
  ];

  it("symlinks all entries when useCopy is false", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.rmSync.mockImplementation(() => {});
    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.symlinkSync.mockImplementation(() => {});

    const results = installDotfiles(ENTRIES, REPO, false);

    expect(results).toHaveLength(2);
    results.forEach((r) => expect(r.success).toBe(true));
    expect(mockFs.symlinkSync).toHaveBeenCalledTimes(2);
    expect(mockFs.cpSync).not.toHaveBeenCalled();
  });

  it("copies all entries when useCopy is true", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.cpSync.mockImplementation(() => {});

    const results = installDotfiles(ENTRIES, REPO, true);

    expect(results).toHaveLength(2);
    results.forEach((r) => expect(r.success).toBe(true));
    expect(mockFs.cpSync).toHaveBeenCalledTimes(2);
    expect(mockFs.symlinkSync).not.toHaveBeenCalled();
  });

  it("records a failure when the source does not exist in the repo", () => {
    mockFs.existsSync.mockReturnValue(false);

    const results = installDotfiles(
      [{ source: "missing.txt", target: "~/missing.txt" }],
      REPO,
      false
    );

    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain("Source path does not exist in repo");
  });

  it("records a failure when fs.symlinkSync throws", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.rmSync.mockImplementation(() => {});
    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.symlinkSync.mockImplementation(() => {
      throw new Error("permission denied");
    });

    const results = installDotfiles(
      [{ source: ".zshrc", target: "~/.zshrc" }],
      REPO,
      false
    );

    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain("permission denied");
  });

  it("resolves source relative to repoDir", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.cpSync.mockImplementation(() => {});

    installDotfiles([{ source: ".zshrc", target: "~/.zshrc" }], REPO, true);

    expect(mockFs.cpSync).toHaveBeenCalledWith(
      path.resolve(REPO, ".zshrc"),
      expect.any(String),
      expect.any(Object)
    );
  });
});

// ── backupDotfiles ────────────────────────────────────────────────────────────

describe("backupDotfiles()", () => {
  const REPO = "/repo";
  const ENTRIES = [{ source: ".zshrc", target: "~/.zshrc" }];

  it("copies the system file into the repo at the declared source path", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.cpSync.mockImplementation(() => {});

    const results = backupDotfiles(ENTRIES, REPO);

    expect(results[0].success).toBe(true);
    expect(mockFs.cpSync).toHaveBeenCalledWith(
      `${HOME}/.zshrc`,
      path.resolve(REPO, ".zshrc"),
      { recursive: true, force: true }
    );
  });

  it("records a failure when the system target does not exist", () => {
    mockFs.existsSync.mockReturnValue(false);

    const results = backupDotfiles(ENTRIES, REPO);

    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain("Target not found on system");
  });

  it("records a failure when copying throws", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.cpSync.mockImplementation(() => {
      throw new Error("disk full");
    });

    const results = backupDotfiles(ENTRIES, REPO);

    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain("disk full");
  });

  it("returns results for every entry in the array", () => {
    const entries = [
      { source: ".zshrc", target: "~/.zshrc" },
      { source: ".gitconfig", target: "~/.gitconfig" },
    ];
    mockFs.existsSync.mockReturnValue(true);
    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.cpSync.mockImplementation(() => {});

    const results = backupDotfiles(entries, REPO);

    expect(results).toHaveLength(2);
  });
});
