import fs from "fs";

import { setupCommand } from "../../commands/setup.js";
import * as logger from "../../utils/logger.js";

jest.mock("fs");
jest.mock("../../utils/logger.js");

const mockFs = fs as jest.Mocked<typeof fs>;
const mockLogger = logger as jest.Mocked<typeof logger>;

// ── shared defaults ───────────────────────────────────────────────────────────

const DOTFILES_DIR = "/home/user/.dotfiles";
const DEFAULT_OPTIONS = { dir: DOTFILES_DIR, force: false };

// ── setup / teardown ──────────────────────────────────────────────────────────

let processExitSpy: jest.SpyInstance;

beforeEach(() => {
  jest.resetAllMocks();

  processExitSpy = jest
    .spyOn(process, "exit")
    .mockImplementation((code?: string | number | null) => {
      throw Object.assign(new Error(`process.exit(${code})`), { code });
    });

  mockLogger.warn.mockImplementation(() => {});
  mockLogger.info.mockImplementation(() => {});
  mockLogger.success.mockImplementation(() => {});
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe("setupCommand()", () => {
  describe("guard: config already exists", () => {
    it("calls process.exit(1) when dot.yaml exists and --force is not set", async () => {
      mockFs.existsSync.mockReturnValue(true);
      await expect(setupCommand(DEFAULT_OPTIONS)).rejects.toThrow("process.exit(1)");
    });

    it("does not write the config file when exiting early", async () => {
      mockFs.existsSync.mockReturnValue(true);
      await expect(setupCommand(DEFAULT_OPTIONS)).rejects.toThrow();
      expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    });

    it("warns the user about the existing file", async () => {
      mockFs.existsSync.mockReturnValue(true);
      await expect(setupCommand(DEFAULT_OPTIONS)).rejects.toThrow();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("already exists")
      );
    });
  });

  describe("--force flag", () => {
    it("overwrites an existing dot.yaml when --force is set", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {});

      await setupCommand({ ...DEFAULT_OPTIONS, force: true });

      expect(mockFs.writeFileSync).toHaveBeenCalled();
      expect(processExitSpy).not.toHaveBeenCalled();
    });
  });

  describe("first-time setup", () => {
    beforeEach(() => {
      // No existing config, no existing directory.
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => undefined);
      mockFs.writeFileSync.mockImplementation(() => {});
    });

    it("creates the dotfiles directory recursively", async () => {
      await setupCommand(DEFAULT_OPTIONS);
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(DOTFILES_DIR, {
        recursive: true,
      });
    });

    it("writes the example config to dot.yaml inside the dotfiles directory", async () => {
      await setupCommand(DEFAULT_OPTIONS);
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining("dot.yaml"),
        expect.stringContaining("dotfiles:"),
        "utf8"
      );
    });

    it("includes example entries in the written config", async () => {
      await setupCommand(DEFAULT_OPTIONS);
      const [, content] = mockFs.writeFileSync.mock.calls[0] as [string, string, string];
      expect(content).toContain(".zshrc");
    });

    it("does not call process.exit on success", async () => {
      await setupCommand(DEFAULT_OPTIONS);
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it("logs a success message", async () => {
      await setupCommand(DEFAULT_OPTIONS);
      expect(mockLogger.success).toHaveBeenCalled();
    });

    it("logs usage hints after writing", async () => {
      await setupCommand(DEFAULT_OPTIONS);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("dot install")
      );
    });
  });

  describe("directory already exists", () => {
    it("skips mkdirSync when the dotfiles directory already exists", async () => {
      // existsSync returns false for config path but true for the directory.
      mockFs.existsSync.mockImplementation((p) =>
        String(p) === DOTFILES_DIR
      );
      mockFs.writeFileSync.mockImplementation(() => {});

      await setupCommand(DEFAULT_OPTIONS);

      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe("~ expansion", () => {
    it("resolves the tilde-prefixed dir before writing", async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => undefined);
      mockFs.writeFileSync.mockImplementation(() => {});

      await setupCommand({ ...DEFAULT_OPTIONS, dir: "~/.dotfiles" });

      // The path passed to writeFileSync must be absolute (no leading ~).
      const writtenPath = (mockFs.writeFileSync.mock.calls[0] as [string, string, string])[0];
      expect(writtenPath).not.toContain("~");
    });
  });
});
