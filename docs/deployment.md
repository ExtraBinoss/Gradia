# Deployment

Gradia is a static Cloudflare Worker named `gradia`, attached to `gradia.plinka.eu`. `wrangler.jsonc` is the single deployment target. `bun run build` prepares all assets and the library before deployment.

## GitHub Actions

`.github/workflows/deploy.yml` validates pull requests without Cloudflare credentials. The production deployment job runs only for `ExtraBinoss/Gradia`, on `main`, when both `github.actor` and `github.triggering_actor` are `ExtraBinoss`. No `pull_request_target` event is used.

The validation job installs locked dependencies and runs checks and a production build. The deployment job downloads that exact build artifact. It uploads a new Worker version and deploys it at 100%, preserving the existing Custom Domain without zone-wide route updates; the Cloudflare token is injected only into the Wrangler step. A `production` environment and branch policy restrict the production target to `main`. Action versions are pinned by commit SHA.

Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. Do not use a frontend `VITE_` variable for either. The account-owned `gradia-github-actions` token has only **Individual Workers Editor** for the existing `gradia` Worker. It cannot create/delete Workers, change zone routes, or deploy other projects. Access to Gradia deployments was verified; access to the Plinka Worker was rejected. The production environment permits only `main`.

For local deployment with an authenticated Wrangler session:

```sh
bun run build
bun run deploy:check
bun run deploy
```

The initial custom domain must be created using credentials that can manage that zone. Repeated deploys should use the smallest supported token permissions. See the official [Workers permissions](https://developers.cloudflare.com/workers/authorization/workers/) and [static asset deployment](https://developers.cloudflare.com/workers/static-assets/) documentation.
