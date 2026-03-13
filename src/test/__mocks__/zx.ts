/**
 * CJS-compatible zx mock.
 * `$` is mocked as a tagged-template-literal-compatible jest function that
 * resolves to a minimal ProcessOutput-like object.
 */
export const $ = jest.fn(
  async (_strings: TemplateStringsArray, ..._values: unknown[]) => ({
    stdout: "",
    stderr: "",
    exitCode: 0,
  })
);
