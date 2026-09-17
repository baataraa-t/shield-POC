# Plan: E2E tests against Vercel preview deployments

Run the Playwright suite automatically against the preview URL of every pull request, and surface the result as a status check.

We already have the pieces: Playwright is configured in [playwright.config.ts](../playwright.config.ts) with one smoke spec in [e2e/tests/](../e2e/tests/), and Vercel builds a preview for every PR ([vercel.json](../vercel.json) disables deployments on `main` only). What's missing is the CI job that connects them.

## Why not read the Vercel PR comment

The obvious approach — wait for the Vercel bot's comment and parse the preview URL out of it — is the wrong one. The comment body is not a contract, it changes, and it appears while the build is still running, so a job that reads it races the deployment.

Vercel's GitHub integration already creates a **GitHub Deployment** for each preview and fires a `deployment_status` event when the build finishes. The preview URL arrives as structured data in `github.event.deployment_status.target_url`, and the event fires exactly once, at the right moment. That is the trigger.

## This assumes the Vercel Git integration, which is what we use

`deployment_status` only fires if Vercel is connected to the repo through its GitHub App. Projects deployed with the `vercel` CLI from a workflow do not produce GitHub Deployments, and this plan would not apply to them.

We are on the Git integration. The `git.deploymentEnabled` key in [vercel.json](../vercel.json) is only read by that integration, there is no `vercel` CLI dependency, and no workflow deploys the app — [pull-request.yml](../.github/workflows/pull-request.yml) only runs a build.

To confirm at any point: open a recent PR and look for a **View deployment** button or a Deployments section in the merge box, or check that `/repos/motforex/frontend-motforex-dashboard/deployments` returns a non-empty array.

The one setting that disables this is Vercel → Project → Settings → Git → **GitHub Deployments**. Some teams switch it off to declutter the PR UI; doing so suppresses the event this plan depends on. If it ever needs to stay off, the fallback is polling the Vercel API for the deployment matching the head SHA — slower, needs a Vercel token, and has to handle the still-building state itself.

## The three problems to solve

**1. Knowing when the preview is ready, and where.** Solved by the `deployment_status` trigger above. Gate the job on `state == 'success'` and an environment name that does not contain `Production`, so it runs on previews only — Vercel names it `Preview`, or `Preview - <project>` when several projects share a repo.

**2. Pointing Playwright at a remote URL instead of localhost.** Already handled. `playwright.config.ts` reads `BASE_URL` and — importantly — skips the `webServer` block entirely when it is set, so CI tests the deployed preview rather than booting `next dev` in the runner. Setting `BASE_URL` from `target_url` is the whole integration.

**3. Getting past Deployment Protection.** Preview deployments default to _Vercel Authentication_, which returns a 401 SSO interstitial to any unauthenticated client. Without a bypass, every navigation in every spec fails. Vercel's supported escape hatch is the `x-vercel-protection-bypass` header carrying a per-project automation secret.

## Changes

| File                                | Change                                                                                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.github/workflows/e2e-preview.yml` | New workflow: triggers on `deployment_status`, checks out `github.event.deployment.ref`, sets `BASE_URL` from `target_url`, runs `playwright test`, uploads the HTML report as an artifact |
| `playwright.config.ts`              | Send `x-vercel-protection-bypass` / `x-vercel-set-bypass-cookie` via `extraHTTPHeaders` when `VERCEL_AUTOMATION_BYPASS_SECRET` is present                                                  |

The config change is opt-in: with no env var set, `extraHTTPHeaders` is empty and local runs behave exactly as before.

The workflow checks out the PR's commit rather than the default branch, so the specs that run match the code that was deployed.

## Implementation

Work through these in order. Steps 1-3 de-risk the parts that cannot be tested from a pull request, which matters because of the default-branch constraint below.

### Step 1 — Generate the Vercel bypass secret

- [ ] Vercel dashboard → the project → **Settings** → **Deployment Protection**
- [ ] Find **Protection Bypass for Automation** → **Add Secret** (Vercel generates a 32-character value)
- [ ] Copy it and **Save** — the page will not show it again in full
- [ ] While on this page, note whether **Vercel Authentication** is on for Preview. If it is off, the secret is unnecessary but harmless to configure anyway; leave the plan as-is so it keeps working when protection is turned on later.

### Step 2 — Prove the tests pass against a real preview, locally

This is the highest-value step. It validates the bypass secret, the `BASE_URL` plumbing, and the specs themselves, all before any CI is involved — so that when CI finally runs, a failure means the workflow is wrong, not the tests.

- [ ] Open any open PR and copy its Vercel preview URL
- [ ] Run the suite against it:

```bash
BASE_URL=https://<preview>.vercel.app \
VERCEL_AUTOMATION_BYPASS_SECRET=<secret from step 1> \
bunx playwright test
```

- [ ] Confirm it passes. If you get a 401 or a login interstitial, the secret is wrong or was not saved — go back to step 1, do not proceed.
- [ ] Sanity-check that the secret is doing something by rerunning **without** `VERCEL_AUTOMATION_BYPASS_SECRET`. It should fail. If it passes either way, preview protection is off, and step 1 is not currently load-bearing.

### Step 3 — Add the secret to GitHub

- [ ] Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
- [ ] Name it exactly `VERCEL_AUTOMATION_BYPASS_SECRET` — the workflow reads this name and a typo fails silently as an empty string
- [ ] Paste the step 1 value → **Add secret**

### Step 4 — Open the PR

- [ ] Branch off `main`, commit the two files:
      `.github/workflows/e2e-preview.yml` and `playwright.config.ts`
- [ ] Open the PR. **The E2E job will not run on it** — see the constraint below. This is expected, not a bug, and is worth saying in the PR description so a reviewer does not wait for a check that cannot appear.
- [ ] Review focus: the `if:` gate, the secret name, and that `permissions:` stays minimal

### Step 5 — Merge to `main`

- [ ] Merge. The workflow is only live from this point.

### Step 6 — Verify on a throwaway PR

- [ ] Branch off `main`, make a trivial change (a comment in a README is enough), open a PR
- [ ] Wait for Vercel to finish building the preview
- [ ] **Actions** tab → confirm an **E2E on Vercel Preview** run appears within a minute of the preview going live
- [ ] Open the run → the **Show target** step → check `Preview URL` — it must be the preview URL, not `localhost:3000`. If it is localhost, `target_url` did not arrive and the job is testing a server it booted itself, which would pass while proving nothing. The same step prints `Bypass secret configured: yes` — a blank there means step 3 did not take.
- [ ] Confirm the job passes and the `playwright-report` artifact uploads
- [ ] Close the throwaway PR

If no run appears at all, work through this in order: was the workflow merged to `main`; did Vercel actually deploy a preview; is **GitHub Deployments** still enabled in Vercel's Git settings; does the environment name contain `Production` and so trip the `if:` gate.

### Step 7 — Make it required (after a soak period)

- [ ] Let it run on real PRs for roughly a week and watch for flakes
- [ ] Repo → **Settings** → **Branches** → branch protection rule for `main`
- [ ] **Require status checks to pass** → add **E2E on Vercel Preview**
- [ ] Re-read the fork caveat below before ticking this — it is the step that can block PRs

### Rollback

Delete `.github/workflows/e2e-preview.yml` from `main`, and remove the required check first if step 7 is done. The `playwright.config.ts` change is inert without the env var and can stay.

## Constraints worth knowing before this lands

**The workflow only runs from the default branch.** `deployment_status` is not a `pull_request` event, so GitHub runs the copy of the workflow file that exists on `main`, ignoring the version in the PR branch. Nothing will happen until it is merged. This is the most common reason this setup appears to silently do nothing, and it also means workflow changes cannot be tested in the PR that makes them — verify on a throwaway PR after merging.

**No preview means no check, not a failed check.** If Vercel does not deploy — a fork PR, a skipped build, a Vercel outage — the event never fires and the job simply never appears. That is fine as an advisory check, but once it is _required_, those PRs block indefinitely. Decide deliberately at step 5; if the repo takes fork contributions, consider leaving it advisory.

**The PR controls the specs.** The workflow comes from `main`, but the tests come from the PR ref, so a PR can change what runs. Same trust model as any `pull_request` workflow — just don't put deployment credentials in this job.

## Scope

One smoke spec today. The value of this plan is the pipeline, not the coverage — it is worth landing before the suite grows, so that new specs are enforced from the day they are written. Authenticated flows need a seeded test account and are deliberately out of scope here; they can be layered on once the pipeline is trusted.

## Alternative considered

Building and serving the app inside the runner (`playwright test` with the existing `webServer` block, no `BASE_URL`) avoids Vercel entirely and works on forks. Rejected: it duplicates a build we are already paying Vercel for, adds several minutes to every PR, and tests an environment that is not the one we ship. Testing the actual preview also catches deployment-level breakage — bad env vars, proxy/middleware behaviour, edge config — that a local server cannot.

## Cypress

If we ever switch runners, only the test-execution step changes. The trigger, the URL plumbing, and the bypass secret are framework-independent. There is no reason to run both.
