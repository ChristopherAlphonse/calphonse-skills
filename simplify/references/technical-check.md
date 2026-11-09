# Technical check

Example 1 (explaining behavior)

Before:

> Without --retries, RetryPolicy.maxAttempts is undefined, so withRetry() falls through to a single attempt and no backoff timer is created. HttpClient logs nothing extra and the request fails fast on the first error. An empty string, the literal "undefined" that the CI template writes when the variable is missing, and a non-numeric value all take the same path. This is covered by ConfigParserTests and RetryPolicyTests. I also ran it locally without the flag, and it goes straight from Client: sending request to the error. Locally there's no proxy, so the compose file sets NO_PROXY=*.

After:

> Nothing breaks, it just doesn't retry: without the flag, a failed request gives up on the first error instead of trying again.

Example 2 (diagnosis and recommendation)

Before:

> The 502s are from the ALB health check failing: the target group probes /health on 8080, but the container binds 127.0.0.1 only, so the probe gets a connection reset and the task is deregistered every ~90s. Bind to 0.0.0.0 (HOST env var) and the checks pass. Verified in staging; prod needs a task definition revision and a rolling deploy.

After:

> The app is only listening to itself, so the load balancer can't reach it and keeps marking it unhealthy. Change its host setting to listen on all addresses and redeploy; I confirmed this fixes it in staging.
