# Apache OpenWhisk Redis Event Provider

This is an Apache OpenWhisk trigger feed for [Redis](https://redis.io). It uses the "[Pluggable OpenWhisk Event Provider](https://github.com/apache/incubator-openwhisk-pluggable-provider)" to handle registering trigger feeds, listening to Redis events and firing user triggers.

This event provider plugin supports listening to events from Redis' both the [Pub/Sub](Pub/Sub) and [Streams](https://redis.io/topics/streams-intro) features of the database. All incoming messages are fired as trigger events. Messages are processed one at a time, i.e. the next trigger won't be fired until the last message have been processed.

## usage

| Entity                                      | Type | Parameters                            |
| ------------------------------------------- | ---- | ------------------------------------- |
| `/<PROVIDER_NS>/redis-trigger-feed/changes` | feed | url, queue, format, cert, cert_format |

- `url` is the full Redis connection URL for the database, e.g. `redis(s)://user:pass@host.name.com:port`
  - *mandatory parameter*
- `subscribe` is the [channel name for subscriptions](https://redis.io/commands/subscribe).
  - *mandatory parameter (if `psubscribe` is not set)*
- `psubscribe` is the [channel name pattern for subscriptions](https://redis.io/commands/psubscribe).
  - *mandatory parameter (if `subscribe` is not set)*
- `cert` is the PEM server certificate string.
- `cert_format` is the PEM server certificate format
  - valid values: `utf-8` & `base64`.
  - default value: `utf-8`

### cli example

```
wsk trigger create test-redis-trigger --feed /<PROVIDER_NS>/redis-trigger-feed/changes --param url <REDIS_URL> --param subscribe <CHANNEL_NAME>
```

### trigger events

Trigger events fired by the provider have the following format:

```
{"message":"<CHANNEL_MESSAGE>", "channel": "<CHANNEL>"}
```

#### message format

Redis only supports publishing channel messages as strings. Other formats must be encoded as strings to use with Redis' pub/sub mechanism (e.g. Base64 for binary).

### connecting over ssl

If you need to connect to a Redis database over TLS, use the `rediss://` URL prefix in the URL parameter.

If the broker uses a self-signed certificate, this will need to be provided in the trigger parameter options. The `cert` parameter is used to provide the certificate value, which can either be the raw certificate string (`-----BEGIN CERTIFICATE-----…`) or a base64-encoded version. If you provide a base-64 encoded version, make sure you specify the `cert_format` parameter to be `base64`.

### errors

If there are any issues with the connection to the broker, the trigger will be automatically disabled. Error details on what has gone wrong are available by retrieving the latest status of the trigger.

```
wsk trigger get test-redis-trigger
```

## development

### running

See the "[Pluggable OpenWhisk Event Provider](https://github.com/apache/incubator-openwhisk-pluggable-provider)" docs on how to run this event provider. The following environment parameters are needed for this feed provider.

### unit tests

```
npm test
```

### integration tests

- Create a `test/integration/config.json` with the following values.

```
{
  "openwhisk": {
    "apihost": "<OW_HOSTNAME>",
    "api_key": "<OW_KEY>",
    "namespace": "_",
    "trigger": "redis-trigger-feed-test",
    "rule": "redis-rule-feed-test"
  },
  "redis": {
    "url": "<REDIS_BROKER_URL>"
  }
}
```

- Run the integration tests

```
npm run test-integration
```
