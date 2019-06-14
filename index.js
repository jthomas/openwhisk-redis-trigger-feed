"use strict"; 

const ChannelListener = require('./lib/channel_listener.js')
const StreamListener = require('./lib/stream_listener.js')
const Validate = require('./lib/validate.js')
const RedisCache = require('./lib/redis_cache.js')
const redis = require('redis')
const { promisify } = require('util')

const check_conn = async options => {
  return new Promise((resolve, reject) => {
    const client = redis.createClient(options)
    client.on('error', reject)
    client.on('ready', resolve)
  })
}

const b64_to_str = b64_str => Buffer.from(b64_str, 'base64').toString('utf-8') 

const parse_options = config => {
  const options = { url: config.url }

  if (config.cert) {
    const cert = (config.cert_format === 'base64') ? b64_to_str(config.cert) : config.cert
    options.tls = { ca: cert }
  }

  return options
}

module.exports = function (triggerManager, logger) {
  const stream_cache = process.env.REDIS ? RedisCache(process.env.REDIS, logger) : null
  const triggers = new Map()

  const add = async (id, details) => {
    logger.debug(`redis-trigger-feed`, 'add() called', id, details)
    // if the trigger is being updated, reset system state for trigger queue.
    if (triggers.has(id)) {
      remove(id)
    }

    const { url, subscribe, psubscribe, stream } = details

    const channel_or_stream = subscribe || psubscribe || stream
    const is_pattern = !!psubscribe
    const is_stream = !!stream

    const client = redis.createClient(parse_options(details))

    logger.info(`redis-trigger-feed`, `opened client connection (${url}) for trigger: ${id}`)

    client.on('error', (err) => {
      logger.error('redis-trigger-feed', `client connection error (${url}) for trigger ${id}`, err)
      triggerManager.disableTrigger(id, null, err.message)
    })

    const onmessage = async evt => { 
      logger.debug(`redis-trigger-feed`, `firing trigger (${id}) with event:`, evt)
      await triggerManager.fireTrigger(id, evt)
    }

    const listener = is_stream ? 
      await StreamListener(client, channel_or_stream, onmessage, logger, id, stream_cache) :
      await ChannelListener(client, channel_or_stream, is_pattern, onmessage, logger, id)

    logger.info(`redis-trigger-feed`, `redis listener (${channel_or_stream}) started for trigger: ${id}`)

    listener.on('error', err => {
      logger.error('redis-trigger-feed', `error processing channel messages for trigger ${id}`, err)
      triggerManager.disableTrigger(id, null, err.message)
    })

    triggers.set(id,listener)
  }
  
  const remove = async id => {
    logger.debug(`redis-trigger-feed`, 'remove() called', id)
    if (!triggers.has(id)) return

    const listener = triggers.get(id)
    listener.stop()
    listener.client.end(false)

    triggers.delete(id)
  }

  return { add, remove }
}

module.exports.validate = async params => Validate(params, check_conn)
