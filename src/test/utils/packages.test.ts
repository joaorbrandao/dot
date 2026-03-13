import { installPackages } from "../../utils/packages.js";
import { $ } from "zx";
import * as logger from "../../utils/logger.js";

// `$` is redirected to src/test/__mocks__/zx.ts via moduleNameMapper.
// `logger` is mocked so section / warn calls can be asserted on.
jest.mock("../../utils/logger.js");

const mock$ = $ as jest.MockedFunction<typeof $>;
const mockLogger = logger as jest.Mocked<typeof logger>;

beforeEach(() => {
  jest.resetAllMocks();
});

describe("installPackages()", () => {
  // ── package managers that delegate to $ ────────────────────────────────────

  it("installs brew packages with a single $ call", async () => {
    await installPackages({ brew: ["neovim", "starship"] });
    expect(mock$).toHaveBeenCalledTimes(1);
  });

  it("installs npm packages with a single $ call", async () => {
    await installPackages({ npm: ["typescript"] });
    expect(mock$).toHaveBeenCalledTimes(1);
  });

  it("installs pip packages with a single $ call", async () => {
    await installPackages({ pip: ["requests"] });
    expect(mock$).toHaveBeenCalledTimes(1);
  });

  it("installs apt packages with a single $ call", async () => {
    await installPackages({ apt: ["curl", "git"] });
    expect(mock$).toHaveBeenCalledTimes(1);
  });

  it("makes one $ call per supported package manager", async () => {
    await installPackages({ brew: ["neovim"], npm: ["typescript"] });
    expect(mock$).toHaveBeenCalledTimes(2);
  });

  // ── unknown managers ───────────────────────────────────────────────────────

  it("warns and skips unknown package managers without calling $", async () => {
    await installPackages({ snap: ["vlc"] } as any);
    expect(mock$).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("snap")
    );
  });

  // ── empty / undefined lists ────────────────────────────────────────────────

  it("skips managers with empty package lists", async () => {
    await installPackages({ brew: [] });
    expect(mock$).not.toHaveBeenCalled();
  });

  it("skips managers with undefined package lists", async () => {
    await installPackages({ brew: undefined });
    expect(mock$).not.toHaveBeenCalled();
  });

  it("does nothing when the PackageMap is empty", async () => {
    await installPackages({});
    expect(mock$).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });
});
