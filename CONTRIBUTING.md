# Contributor License Agreement

By submitting a pull request to this project, you agree to license your contribution under the terms of the MIT License.

Please make sure that you have the right to license the code under the MIT License and that your contributions do not infringe on the rights of others.

# Using Git

We use GitHub to host code, track issues, and accept pull requests.

## Git Branching

**We build and release from the `main` branch, so code merged here should always be stable.**

Prefer short-lived feature branches.
- Piecemeal progress towards broad code changes should merge to long-running branches until
  everything there is stable and deployable, at which point the long-running branch gets merged
  to `main`.
- Since short, coherent patches are easier to review, we code-review the individual PRs into
  the long-running feature branch (instead of review when merging the long-running branch to
  `main`)

## Committing code

Multiple commits or PRs can be created for an Issue. e.g. each implementation step might get its own PR.

Code review is not required, but is encouraged as a powerful tool for learning.  Benefits include:
- Spread knowledge of the code base throughout the team.
- Expose everyone to different approaches.
- Ensure code is readable (and therefore maintainable).
- Yield better software (but ultimately the responsibility
  for bug-free code is on the code author, not the reviewer).

Code review is not limited to approval/rejection of PRs. Also consider involving a collaborator
earlier in the process, before the code is finished.  Ask them for a narrower review—e.g., a
design review or to focus on a specific part of the code change.

Merging branches and PRs to `main`:
- Code should be merged by the branch author, unless a merge is urgently needed.
- Merge PRs via 'Squash and Merge' option in GitHub.
- Delete a branch when you are done with it.
