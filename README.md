![logo](resources/logo_v1.png)

# dot

A TypeScript CLI tool to install and backup your dotfiles from a Git repository.

## Commands

| Command | Description |
|---|---|
| `dot install <repo-url>` | Clone a dotfiles repo and install its contents onto the system |
| `dot install --local <path>` | Install from an existing local repository (no clone/pull) |
| `dot backup` | Copy system dotfiles back into the local repo and commit |

---

## Getting Started

### 1. Install the CLI

```bash
npm install -g @joaobrandao/dot
```

### 2. Install your dotfiles

```bash
# From a remote repository
dot install https://github.com/you/dotfiles.git

# Or from an existing local repository
dot install --local ~/projects/dotfiles
```

This clones (or uses) the repository, creates a default `dot.yaml` if one doesn't exist, installs declared packages, and symlinks each dotfile to its target location. The repository path is saved to `~/.dot/config.yaml` so other commands know where to find it.

### 3. Edit `dot.yaml`

Open the `dot.yaml` in your dotfiles repository and declare your dotfiles and packages:

```yaml
dotfiles:
  - source: .zshrc
    target: ~/.zshrc

  - source: .gitconfig
    target: ~/.gitconfig

  - source: .config/nvim
    target: ~/.config/nvim

packages:
  brew:
    - neovim
    - zsh
    - starship
  npm:
    - typescript
```

### 4. Backup your dotfiles

```bash
dot backup
dot backup --message "add nvim config"
dot backup --no-push
```

---

## Command Reference

### `dot install [repo-url] [options]`

Clones (or pulls) a dotfiles repository, installs declared packages, then symlinks (or copies) each dotfile to its target on the system. If the repository does not contain a `dot.yaml`, a default one is created. The repository path is saved to `~/.dot/config.yaml`.

Provide either a `<repo-url>` argument **or** the `--local <path>` option — at least one is required.

| Option | Default | Description |
|---|---|---|
| `-d, --dir <path>` | `~/.dotfiles` | Local directory to clone the repo into |
| `-l, --local <path>` | — | Use an existing local repository at this path (skips clone/pull) |
| `-c, --copy` | `false` | Copy files instead of creating symlinks |
| `--skip-packages` | `false` | Skip package manager installation |

```bash
# Remote repository
dot install https://github.com/you/dotfiles.git
dot install https://github.com/you/dotfiles.git --copy
dot install https://github.com/you/dotfiles.git --skip-packages
dot install https://github.com/you/dotfiles.git --dir ~/my-dots

# Existing local repository (no network required)
dot install --local ~/projects/dotfiles
dot install --local ~/projects/dotfiles --copy
dot install --local ~/projects/dotfiles --skip-packages
```

**Conflict behaviour:** if a file or symlink already exists at a target path it is removed and replaced. Directories are recreated automatically.

---

### `dot backup [options]`

Copies each system dotfile back into the local repository at its declared `source` path, then commits and pushes the changes. The repository path is read from `~/.dot/config.yaml` (written by `dot install`).

| Option | Default | Description |
|---|---|---|
| `-m, --message <msg>` | `backup: YYYY-MM-DD` | Git commit message |
| `--no-push` | `false` | Commit locally without pushing |

```bash
dot backup
dot backup --message "add nvim config"
dot backup --no-push
```

---

## `dot.yaml` Reference

```yaml
dotfiles:
  - source: <path-in-repo>   # relative to repo root
    target: <system-path>    # ~ is expanded to $HOME

packages:
  brew:   [neovim, zsh]      # macOS — Homebrew
  npm:    [typescript]       # npm global install
  pip:    [black]            # pip install
  apt:    [neovim, zsh]      # Debian/Ubuntu — apt-get
```

---

## Development

```bash
npm install        # install dependencies
npm run build      # compile TypeScript → dist/
npm run dev        # run via ts-node (no build required)
npm test           # run Jest test suite
npm run clean      # remove dist/
```

## Project Structure

```
src/
├── index.ts               # CLI entry point (Commander)
├── types/
│   └── index.ts           # Zod schemas and TypeScript types
├── commands/
│   ├── install.ts         # install command
│   └── backup.ts          # backup command
└── utils/
    ├── config.ts          # Read/write dot.yaml and ~/.dot/config.yaml
    ├── files.ts           # Symlink/copy helpers, home expansion
    ├── git.ts             # Clone, pull, commit, push (simple-git)
    ├── packages.ts        # brew / npm / pip / apt installers (zx)
    └── logger.ts          # Terminal output (chalk + ora)
```
