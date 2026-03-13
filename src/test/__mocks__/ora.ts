/**
 * CJS-compatible ora mock.
 * Each `ora(text)` call returns a fresh spinner-like object whose
 * lifecycle methods are jest spies.
 */
type SpinnerMock = {
  succeed: jest.Mock;
  fail: jest.Mock;
  stop: jest.Mock;
  start: jest.Mock;
};

const ora = jest.fn((_text: string): SpinnerMock => {
  const spinner: SpinnerMock = {
    succeed: jest.fn(),
    fail: jest.fn(),
    stop: jest.fn(),
    start: jest.fn(function (this: SpinnerMock) {
      return this;
    }),
  };
  return spinner;
});

export default ora;
