import fs from "fs";
import path from "path";

import { installCommand } from "../../commands/install.js";
import * as git from "../../utils/git.js";
import * as config from "../../utils/config.js";
import * as files from "../../utils/files.js";
import * as packages from "../../utils/packages.js";
import * as logger from "../../utils/logger.js";

jest.mock("fs");
jest.mock("../../utils/git.js");
jest.mock("../../utils/config.js");
jest.mock("../../utils/files.js");
jest.mock("../../utils/packages.js");
jest.mock("../../utils/logger.js");

const mockFs = fs as jest.Mocked<typeof fs>;
const mockGit = git as jest.Mocked<typeof git>;
const mockConfig = config as jest.Mocked<typeof config>;
const mockFiles = files as jest.Mocked<typeof files>;
const mockPackages = packages as jest.Mocked<typeof packages>;
const mockLogger = logger as jest.Mocked<typeof logger>;

// ── shared defaults ───────────────────────────────────────────────────────────

const REPO_URL = "https://github.com/user/dotfiles";
const LOCAL_DIR = "/home/user/dotfiles";
const LOCAL_REPO_PATH = "/home/user/my-local-dotfiles";
const DEFAULT_OPTIONS = { dir: LOCAL_DIR, copy: false, skipPackages: false };

// ── setup / teardown ──────────────────────────────────────────────────────────

let processExitSpy: jest.SpyInstance;
let spinner: { succeed: jest.Mock; fail: jest.Mock; stop: jest.Mock };

beforeEach(() => {
  jest.resetAllMocks();

  processExitSpy = jest
    .spyOn(process, "exit")
    .mockImplementation((code?: string | number | null) => {
      throw Object.assign(new Error(`process.exit(${code})`), { code });
    });

  spinner = { succeed: jest.fn(), fail: jest.fn(), stop: jest.fn() };
  mockLogger.spinner.mockReturnValue(spinner as any);

  mockLogger.section.mockImplementation(() => {});
  mockLogger.error.mockImplementation(() => {});
  mockLogger.info.mockImplementation(() => {});
  mockLogger.success.mockImplementation(() => {});

  // By default, dot.yaml exists in the repo (so no default is created).
  mockFs.existsSync.mockReturnValue(true);
  // writeAppConfig is mocked automatically via jest.mock.
  mockConfig.writeAppConfig.mockImplementation(() => {});
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe("installCommand()", () => {
  describe("git failure", () => {
    it("calls process.exit(1) when cloneOrPull throws", async () => {
      mockGit.cloneOrPull.mockRejectedValue(new Error("network error"));
      await expect(installCommand(REPO_URL, DEFAULT_OPTIONS)).rejects.toThrow("process.exit(1)");
      expect(spinner.fail).toHaveBeenCalled();
    });
  });

  describe("config failure", () => {
    it("calls process.exit(1) when readConfig throws", async () => {
      mockGit.cloneOrPull.mockResolvedValue({} as any);
      mockConfig.readConfig.mockImplementation(() => {
        throw new Error("no dot.yaml");
      });
      await expect(installCommand(REPO_URL, DEFAULT_OPTIONS)).rejects.toThrow("process.exit(1)");
    });
  });

  describe("full install flow", () => {
    beforeEach(() => {
      mockGit.cloneOrPull.mockResolvedValue({} as any);
      mockConfig.readConfig.mockReturnValue({
        dotfiles: [{ source: ".zshrc", target: "~/.zshrc" }],
        packages: { brew: ["neovim"] },
      });
      mockFiles.installDotfiles.mockReturnValue([
        { source: ".zshrc", target: "/home/user/.zshrc", success: true },
      ]);
      mockPackages.installPackages.mockResolvedValue(undefined);
    });

    it("installs packages from the config", async () => {
      await installCommand(REPO_URL, DEFAULT_OPTIONS);
      expect(mockPackages.installPackages).toHaveBeenCalledWith({ brew: ["neovim"] });
    });

    it("links dotfiles by default (copy = false)", async () => {
      await installCommand(REPO_URL, DEFAULT_OPTIONS);
      expect(mockFiles.installDotfiles).toHaveBeenCalledWith(
        [{ source: ".zshrc", target: "~/.zshrc" }],
        LOCAL_DIR,
        false
      );
    });

    it("copies dotfiles when copy = true", async () => {
      await installCommand(REPO_URL, { ...DEFAULT_OPTIONS, copy: true });
      expect(mockFiles.installDotfiles).toHaveBeenCalledWith(
        expect.any(Array),
        LOCAL_DIR,
        true
      );
    });

    it("does not call process.exit on success", async () => {
      await installCommand(REPO_URL, DEFAULT_OPTIONS);
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it("logs a success spinner message after cloning", async () => {
      await installCommand(REPO_URL, DEFAULT_OPTIONS);
      expect(spinner.succeed).toHaveBeenCalledWith("Repository ready");
    });

    it("saves repo path to app config", async () => {
      await installCommand(REPO_URL, DEFAULT_OPTIONS);
      expect(mockConfig.writeAppConfig).toHaveBeenCalledWith({
        repository: { localPath: LOCAL_DIR },
      });
    });
  });

  describe("dot.yaml auto-creation", () => {
    beforeEach(() => {
      mockGit.cloneOrPull.mockResolvedValue({} as any);
      mockConfig.readConfig.mockReturnValue({ dotfiles: [] });
      mockFiles.installDotfiles.mockReturnValue([]);
      mockConfig.writeDefaultConfig.mockImplementation(() => {});
    });

    it("creates dot.yaml when it does not exist in the repo", async () => {
      mockFs.existsSync.mockImplementation((p) => {
        // dot.yaml does not exist
        if (typeof p === "string" && p.endsWith("dot.yaml")) return false;
        return true;
      });

      await installCommand(REPO_URL, DEFAULT_OPTIONS);

      expect(mockConfig.writeDefaultConfig).toHaveBeenCalledWith(LOCAL_DIR);
    });

    it("does not create dot.yaml when it already exists", async () => {
      mockFs.existsSync.mockReturnValue(true);

      await installCommand(REPO_URL, DEFAULT_OPTIONS);

      expect(mockConfig.writeDefaultConfig).not.toHaveBeenCalled();
    });
  });

  describe("--skip-packages", () => {
    it("skips package installation and logs an info message", async () => {
      mockGit.cloneOrPull.mockResolvedValue({} as any);
      mockConfig.readConfig.mockReturnValue({
        dotfiles: [],
        packages: { brew: ["neovim"] },
      });
      mockFiles.installDotfiles.mockReturnValue([]);

      await installCommand(REPO_URL, { ...DEFAULT_OPTIONS, skipPackages: true });

      expect(mockPackages.installPackages).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("--skip-packages")
      );
    });
  });

  describe("no packages section", () => {
    it("does not call installPackages when config has no packages key", async () => {
      mockGit.cloneOrPull.mockResolvedValue({} as any);
      mockConfig.readConfig.mockReturnValue({ dotfiles: [] });
      mockFiles.installDotfiles.mockReturnValue([]);

      await installCommand(REPO_URL, DEFAULT_OPTIONS);

      expect(mockPackages.installPackages).not.toHaveBeenCalled();
    });
  });

  describe("package installation error (non-fatal)", () => {
    it("continues with dotfile linking even when installPackages throws", async () => {
      mockGit.cloneOrPull.mockResolvedValue({} as any);
      mockConfig.readConfig.mockReturnValue({
        dotfiles: [{ source: ".zshrc", target: "~/.zshrc" }],
        packages: { brew: ["neovim"] },
      });
      mockPackages.installPackages.mockRejectedValue(new Error("brew not found"));
      mockFiles.installDotfiles.mockReturnValue([
        { source: ".zshrc", target: "/home/user/.zshrc", success: true },
      ]);

      await installCommand(REPO_URL, DEFAULT_OPTIONS);

      // Dotfiles should still be installed.
      expect(mockFiles.installDotfiles).toHaveBeenCalled();
      // process.exit should NOT have been called (non-fatal error).
      expect(processExitSpy).not.toHaveBeenCalled();
    });
  });

  // ── --local option ────────────────────────────────────────────────────────

  describe("--local <path>", () => {
    const LOCAL_OPTIONS = { ...DEFAULT_OPTIONS, local: LOCAL_REPO_PATH };

    beforeEach(() => {
      mockConfig.readConfig.mockReturnValue({
        dotfiles: [{ source: ".zshrc", target: "~/.zshrc" }],
      });
      mockFiles.installDotfiles.mockReturnValue([
        { source: ".zshrc", target: "/home/user/.zshrc", success: true },
      ]);
    });

    it("skips the clone/pull step", async () => {
      await installCommand(undefined, LOCAL_OPTIONS);
      expect(mockGit.cloneOrPull).not.toHaveBeenCalled();
    });

    it("uses the local path as the dotfiles directory", async () => {
      await installCommand(undefined, LOCAL_OPTIONS);
      expect(mockFiles.installDotfiles).toHaveBeenCalledWith(
        expect.any(Array),
        LOCAL_REPO_PATH,
        false
      );
    });

    it("reads config from the local path", async () => {
      await installCommand(undefined, LOCAL_OPTIONS);
      expect(mockConfig.readConfig).toHaveBeenCalledWith(LOCAL_REPO_PATH);
    });

    it("saves local repo path to app config", async () => {
      await installCommand(undefined, LOCAL_OPTIONS);
      expect(mockConfig.writeAppConfig).toHaveBeenCalledWith({
        repository: { localPath: LOCAL_REPO_PATH },
      });
    });

    it("logs an info message instead of a spinner", async () => {
      await installCommand(undefined, LOCAL_OPTIONS);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(LOCAL_REPO_PATH)
      );
      expect(mockLogger.spinner).not.toHaveBeenCalledWith(
        expect.stringContaining("Fetching")
      );
    });

    it("does not call process.exit on success", async () => {
      await installCommand(undefined, LOCAL_OPTIONS);
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it("installs packages from the local repo config", async () => {
      mockConfig.readConfig.mockReturnValue({
        dotfiles: [],
        packages: { brew: ["neovim"] },
      });
      mockFiles.installDotfiles.mockReturnValue([]);
      mockPackages.installPackages.mockResolvedValue(undefined);

      await installCommand(undefined, LOCAL_OPTIONS);

      expect(mockPackages.installPackages).toHaveBeenCalledWith({ brew: ["neovim"] });
    });

    it("still calls process.exit(1) when readConfig throws", async () => {
      mockConfig.readConfig.mockImplementation(() => {
        throw new Error("no dot.yaml");
      });
      await expect(installCommand(undefined, LOCAL_OPTIONS)).rejects.toThrow("process.exit(1)");
    });
  });
});
