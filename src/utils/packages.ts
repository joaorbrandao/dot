import { $ } from "zx";
import { PackageMap } from "../types/index.js";
import * as logger from "./logger.js";

/**
 * Installs all packages declared in a `PackageMap` using the appropriate
 * package manager for each key.  Supported managers: `brew`, `npm`, `pip`, `apt`.
 * Unknown managers are warned about and skipped.
 *
 * @param packages - The package map from `dot.yaml`.
 */
export async function installPackages(packages: PackageMap): Promise<void> {
  for (const [manager, pkgList] of Object.entries(packages)) {
    if (!pkgList || pkgList.length === 0) continue;

    logger.section(`Installing packages via ${manager}`);

    switch (manager) {
      case "brew":
        await installWithBrew(pkgList);
        break;
      case "npm":
        await installWithNpm(pkgList);
        break;
      case "pip":
        await installWithPip(pkgList);
        break;
      case "apt":
        await installWithApt(pkgList);
        break;
      default:
        logger.warn(`Unknown package manager "${manager}" — skipping.`);
    }
  }
}

/**
 * Installs a list of packages using Homebrew (`brew install`).
 * Already-installed formulae are silently skipped by Homebrew itself.
 *
 * @param packages - Package names to install.
 */
async function installWithBrew(packages: string[]): Promise<void> {
  // `brew install` accepts multiple package names in one call.
  await $`brew install ${packages}`;
}

/**
 * Installs a list of packages globally using npm (`npm install -g`).
 *
 * @param packages - Package names to install.
 */
async function installWithNpm(packages: string[]): Promise<void> {
  await $`npm install -g ${packages}`;
}

/**
 * Installs a list of packages using pip (`pip install`).
 *
 * @param packages - Package names to install.
 */
async function installWithPip(packages: string[]): Promise<void> {
  await $`pip install ${packages}`;
}

/**
 * Installs a list of packages using apt (`apt-get install -y`).
 * Intended for Debian/Ubuntu systems; requires sudo privileges at runtime.
 *
 * @param packages - Package names to install.
 */
async function installWithApt(packages: string[]): Promise<void> {
  await $`sudo apt-get install -y ${packages}`;
}
