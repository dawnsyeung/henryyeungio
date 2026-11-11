# Website analytics

This site reports anonymous pageviews to the shared PostHog project. `posthog.js` is a prebuilt static deployment asset so existing GitHub Pages and Vercel deployments need no new build settings or environment variables. Its public project token is intentionally visible in the deployed browser bundle; it is not an administrative API key.

The maintained source is `scripts/posthog.template.js`. Configuration is read from environment variables by `scripts/build-posthog.mjs`, not hardcoded in that source. To change the destination, copy `.env.posthog.example` to `.env.posthog`, enter the public project token and HTTPS ingestion host from PostHog project settings, and run:

```sh
node --env-file=.env.posthog scripts/build-posthog.mjs
node --test tests/posthog.test.cjs
```

Commit the regenerated `posthog.js` to deploy through the existing publishing process. Use Node 20.6 or later for `--env-file`, or export the two variables before running the script. Never put a personal PostHog API key in these files.

## Collection limits

- Initial pageview and pathname changes only. No form values, clicks, page titles, user identity, logs, exceptions, performance data, surveys, or session replay.
- Query strings and URL fragments are removed. Referrers include their origin only.
- Anonymous state stays in page memory, with no analytics cookie or persistent visitor ID. Pageview counts work, but repeat-visitor and cross-page unique-user/session counts are intentionally limited.
- Localhost, local files, Do Not Track, and Global Privacy Control do not load the SDK.
- Existing PostHog instances are not initialized twice. Remote settings cannot enable the disabled capture features.

Review applicable privacy disclosures and consent requirements for the audience before expanding collection.

Verify a deployed page by checking its `posthog.js` asset and a `$pageview` event for its hostname in PostHog project 265151. Do not treat a successful source commit as proof that hosting deployed it.

Docs: https://posthog.com/docs/libraries/js and https://posthog.com/docs/privacy/data-collection
