"use strict";

const EventEmitter = require('events')
const { promisify } = require('util')

const merge_fields = fields => {
  const keys = fields.filter((elem, i) => !(i % 2))
  const values = fields.filter((elem, i) => (i % 2))
  const message = keys.reduce((combined, key, i) => {
    combined[key] = values[i]
    return combined
  }, {})

  return message
}

const flatten = arr => [].concat.apply([], arr)

const results_to_messages = results => {
  const messages = results.map(([stream, messages]) => messages.map(([message_id, fields]) => ({stream, message_id, message: merge_fields(fields)})))
  return flatten(messages)
}

const StreamListener = async (client, stream, onmessage, logger, id, cache) => {
  const emitter = new EventEmitter()
  logger.info(`redis-trigger-feed`, `starting stream subscription (${id}) => ${stream}`)

  const xread = promisify(client.xread).bind(client)

  let should_block_on_stream = true

  const block_on_stream = async (stream, last_id) => {
    if (!should_block_on_stream) return
    logger.info(`redis-trigger-feed`, `waiting for stream messages (${stream}#${last_id} => ${id}).`)

    try {
      const results = await xread('BLOCK', 0, 'STREAMS', stream, last_id)
      logger.debug(`redis-trigger-feed`, `stream messages received (${stream}#${last_id}} => ${id}): ${JSON.stringify(results)}.`)
      if (results) {
        const messages = results_to_messages(results)
        for (let message of messages) {
          logger.debug(`redis-trigger-feed`, `stream message received (${stream}#${message.message_id}} => ${id}): ${JSON.stringify(message.message)}.`)
          await onmessage(message)
          last_id = message.message_id
          if (cache) await cache.set(id, last_id)
        }
      }

      setImmediate(() => block_on_stream(stream, last_id))
    } catch (err) {
      logger.error(`redis-trigger-feed`, `failed to fire trigger for stream (${stream}) => ${id}).`)
      emitter.emit('error', err)
    }
  }

  const last_id = cache ? await cache.get(id) : null 
  setImmediate(() => block_on_stream(stream, last_id || '$'))

  return { 
    client,
    on: (evt, cb) => emitter.on(evt, cb),
    stop: async () => {
      should_block_on_stream = false
      if (cache) await cache.del(id)
    }
  }
}

module.exports = StreamListener
