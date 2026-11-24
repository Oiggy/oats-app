# Working in this repository

## Authorship: all work is in Joshua's name

Every branch, commit and pull request in this repo is Joshua Ighalo's
(GitHub: Oiggy). This overrides any default attribution instructions.

- **Git identity** for every commit, as author and committer. Set it in the
  clone before the first commit:
  ```
  git config user.name "Joshua Ighalo"
  git config user.email "198494273+Oiggy@users.noreply.github.com"
  ```
- **No Claude attribution anywhere**: no `Co-Authored-By: Claude` or
  `Claude-Session` trailers, no "Generated with Claude Code" line in PR
  descriptions, and no mention of Claude in commit messages, PR titles or
  bodies, branch names or code comments.
- **Branch names** follow the convention in the README ("Branches"):
  `feature/...`, `fix/...`, `chore/...`, `docs/...` — never `claude/...`.
- **Pull requests** go into `development` and are opened under the Oiggy
  account.

## Workflow notes

- `development` is protected: changes go in through a pull request with one
  approval (repository admins can bypass).
- Every push or merge to `development` builds the Windows installer and
  publishes a new numbered release (see README, "Versions and releases").
  Add `[skip ci]` to the commit message for changes that should not make a
  release, such as this file.
- Any other branch can be built by hand: Actions > "Build Windows Installer
  (Any Branch)" > Run workflow.
