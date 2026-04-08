# spark-counter

Per-edge view counter using the Spark KV store. Each edge node tracks its own
count: values are NOT replicated to other edges. If you hit `edge-sgp` 10
times and `edge-nyc` 3 times, you'll see `edge_views: 10` and `edge_views: 3`
respectively. Use Plasma if you want a global counter.

## What it demonstrates

- `Spark.get(key)` returning a `SparkEntry | null`
- `Spark.setString(key, value, ttl)` for string values
- TTL=0 meaning "never expire"
- Building a small JSON response by string concatenation

## Required capabilities

The flare config must enable Spark writes:

```json
{
  "writes_spark_kv": true
}
```

## Build

```bash
npm run example:spark-counter
```

Output: `examples/spark-counter/build/spark-counter.wasm`
