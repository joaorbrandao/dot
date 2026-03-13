/**
 * CJS-compatible chalk mock.
 * Returns strings unchanged so that logger output can be matched without ANSI codes.
 */
const bold = Object.assign((s: string) => s, {
  underline: (s: string) => s,
});

const chalk = {
  green: (s: string) => s,
  red: (s: string) => s,
  blue: (s: string) => s,
  yellow: (s: string) => s,
  dim: (s: string) => s,
  bold,
};

export default chalk;
