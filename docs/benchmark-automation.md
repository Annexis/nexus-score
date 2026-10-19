# Benchmark dashboard automation

The **Update Leaderboard** GitHub Actions workflow runs on the 1st and 15th of
each month at 06:00 UTC and can also be run manually. It fetches Crossref member
coverage, generates both benchmark snapshots, commits them to the default
branch, triggers a production deployment, and waits for the public dashboard.
The job succeeds only when both Overall and Current API responses match the
committed snapshot timestamps and publisher counts.

The dashboard reads JSON files bundled into its Vercel deployment. A successful
data commit does not update those deployed files by itself. The workflow uses an
explicit [Vercel Deploy Hook](https://vercel.com/docs/deploy-hooks) rather than
depending on the Git integration noticing the bot's commit.

## Configuration

1. In the production Vercel project (`nexus-score`, root `apps/web`), confirm that
   Settings → Git points to the current repository, `Annexis/nexus-score`, with
   production branch `main`. Recheck this connection after repository transfers.
2. Create a Deploy Hook named **Benchmark dashboard** for `main`.
3. Store its URL in the repository Actions secret **VERCEL_DEPLOY_HOOK**. Treat
   this URL as a credential; do not commit it or paste it into logs.
4. Optionally set the repository Actions variable **BENCHMARK_DASHBOARD_URL**.
   The default is `https://www.nexus-index.com`. This must be the public production
   domain, not a protected preview URL.

No Vercel account token is needed in GitHub Actions. Runs are serialized, and
manual runs from a branch other than the default branch are skipped.

## Retry and verification

If generation or push fails, deployment does not start. If deployment fails or
production remains stale for ten minutes, the job fails instead of reporting a
successful refresh. Inspect the Vercel deployment and the final API probe output.

To publish an already generated snapshot, manually run **Update Leaderboard**
from `main` with **refresh_data** disabled. This redeploys the committed data
without fetching Crossref again. Leaving it enabled performs the full refresh.
Rerunning a failed deployment is safe even when the data is already committed.

The successful run summary links to the dashboard and records each verified
snapshot timestamp and publisher count.

Run the deployment checks locally with:

```sh
node --test apps/web/scripts/deploy-benchmark.test.mjs
```
