import chalk from "chalk";
import ora, { Ora } from "ora";

/**
 * Prints a success message to stdout with a green checkmark prefix.
 *
 * @param message - The message to display.
 */
export function success(message: string): void {
  console.log(chalk.green("✔ ") + message);
}

/**
 * Prints an error message to stderr with a red cross prefix.
 *
 * @param message - The message to display.
 * @param err     - Optional underlying error whose message is appended.
 */
export function error(message: string, err?: unknown): void {
  const detail =
    err instanceof Error ? chalk.dim(` (${err.message})`) : "";
  console.error(chalk.red("✖ ") + message + detail);
}

/**
 * Prints an informational message to stdout with a blue info prefix.
 *
 * @param message - The message to display.
 */
export function info(message: string): void {
  console.log(chalk.blue("ℹ ") + message);
}

/**
 * Prints a warning message to stdout with a yellow warning prefix.
 *
 * @param message - The message to display.
 */
export function warn(message: string): void {
  console.log(chalk.yellow("⚠ ") + message);
}

/**
 * Prints a section header with a bold underlined style to visually separate
 * logical stages of a command run.
 *
 * @param title - The section title to display.
 */
export function section(title: string): void {
  console.log("\n" + chalk.bold.underline(title));
}

/**
 * Creates and starts an `ora` spinner with the provided text.
 * Use the returned spinner instance to call `.succeed()`, `.fail()`, or `.stop()`.
 *
 * @param text - The loading text displayed next to the spinner.
 * @returns The running `Ora` spinner instance.
 */
export function spinner(text: string): Ora {
  return ora(text).start();
}
