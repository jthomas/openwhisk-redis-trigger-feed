const redis = require('redis')
const { promisify } = require('util')

module.exports = (url, logger) => {
  const client = redis.createClient(url)

  client.on("error", (err) => {
    logger.error("redis cache error:", err);
  });

  const get = promisify(client.get).bind(client)
  const set = promisify(client.set).bind(client)
  const del = promisify(client.del).bind(client)

  return { get, set, del }
}
