import * as logger from "../../utils/logger.js";

describe("logger", () => {
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── success ──────────────────────────────────────────────────────────────

  describe("success()", () => {
    it("writes to console.log", () => {
      logger.success("all good");
      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it("includes the message in the output", () => {
      logger.success("everything passed");
      expect(logSpy.mock.calls[0][0]).toContain("everything passed");
    });
  });

  // ── error ─────────────────────────────────────────────────────────────────

  describe("error()", () => {
    it("writes to console.error", () => {
      logger.error("something failed");
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    it("includes the message in the output", () => {
      logger.error("bad things happened");
      expect(errorSpy.mock.calls[0][0]).toContain("bad things happened");
    });

    it("appends the underlying Error message when provided", () => {
      logger.error("top-level error", new Error("root cause"));
      expect(errorSpy.mock.calls[0][0]).toContain("root cause");
    });

    it("handles non-Error err values gracefully", () => {
      expect(() => logger.error("msg", "a string error")).not.toThrow();
    });
  });

  // ── info ──────────────────────────────────────────────────────────────────

  describe("info()", () => {
    it("writes to console.log", () => {
      logger.info("some info");
      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it("includes the message in the output", () => {
      logger.info("informational text");
      expect(logSpy.mock.calls[0][0]).toContain("informational text");
    });
  });

  // ── warn ──────────────────────────────────────────────────────────────────

  describe("warn()", () => {
    it("writes to console.log", () => {
      logger.warn("a warning");
      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it("includes the message in the output", () => {
      logger.warn("be careful");
      expect(logSpy.mock.calls[0][0]).toContain("be careful");
    });
  });

  // ── section ───────────────────────────────────────────────────────────────

  describe("section()", () => {
    it("writes to console.log", () => {
      logger.section("My Step");
      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it("includes the section title in the output", () => {
      logger.section("Installing dotfiles");
      expect(logSpy.mock.calls[0][0]).toContain("Installing dotfiles");
    });
  });

  // ── spinner ───────────────────────────────────────────────────────────────

  describe("spinner()", () => {
    it("returns an object with succeed and fail methods", () => {
      const spin = logger.spinner("loading…");
      expect(typeof spin.succeed).toBe("function");
      expect(typeof spin.fail).toBe("function");
    });

    it("returns an object with a stop method", () => {
      const spin = logger.spinner("loading…");
      expect(typeof spin.stop).toBe("function");
    });
  });
});
