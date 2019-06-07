"use strict"; 

import test from 'ava'

const RedisTriggerFeed = require('../../index.js')
const openwhisk = require('openwhisk')
const fs = require('fs')
const redis = require('redis')

const winston = require('winston')

const level = process.env.LOG_LEVEL || 'error'
const consoleLogger = new winston.transports.Console({ format: winston.format.simple() })

const logger = winston.createLogger({
  level, transports: [ consoleLogger ]
});

const config = JSON.parse(fs.readFileSync('./test/integration/config.json', 'utf-8'))

const topLevelConfig = ['redis', 'openwhisk']

for (let param of topLevelConfig) {
  if (!config[param]) throw new Error(`Missing mandatory configuration parameter: ${param}`)
}

const timeout = async delay => {
  return new Promise(resolve => setTimeout(resolve, delay))
}

const ow = openwhisk(config.openwhisk)

const wait_for_activations = async (name, since, max) => {
  logger.info(`looking for ${max} activations (${name}) since ${since}`)
  let activations = []
  while(activations.length < max) {
    activations = await ow.activations.list({name, since, limit: max})
    logger.info(`activations returned: ${activations.length}`)
    await timeout(1000)
  }

  logger.info('retrieving activation details...')
  const activationObjs = await Promise.all(activations.map(actv => ow.activations.get({name: actv.activationId})))
  const activationEvents = activationObjs.sort(actv => actv.start).map(actv => actv.response.result)

  return activationEvents
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

test.before(async t => {
  logger.info('create triggers & rules...')
  await ow.triggers.update({name: config.openwhisk.trigger})
  await ow.rules.update({name: config.openwhisk.rule, action: '/whisk.system/utils/echo', trigger: config.openwhisk.trigger})
}) 

test.after.always(async t => {
  await ow.triggers.delete({name: config.openwhisk.trigger})
  await ow.rules.delete({name: config.openwhisk.rule})
})

test.serial('publishing redis channel messages should invoke openwhisk triggers', async t => {
  const triggerManager = {
    fireTrigger: (id, event) => ow.triggers.invoke({name: id, params: event})
  }

  const feedProvider = new RedisTriggerFeed(triggerManager, logger)

  const trigger = `/_/${config.openwhisk.trigger}`
  const details = Object.assign({}, config.redis)

  logger.info(`adding trigger (${trigger}) to feed provider...`)
  await feedProvider.add(trigger, details)

  return new Promise(async (resolve, reject) => {
    try {
      const client = redis.createClient(parse_options(config.redis))

      let now = Date.now()

      const NUMBER_OF_MESSAGES = 10
      const messages = []

      for(let i = 0; i < NUMBER_OF_MESSAGES; i++) {
        const message = `message-${i}`
        messages.push(message)
        logger.info(`sending (${message}) to channel...`)
        client.publish(config.redis.subscribe, message)
        logger.info(`sent (${message}) to channel`)
      }

      const activationEvents = await wait_for_activations(config.openwhisk.trigger, now, messages.length)
      t.deepEqual(activationEvents.map(evt => evt.msg).sort(), messages)
      t.is(activationEvents.filter(msg => msg.channel === config.redis.subscribe).length, NUMBER_OF_MESSAGES)

      await feedProvider.remove(trigger)

      client.quit(resolve)
    } catch (err) {
      logger.error(err)
      reject(err)
    }
  })
});

test.serial('publishing redis channel messages with pattern subscription should invoke openwhisk triggers', async t => {
  const triggerManager = {
    fireTrigger: (id, event) => ow.triggers.invoke({name: id, params: event})
  }

  const feedProvider = new RedisTriggerFeed(triggerManager, logger)

  const trigger = `/_/${config.openwhisk.trigger}`
  const details = Object.assign({}, config.redis)
  delete details.subscribe
  details.psubscribe = "channel-*"

  logger.info(`adding trigger (${trigger}) to feed provider...`)
  await feedProvider.add(trigger, details)

  return new Promise(async (resolve, reject) => {
    try {
      const client = redis.createClient(parse_options(config.redis))

      let now = Date.now()

      const NUMBER_OF_MESSAGES = 10
      const messages = []
      const channels = []

      for(let i = 0; i < NUMBER_OF_MESSAGES; i++) {
        const message = `message-${i}`
        const channel = `channel-${i}`
        messages.push(message)
        channels.push(channel)
        logger.info(`sending (${message}) to channel...`)
        client.publish(channel, message)
        logger.info(`sent (${message}) to channel`)
      }

      const activationEvents = await wait_for_activations(config.openwhisk.trigger, now, messages.length)
      t.deepEqual(activationEvents.map(evt => evt.msg).sort(), messages)
      t.deepEqual(activationEvents.map(evt => evt.channel).sort(), channels)

      await feedProvider.remove(trigger)

      client.quit(resolve)
    } catch (err) {
      logger.error(err)
      reject(err)
    }
  })
});
