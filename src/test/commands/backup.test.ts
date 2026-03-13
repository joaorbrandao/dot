import fs from "fs";

import { backupCommand } from "../../commands/backup.js";
import * as git from "../../utils/git.js";
import * as config from "../../utils/config.js";
import * as files from "../../utils/files.js";
import * as logger from "../../utils/logger.js";

jest.mock("fs");
jest.mock("../../utils/git.js");
jest.mock("../../utils/config.js");
jest.mock("../../utils/files.js");
jest.mock("../../utils/logger.js");

const mockFs = fs as jest.Mocked<typeof fs>;
const mockGit = git as jest.Mocked<typeof git>;
const mockConfig = config as jest.Mocked<typeof config>;
const mockFiles = files as jest.Mocked<typeof files>;
const mockLogger = logger as jest.Mocked<typeof logger>;

// ── shared defaults ───────────────────────────────────────────────────────────

const REPO_DIR = "/home/user/dotfiles";
const DEFAULT_OPTIONS = {
  dir: REPO_DIR,
  message: "backup: update dotfiles",
  push: true,
};

// ── helpers ───────────────────────────────────────────────────────────────────

function makeSpinner() {
  return { succeed: jest.fn(), fail: jest.fn(), stop: jest.fn() };
}

// ── setup / teardown ──────────────────────────────────────────────────────────

let processExitSpy: jest.SpyInstance;
let spinner: ReturnType<typeof makeSpinner>;

beforeEach(() => {
  jest.resetAllMocks();

  processExitSpy = jest
    .spyOn(process, "exit")
    .mockImplementation((code?: string | number | null) => {
      throw Object.assign(new Error(`process.exit(${code})`), { code });
    });

  spinner = makeSpinner();
  mockLogger.spinner.mockReturnValue(spinner as any);

  // Silence all logger calls by default.
  mockLogger.section.mockImplementation(() => {});
  mockLogger.error.mockImplementation(() => {});
  mockLogger.warn.mockImplementation(() => {});
  mockLogger.info.mockImplementation(() => {});
  mockLogger.success.mockImplementation(() => {});
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe("backupCommand()", () => {
  describe("guard: not a git repository", () => {
    it("calls process.exit(1) when the .git directory is missing", async () => {
      mockFs.existsSync.mockReturnValue(false);
      await expect(backupCommand(DEFAULT_OPTIONS)).rejects.toThrow("process.exit(1)");
    });

    it("logs an error message before exiting", async () => {
      mockFs.existsSync.mockReturnValue(false);
      await expect(backupCommand(DEFAULT_OPTIONS)).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe("guard: config cannot be read", () => {
    it("calls process.exit(1) when readConfig throws", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockConfig.readConfig.mockImplementation(() => {
        throw new Error("no dot.yaml");
      });
      await expect(backupCommand(DEFAULT_OPTIONS)).rejects.toThrow("process.exit(1)");
    });
  });

  describe("nothing to commit", () => {
    it("exits early with a success spinner message when stageAll returns false", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockConfig.readConfig.mockReturnValue({ dotfiles: [] });
      mockFiles.backupDotfiles.mockReturnValue([]);
      mockGit.stageAll.mockResolvedValue(false);

      await backupCommand(DEFAULT_OPTIONS);

      expect(spinner.succeed).toHaveBeenCalled();
      expect(mockGit.gitCommit).not.toHaveBeenCalled();
    });
  });

  describe("full backup flow", () => {
    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(true);
      mockConfig.readConfig.mockReturnValue({
        dotfiles: [{ source: ".zshrc", target: "~/.zshrc" }],
      });
      mockFiles.backupDotfiles.mockReturnValue([
        { source: ".zshrc", target: "/home/user/.zshrc", success: true },
      ]);
      mockGit.stageAll.mockResolvedValue(true);
      mockGit.getRepoStatus.mockResolvedValue({
        staged: [".zshrc"],
        modified: [],
        untracked: [],
      });
      mockGit.gitCommit.mockResolvedValue(undefined);
      mockGit.gitPush.mockResolvedValue(undefined);
    });

    it("commits with the provided message", async () => {
      await backupCommand(DEFAULT_OPTIONS);
      expect(mockGit.gitCommit).toHaveBeenCalledWith(REPO_DIR, DEFAULT_OPTIONS.message);
    });

    it("pushes to remote when push option is true", async () => {
      await backupCommand(DEFAULT_OPTIONS);
      expect(mockGit.gitPush).toHaveBeenCalled();
    });

    it("skips the push when push option is false", async () => {
      await backupCommand({ ...DEFAULT_OPTIONS, push: false });
      expect(mockGit.gitPush).not.toHaveBeenCalled();
    });

    it("does not call process.exit on success", async () => {
      await backupCommand(DEFAULT_OPTIONS);
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it("logs staged file count in the spinner message", async () => {
      await backupCommand(DEFAULT_OPTIONS);
      expect(spinner.succeed).toHaveBeenCalledWith(
        expect.stringContaining("1 file(s) staged")
      );
    });
  });

  describe("error paths", () => {
    it("calls process.exit(1) when stageAll throws", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockConfig.readConfig.mockReturnValue({ dotfiles: [] });
      mockFiles.backupDotfiles.mockReturnValue([]);
      mockGit.stageAll.mockRejectedValue(new Error("git add failed"));

      await expect(backupCommand(DEFAULT_OPTIONS)).rejects.toThrow("process.exit(1)");
      expect(spinner.fail).toHaveBeenCalled();
    });

    it("calls process.exit(1) when gitCommit throws", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockConfig.readConfig.mockReturnValue({ dotfiles: [] });
      mockFiles.backupDotfiles.mockReturnValue([]);
      mockGit.stageAll.mockResolvedValue(true);
      mockGit.getRepoStatus.mockResolvedValue({
        staged: ["x"],
        modified: [],
        untracked: [],
      });
      mockGit.gitCommit.mockRejectedValue(new Error("commit failed"));

      await expect(backupCommand(DEFAULT_OPTIONS)).rejects.toThrow("process.exit(1)");
    });

    it("calls process.exit(1) when gitPush throws", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockConfig.readConfig.mockReturnValue({ dotfiles: [] });
      mockFiles.backupDotfiles.mockReturnValue([]);
      mockGit.stageAll.mockResolvedValue(true);
      mockGit.getRepoStatus.mockResolvedValue({ staged: ["x"], modified: [], untracked: [] });
      mockGit.gitCommit.mockResolvedValue(undefined);
      mockGit.gitPush.mockRejectedValue(new Error("push failed"));

      await expect(backupCommand(DEFAULT_OPTIONS)).rejects.toThrow("process.exit(1)");
    });
  });

  describe("partial backup (some files failed)", () => {
    it("logs a warning when some file operations failed", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockConfig.readConfig.mockReturnValue({
        dotfiles: [
          { source: ".zshrc", target: "~/.zshrc" },
          { source: ".missing", target: "~/.missing" },
        ],
      });
      mockFiles.backupDotfiles.mockReturnValue([
        { source: ".zshrc", target: "/home/user/.zshrc", success: true },
        {
          source: ".missing",
          target: "/home/user/.missing",
          success: false,
          error: "not found",
        },
      ]);
      mockGit.stageAll.mockResolvedValue(false);

      await backupCommand(DEFAULT_OPTIONS);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Some files could not be backed up")
      );
    });
  });
});
