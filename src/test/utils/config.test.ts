import path from "path";
import os from "os";
import fs from "fs";
import yaml from "js-yaml";

import { readConfig, writeConfig, CONFIG_FILENAME } from "../../utils/config.js";

jest.mock("fs");
jest.mock("js-yaml");

const mockFs = fs as jest.Mocked<typeof fs>;
const mockYaml = yaml as jest.Mocked<typeof yaml>;

const REPO_DIR = "/fake/repo";
const PRIMARY_PATH = path.join(REPO_DIR, CONFIG_FILENAME);
const FALLBACK_PATH = path.join(os.homedir(), ".dotfiles", CONFIG_FILENAME);

const VALID_CONFIG = { dotfiles: [{ source: ".zshrc", target: "~/.zshrc" }] };

describe("readConfig()", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("reads from the primary path when it exists", () => {
    mockFs.existsSync.mockImplementation((p) => p === PRIMARY_PATH);
    mockFs.readFileSync.mockReturnValue("dotfiles:\n  - source: .zshrc\n    target: ~/.zshrc");
    mockYaml.load.mockReturnValue(VALID_CONFIG);

    const config = readConfig(REPO_DIR);

    expect(mockFs.readFileSync).toHaveBeenCalledWith(PRIMARY_PATH, "utf8");
    expect(config.dotfiles).toHaveLength(1);
    expect(config.dotfiles[0].source).toBe(".zshrc");
  });

  it("falls back to ~/.dotfiles/dot.yaml when primary path is absent", () => {
    mockFs.existsSync.mockImplementation((p) => p === FALLBACK_PATH);
    mockFs.readFileSync.mockReturnValue("dotfiles: []");
    mockYaml.load.mockReturnValue({ dotfiles: [] });

    const config = readConfig(REPO_DIR);

    expect(mockFs.readFileSync).toHaveBeenCalledWith(FALLBACK_PATH, "utf8");
    expect(config.dotfiles).toHaveLength(0);
  });

  it("throws a descriptive error when neither path exists", () => {
    mockFs.existsSync.mockReturnValue(false);

    expect(() => readConfig(REPO_DIR)).toThrow(
      `No ${CONFIG_FILENAME} found in ${REPO_DIR}`
    );
  });

  it("throws when YAML parsing fails", () => {
    mockFs.existsSync.mockImplementation((p) => p === PRIMARY_PATH);
    mockFs.readFileSync.mockReturnValue("bad: yaml: [[[");
    mockYaml.load.mockImplementation(() => {
      throw new Error("unexpected token");
    });

    expect(() => readConfig(REPO_DIR)).toThrow(`Failed to parse ${CONFIG_FILENAME}`);
  });

  it("throws when parsed value is null", () => {
    mockFs.existsSync.mockImplementation((p) => p === PRIMARY_PATH);
    mockFs.readFileSync.mockReturnValue("");
    mockYaml.load.mockReturnValue(null);

    expect(() => readConfig(REPO_DIR)).toThrow('must contain a top-level "dotfiles" array');
  });

  it("throws when parsed value has no dotfiles array", () => {
    mockFs.existsSync.mockImplementation((p) => p === PRIMARY_PATH);
    mockFs.readFileSync.mockReturnValue("foo: bar");
    mockYaml.load.mockReturnValue({ foo: "bar" });

    expect(() => readConfig(REPO_DIR)).toThrow('must contain a top-level "dotfiles" array');
  });

  it("throws when dotfiles is not an array", () => {
    mockFs.existsSync.mockImplementation((p) => p === PRIMARY_PATH);
    mockFs.readFileSync.mockReturnValue("dotfiles: string");
    mockYaml.load.mockReturnValue({ dotfiles: "string" });

    expect(() => readConfig(REPO_DIR)).toThrow('must contain a top-level "dotfiles" array');
  });
});

describe("writeConfig()", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("writes serialized YAML to the config file path", () => {
    const serialized = "dotfiles: []\n";
    mockYaml.dump.mockReturnValue(serialized);
    mockFs.writeFileSync.mockImplementation(() => {});

    writeConfig(REPO_DIR, { dotfiles: [] });

    expect(mockYaml.dump).toHaveBeenCalledWith({ dotfiles: [] }, { lineWidth: 120 });
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      path.join(REPO_DIR, CONFIG_FILENAME),
      serialized,
      "utf8"
    );
  });

  it("overwrites the file on every call", () => {
    mockYaml.dump.mockReturnValue("dotfiles: []\n");
    mockFs.writeFileSync.mockImplementation(() => {});

    writeConfig(REPO_DIR, { dotfiles: [] });
    writeConfig(REPO_DIR, { dotfiles: [] });

    expect(mockFs.writeFileSync).toHaveBeenCalledTimes(2);
  });
});
