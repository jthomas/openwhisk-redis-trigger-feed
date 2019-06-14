import test from 'ava'
import StreamListener from '../../lib/stream_listener.js'

const logger = { error: () => {}, debug: () => {}, info: () => {} }

test('should make blocking xread call for latest messages', async t => {
  return new Promise((resolve, reject) => {
    t.plan(5)

    const stream = 'some-stream-name'
    const client = {
      xread: async (blocking, delay, streams, id, from) => {
        t.is(blocking, 'BLOCK')
        t.is(delay, 0)
        t.is(streams, 'STREAMS')
        t.is(id, stream)
        t.is(from, '$')
        resolve()
      },
      on: () => {}
    }

    StreamListener(client, stream, null, logger)
  })
})

test('should use default position in first xread call if cache available but not cached value is', async t => {
  return new Promise((resolve, reject) => {
    t.plan(6)

    const stream = 'some-stream-name'
    const trigger_id = 'some-trigger-id'
    const client = {
      xread: async (blocking, delay, streams, id, from) => {
        t.is(blocking, 'BLOCK')
        t.is(delay, 0)
        t.is(streams, 'STREAMS')
        t.is(id, stream)
        t.is(from, '$')
        resolve()
      },
      on: () => {}
    }

    const cache = {
      get: async (id) => {
        t.is(id, trigger_id)
        return null
      }
    }

    StreamListener(client, stream, null, logger, trigger_id, cache)
  })
})

test('should use cached client position in first xread call if cache returns value', async t => {
  return new Promise((resolve, reject) => {
    t.plan(6)

    const stream = 'some-stream-name'
    const trigger_id = 'some-trigger-id'
    const client_position = '1518951480106-0'
    const client = {
      xread: async (blocking, delay, streams, id, from) => {
        t.is(blocking, 'BLOCK')
        t.is(delay, 0)
        t.is(streams, 'STREAMS')
        t.is(id, stream)
        t.is(from, client_position)
        resolve()
      },
      on: () => {}
    }

    const cache = {
      get: async (id) => {
        t.is(id, trigger_id)
        return client_position
      }
    }

    StreamListener(client, stream, null, logger, trigger_id, cache)
  })
})



test('should fire single stream as event', async t => {
  return new Promise((resolve, reject) => {
    t.plan(2)
    t.timeout(100)

    const stream = 'some-stream-name'
    const message_id = '1560181592807-0'

    const fields = ['name', 'Sara', 'surname', 'OConnor']
    const client = {
      xread: (blocking, delay, streams, id, from, cb) => {
        t.pass()
        setTimeout(() => {
          cb(null, [
            [ stream, [[ message_id, fields ]]]
          ])
        })
      }
    }

    const onmessage = async (evt) => { 
      t.deepEqual(evt, { stream, message_id, message: { name: fields[1], surname: fields[3] } })
      resolve()
    }

    StreamListener(client, stream, onmessage, logger)
  })
})

test('should set message id after trigger fired if cache available', async t => {
  return new Promise((resolve, reject) => {
    t.plan(2)
    t.timeout(100)

    const stream = 'some-stream-name'
    const message_id = '1560181592807-0'
    const trigger_id = 'some-trigger-id'

    const fields = ['name', 'Sara', 'surname', 'OConnor']
    const client = {
      xread: (blocking, delay, streams, id, from, cb) => {
        setTimeout(() => {
          cb(null, [
            [ stream, [[ message_id, fields ]]]
          ])
        })
      }
    }

    const cache = {
      get: async () => {},
      set: async (_trigger_id, _message_id) => {
        t.is(_trigger_id, trigger_id)
        t.is(_message_id, message_id)
        resolve()
      }
    }

    const onmessage = async () => {}

    StreamListener(client, stream, onmessage, logger, trigger_id, cache)
  })
})

test('should fire multiple stream messages as events from single response', async t => {
  return new Promise((resolve, reject) => {
    t.plan(3)
    t.timeout(100)

    const stream = 'some-stream-name'
    let message_id = ['1560181592807-0', '1560181592807-1', '1560181592807-2']

    let fields = [
      ['name', 'Sara', 'surname', 'OConnor'],
      ['name', 'John', 'surname', 'OConnor'],
      ['name', 'Arnie', 'surname', 'Schwartz']
    ]

    const client = {
      xread: (blocking, delay, streams, id, from, cb) => {
        setTimeout(() => {
          if (fields.length) cb(null, [
            [ stream, [
              [ message_id[0], fields[0] ],
              [ message_id[1], fields[1] ],
              [ message_id[2], fields[2] ]
            ]]
          ])
        })
      }
    }

    const onmessage = async (evt) => { 
      t.deepEqual(evt, { stream, message_id: message_id[0], message: { name: fields[0][1], surname: fields[0][3] } })
      message_id = message_id.slice(1)
      fields = fields.slice(1)
      if (fields.length === 0) resolve()
    }

    StreamListener(client, stream, onmessage, logger)
  })
})

test('should fire stream messages as events from multiple responses', async t => {
  return new Promise((resolve, reject) => {
    t.plan(3)
    t.timeout(100)

    const stream = 'some-stream-name'
    let message_id = ['1560181592123-0', '1560181592124-0', '1560181592125-0']

    let fields = [
      ['name', 'Sara', 'surname', 'OConnor'],
      ['name', 'John', 'surname', 'OConnor'],
      ['name', 'Arnie', 'surname', 'Schwartz']
    ]

    const client = {
      xread: (blocking, delay, streams, id, from, cb) => {
        setTimeout(() => {
          if (fields.length) cb(null, [
            [ stream, [
              [ message_id[0], fields[0] ]
            ]]
          ])
        })
      }
    }

    const onmessage = async (evt) => { 
      t.deepEqual(evt, { stream, message_id: message_id[0], message: { name: fields[0][1], surname: fields[0][3] } })
      message_id = message_id.slice(1)
      fields = fields.slice(1)
      if (fields.length === 0) resolve()
    }

    StreamListener(client, stream, onmessage, logger)
  })
})

test('should use message id as next xread parameter from multiple messages', async t => {
  return new Promise((resolve, reject) => {
    t.plan(3)
    t.timeout(100)

    const stream = 'some-stream-name'
    let current_id = '$'
    let message_id = ['1560181592123-0', '1560181592124-0', '1560181592125-0']

    let fields = [
      ['name', 'Sara', 'surname', 'OConnor'],
      ['name', 'John', 'surname', 'OConnor'],
      ['name', 'Arnie', 'surname', 'Schwartz']
    ]

    const client = {
      xread: (blocking, delay, streams, id, from, cb) => {
        setTimeout(() => {
          t.is(from, current_id)
          if (fields.length) cb(null, [
            [ stream, [
              [ message_id[0], fields[0] ]
            ]]
          ])
        })
      }
    }

    const onmessage = async (evt) => { 
      current_id = message_id[0]
      message_id = message_id.slice(1)
      fields = fields.slice(1)
      if (fields.length === 0) resolve()
    }

    StreamListener(client, stream, onmessage, logger)
  })
})

test('should use message id as next xread parameter from multiple messages in single response', async t => {
  return new Promise((resolve, reject) => {
    t.plan(2)
    t.timeout(100)

    const stream = 'some-stream-name'
    let current_id = '$'
    let message_id = ['1560181592123-0', '1560181592124-0', '1560181592125-0']

    let fields = [
      ['name', 'Sara', 'surname', 'OConnor'],
      ['name', 'John', 'surname', 'OConnor'],
      ['name', 'Arnie', 'surname', 'Schwartz']
    ]

    const client = {
      xread: (blocking, delay, streams, id, from, cb) => {
        setTimeout(() => {
          t.is(from, current_id)
          if (fields.length) {
            cb(null, [
              [ stream, [
                [ message_id[0], fields[0] ],
                [ message_id[1], fields[1] ],
                [ message_id[2], fields[2] ]
              ]]
            ])
          } else {
            resolve()
          }
        })
      }
    }

    const onmessage = async (evt) => { 
      current_id = evt.message_id
      fields = []
    }

    StreamListener(client, stream, onmessage, logger)
  })
})

test('should handle null stream response due to timeout', async t => {
  return new Promise((resolve, reject) => {
    t.plan(2)
    t.timeout(100)

    const stream = 'some-stream-name'
    let current_id = '$'
    let message_id = ['1560181592123-0', '1560181592124-0', '1560181592125-0']

    let fields = [
      ['name', 'Sara', 'surname', 'OConnor'],
      ['name', 'John', 'surname', 'OConnor'],
      ['name', 'Arnie', 'surname', 'Schwartz']
    ]

    let called = false
    const client = {
      xread: (blocking, delay, streams, id, from, cb) => {
        setTimeout(() => {
          t.is(from, current_id)
          if (called) {
            resolve()
          } else {
            called = true
            cb(null, null)
          }
        })
      }
    }

    StreamListener(client, stream, null, logger)
  })
})

test('should cancel stream listening when stop() is called', async t => {
  return new Promise(async (resolve, reject) => {
    t.plan(1)
    t.timeout(200)

    const stream = 'some-stream-name'
    let current_id = '$'
    let message_id = ['1560181592123-0', '1560181592124-0', '1560181592125-0']

    let fields = [
      ['name', 'Sara', 'surname', 'OConnor'],
      ['name', 'John', 'surname', 'OConnor'],
      ['name', 'Arnie', 'surname', 'Schwartz']
    ]

    const client = {
      xread: (blocking, delay, streams, id, from, cb) => {
        t.fail()
      }
    }

    const onmessage = async (evt) => { 
      t.fail()
    }

    const sl = await StreamListener(client, stream, onmessage, logger)
    sl.stop()
    setTimeout(() => {
      t.pass()
      resolve()
    }, 100)
  })
})

test('should remove cached message id when stop() is called', async t => {
  return new Promise(async (resolve, reject) => {
    t.plan(1)
    t.timeout(200)

    const stream = 'some-stream-name'
    const trigger_id = 'some-trigger-id'

    const client = {
      xread: (blocking, delay, streams, id, from, cb) => {
      }
    }

    const cache = {
      get: () => {}, 
      del: async (_trigger_id) => {
        t.is(trigger_id, _trigger_id)
      }
    }

    const onmessage = async (evt) => {}

    const sl = await StreamListener(client, stream, onmessage, logger, trigger_id, cache)
    sl.stop()
    setTimeout(() => {
      resolve()
    }, 100)
  })
})

test('should fire error event on when xread fails', async t => {
  return new Promise(async (resolve, reject) => {
    t.plan(1)

    const err = new Error('failed to fire trigger')

    const client = {
      xread: (blocking, delay, streams, id, from, cb) => {
        cb(err)
      }
    }

    const sl = await StreamListener(client, 'stream', null, logger)
    sl.on('error', _err => {
      t.is(_err, err)
      resolve()
    })
  })
})

test('should fire error event on when onmessage fails', async t => {
  return new Promise(async (resolve, reject) => {
    t.plan(1)

    const err = new Error('failed to fire trigger')

    const stream = 'some-stream-id'
    const message_id = '1560181592807-0'
    const fields = ['name', 'Sara', 'surname', 'OConnor']

    const client = {
      xread: (blocking, delay, streams, id, from, cb) => {
        setImmediate(() => {
          cb(null, [
            [ stream, [[ message_id, fields ]]]
          ])
        })
      }
    }

    const onmessage = async evt => Promise.reject(err)

    const sl = await StreamListener(client, 'stream', onmessage, logger)

    sl.on('error', _err => {
      t.is(_err, err)
      resolve()
    })
  })
})
