import test from 'ava'
import ChannelListener from '../../lib/channel_listener.js'

const logger = { error: () => {}, debug: () => {}, info: () => {} }

test('should call subscribe with normal channel', async t => {
  t.plan(1)

  const channel = 'some-queue-name'
  const client = {
    subscribe: chan => t.is(chan, channel),
    on: () => {}
  }
  ChannelListener(client, channel, false, null, logger)
})

test('should call psubscribe with pattern channel', async t => {
  t.plan(1)

  const channel = 'some-queue-name'
  const client = {
    psubscribe: chan => t.is(chan, channel),
    on: () => {}
  }
  ChannelListener(client, channel, true, null, logger)
})

test('should return once channel subscription is confirmed', async t => {
  t.plan(1)

  const channel = 'some-queue-name'
  const listeners = []
  const client = {
    subscribe: () => {},
    on: (evt, cb) => listeners[evt] = cb
  }

  setTimeout(async () => {
    await listeners.subscribe(channel)
    t.pass()
  })

  await ChannelListener(client, channel, false, null, logger)
})

test('should fire callback for each subscription message', async t => {
  t.plan(1)

  const channel = 'some-queue-name'
  const listeners = []
  const client = {
    subscribe: () => {},
    on: (evt, cb) => listeners[evt] = cb
  }

  const msg = "some sample message"
  const onmessage = async (evt) => { 
    t.deepEqual(evt, { msg, channel })
  }

  setTimeout(() => listeners.subscribe(channel))

  await ChannelListener(client, channel, false, onmessage, logger)
  await listeners.message(channel, msg)
})

test('should fire callback for each pattern subscription message', async t => {
  t.plan(1)

  const pattern = '*'
  const channel = 'some-queue-name'
  const listeners = []
  const client = {
    psubscribe: () => {},
    on: (evt, cb) => listeners[evt] = cb
  }

  const msg = "some sample message"
  const onmessage = async evt => { 
    t.deepEqual(evt, { msg, channel })
  }

  setTimeout(() => listeners.psubscribe(channel))

  await ChannelListener(client, channel, true, onmessage, logger)
  await listeners.pmessage(pattern, channel, msg)
})

test('should call unsubscribe on stopping', async t => {
  t.plan(1)

  const channel = 'some-queue-name'
  const listeners = []
  const client = {
    subscribe: () => {},
    unsubscribe: chan => t.is(chan, channel),
    on: (evt, cb) => listeners[evt] = cb
  }

  setTimeout(() => listeners.subscribe(channel))

  const result = await ChannelListener(client, channel, false, null, logger)
  result.stop()
})

test('should fire error event on when onmessage fails', async t => {
  t.plan(1)

  const channel = 'some-queue-name'
  const listeners = []
  const client = {
    subscribe: () => {},
    on: (evt, cb) => listeners[evt] = cb
  }

  const err = new Error('failed to fire trigger')
  const onmessage = async () => Promise.reject(err)

  setTimeout(() => listeners.subscribe(channel))

  const cl = await ChannelListener(client, channel, false, onmessage, logger)
  cl.on('error', _err => t.is(_err, err))
  await listeners.message(channel, 'some message')
})
