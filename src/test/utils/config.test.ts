import path from "path";
import os from "os";
import fs from "fs";
import yaml from "js-yaml";

import {
  readConfig,
  writeConfig,
  writeDefaultConfig,
  readAppConfig,
  writeAppConfig,
  CONFIG_FILENAME,
  EXAMPLE_CONFIG,
  APP_CONFIG_DIR,
  APP_CONFIG_PATH,
} from "../../utils/config.js";

jest.mock("fs");
jest.mock("js-yaml");

const mockFs = fs as jest.Mocked<typeof fs>;
const mockYaml = yaml as jest.Mocked<typeof yaml>;

const REPO_DIR = "/fake/repo";
const PRIMARY_PATH = path.join(REPO_DIR, CONFIG_FILENAME);

const VALID_CONFIG = { dotfiles: [{ source: ".zshrc", target: "~/.zshrc" }] };

describe("readConfig()", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("reads from the repo directory", () => {
    mockFs.existsSync.mockImplementation((p) => p === PRIMARY_PATH);
    mockFs.readFileSync.mockReturnValue("dotfiles:\n  - source: .zshrc\n    target: ~/.zshrc");
    mockYaml.load.mockReturnValue(VALID_CONFIG);

    const config = readConfig(REPO_DIR);

    expect(mockFs.readFileSync).toHaveBeenCalledWith(PRIMARY_PATH, "utf8");
    expect(config.dotfiles).toHaveLength(1);
    expect(config.dotfiles[0].source).toBe(".zshrc");
  });

  it("throws when dot.yaml is not found in repo", () => {
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

describe("readAppConfig()", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("reads and returns valid app config", () => {
    const appConfig = { repository: { localPath: "/home/user/dotfiles" } };
    mockFs.existsSync.mockImplementation((p) => p === APP_CONFIG_PATH);
    mockFs.readFileSync.mockReturnValue("repository:\n  localPath: /home/user/dotfiles");
    mockYaml.load.mockReturnValue(appConfig);

    const result = readAppConfig();

    expect(mockFs.readFileSync).toHaveBeenCalledWith(APP_CONFIG_PATH, "utf8");
    expect(result.repository.localPath).toBe("/home/user/dotfiles");
  });

  it("throws when config file does not exist", () => {
    mockFs.existsSync.mockReturnValue(false);

    expect(() => readAppConfig()).toThrow(`No config found at ${APP_CONFIG_PATH}`);
  });

  it("throws when repository.localPath is missing", () => {
    mockFs.existsSync.mockImplementation((p) => p === APP_CONFIG_PATH);
    mockFs.readFileSync.mockReturnValue("repository: {}");
    mockYaml.load.mockReturnValue({ repository: {} });

    expect(() => readAppConfig()).toThrow("must contain repository.localPath");
  });

  it("throws on invalid YAML", () => {
    mockFs.existsSync.mockImplementation((p) => p === APP_CONFIG_PATH);
    mockFs.readFileSync.mockReturnValue("bad yaml");
    mockYaml.load.mockImplementation(() => {
      throw new Error("parse error");
    });

    expect(() => readAppConfig()).toThrow(`Failed to parse ${APP_CONFIG_PATH}`);
  });
});

describe("writeAppConfig()", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("creates ~/.dot/ directory if it does not exist", () => {
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockImplementation(() => undefined as any);
    mockFs.writeFileSync.mockImplementation(() => {});
    mockYaml.dump.mockReturnValue("repository:\n  localPath: /foo\n");

    writeAppConfig({ repository: { localPath: "/foo" } });

    expect(mockFs.mkdirSync).toHaveBeenCalledWith(APP_CONFIG_DIR, { recursive: true });
  });

  it("writes YAML content to ~/.dot/config.yaml", () => {
    const serialized = "repository:\n  localPath: /foo\n";
    mockFs.existsSync.mockReturnValue(true);
    mockFs.writeFileSync.mockImplementation(() => {});
    mockYaml.dump.mockReturnValue(serialized);

    writeAppConfig({ repository: { localPath: "/foo" } });

    expect(mockFs.writeFileSync).toHaveBeenCalledWith(APP_CONFIG_PATH, serialized, "utf8");
  });

  it("does not create directory if it already exists", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.writeFileSync.mockImplementation(() => {});
    mockYaml.dump.mockReturnValue("y");

    writeAppConfig({ repository: { localPath: "/foo" } });

    expect(mockFs.mkdirSync).not.toHaveBeenCalled();
  });
});

describe("writeDefaultConfig()", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("writes the EXAMPLE_CONFIG template to dot.yaml", () => {
    mockFs.writeFileSync.mockImplementation(() => {});

    writeDefaultConfig(REPO_DIR);

    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      path.join(REPO_DIR, CONFIG_FILENAME),
      EXAMPLE_CONFIG,
      "utf8"
    );
  });

  it("does not use yaml.dump", () => {
    mockFs.writeFileSync.mockImplementation(() => {});

    writeDefaultConfig(REPO_DIR);

    expect(mockYaml.dump).not.toHaveBeenCalled();
  });
});
