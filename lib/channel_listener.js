"use strict";

const EventEmitter = require('events')

const ChannelListener = async (client, channel, is_pattern, onmessage, logger, id) => {
  return new Promise((resolve, reject) => {
    const emitter = new EventEmitter()

    logger.info(`redis-trigger-feed`, `pub/sub subscription (${id}) channel => ${channel} is_pattern => ${is_pattern}`)

    client.on("unsubscribe", (channel, count) => logger.info(`redis-trigger-feed`,
      `pub/sub subscription stopped (${id}) for ${channel} with ${count} listeners.`))

    const handle_message = async (channel, msg) => {
      logger.info(`redis-trigger-feed`, `msg received on channel (${channel} => ${id}).`, msg)

      try {
        await onmessage({channel, msg})
        logger.debug(`redis-trigger-feed`, `fired trigger for msg (${msg}) on channel (${channel} => ${id}).`)
      } catch (err) {
        logger.error(`redis-trigger-feed`, `failed to fire trigger for msg (${msg}) on channel (${channel} => ${id}).`)
        emitter.emit('error', err)
      }
    }

    if (is_pattern) {
      client.on('pmessage', (pattern, channel, msg) => handle_message(channel, msg))
    } else {
      client.on('message', handle_message)
    }

    const subscription = is_pattern ? "psubscribe" : "subscribe"

    client.on(subscription, (channel, listeners) => {
      logger.debug(`redis-trigger-feed`, `channel subscription confirmed (${channel} => ${id}).`)
      resolve({ 
        client,
        on: (evt, cb) => emitter.on(evt, cb),
        stop: () => client.unsubscribe(channel)
      })
    })

    client[subscription](channel);
  })
}

module.exports = ChannelListener
