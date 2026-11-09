# Technical check

Example 1 (explaining behavior)

Before:

> Without --traceparent, TraceParent is null, so StartFromTraceParent returns null and no span is started. Worker skips the "continuing trace" log line and the run goes ahead normally, just untraced. An empty value, the literal "null" that EventBridge sends when the field is missing, and a malformed value all behave the same way. This is covered by AppArgumentsFactoryTests and TraceContinuationTests. I also ran it locally without the flag, and it goes straight from Worker: starting with args… to the job. Locally there's no collector, so the compose files set OTEL_SDK_DISABLED=true.

After:

> Nothing breaks, it just runs untraced, because without the flag no trace gets started and the job carries on as normal.

Example 2 (diagnosis and recommendation)

Before:

> The 502s are from the ALB health check failing: the target group probes /health on 8080, but the container binds 127.0.0.1 only, so the probe gets a connection reset and the task is deregistered every ~90s. Bind to 0.0.0.0 (HOST env var) and the checks pass. Verified in staging; prod needs a task definition revision and a rolling deploy.

After:

> The app is only listening to itself, so the load balancer can't reach it and keeps marking it unhealthy. Change its host setting to listen on all addresses and redeploy; I confirmed this fixes it in staging.
