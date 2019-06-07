import test from 'ava'

const validate = require('../../lib/validate.js')

test('should return error when missing url parameter', async t => {
  const params = {
    subscribe: 'some-channel-name'
  }

  await t.throwsAsync(async () => validate(params), {message: 'redis trigger feed: missing url parameter'});
})

test('should return error when missing subscribe or psubscribe parameter', async t => {
  const params = {
    url: 'redis://user:pass@host.name:6379'
  }

  await t.throwsAsync(async () => validate(params), {message: 'redis trigger feed: missing subscribe or psubscribe parameter'});
})

test('should return error when both subscribe and psubscribe parameters present', async t => {
  const params = {
    url: 'redis://user:pass@host.name:6379',
    subscribe: 'some-channel-name',
    psubscribe: 'some-channel-name'
  }

  await t.throwsAsync(async () => validate(params), {message: 'redis trigger feed: cannot have both subscribe and psubscribe parameters'});
})

test('should return error with code or message when accessing redis fails', async t => {
  const params = {
    url: 'redis://user:pass@host.name:6379',
    subscribe: 'some-subscribe-name'
  }

  const err = new Error('connection failed error message')
  err.code = 'ECONNREFUSED'

  const check_conn = async () => Promise.reject(err)

  await t.throwsAsync(async () => validate(params, check_conn), {message: 'redis trigger feed: client error => (code: ECONNREFUSED, message: connection failed error message)'});
})

test('should resolve with valid params (subscribe) when accessing redis succeeds', async t => {
   const params = {
    url: 'redis://user:pass@host.name:6379',
    subscribe: 'some-channel-name'
  }

  const check_conn = async () => Promise.resolve()

  const valid_params = await validate(params, check_conn)
  t.deepEqual(params, valid_params)
})

test('should resolve with valid params (psubscribe) when accessing redis succeeds', async t => {
   const params = {
    url: 'redis://user:pass@host.name:6379',
    psubscribe: 'some-channel-name'
  }

  const check_conn = async () => Promise.resolve()

  const valid_params = await validate(params, check_conn)
  t.deepEqual(params, valid_params)
})

test('should ignore extra params when validating input', async t => {
  const params = {
    url: 'redis://user:pass@host.name:6379',
    subscribe: 'some-channel-name'
  }

  const extra_params = Object.assign({ hello: 'world', a: 1 }, params)

  const check_conn = () => Promise.resolve()
  const valid_params = await validate(params, check_conn)
  t.deepEqual(valid_params, params)
})

test('should allow raw cert to be provided', async t => {
  const cert = '-----BEGIN CERTIFICATE-----\n' + 
    'MIIDHTCCAgWgAwIBAgIUAkNMzbJeAz2OfRxfoSF4TpLcA6owDQYJKoZIhvcNAQEL\n' + 
    'MIIDHTCCAgWgAwIBAgIUAkNMzbJeAz2OfRxfoSF4TpLcA6owDQYJKoZIhvcNAQEL\n' + 
    'MIIDHTCCAgWgAwIBAgIUAkNMzbJeAz2OfRxfoSF4TpLcA6owDQYJKoZIhvcNAQEL\n' + 
    'MIIDHTCCAgWgAwIBAgIUAkNMzbJeAz2OfRxfoSF4TpLcA6owDQYJKoZIhvcNAQEL\n' + 
    'lqTCiie89peszqIhCoJQUtBP9oQpcOmTCCaDQ9fkEa122g3VLY7sTwqGG5zrGGGN\n' + 
    '5OdAjKnMQPDNXnaRFFFgsLDAYT8DVoma9AxgkMtD2rja\n' + 
    '-----END CERTIFICATE-----'

  const params = {
    subscribe: 'some-channel-name',
    url: 'redis://user:pass@host.name:6379',
    cert
  }

  const check_conn = () => Promise.resolve()
  const valid_params = await validate(params, check_conn)
  t.deepEqual(valid_params, params)
})

test('should allow base64 cert to be provided', async t => {
  const cert = '-----BEGIN CERTIFICATE-----\n' + 
    'MIIDHTCCAgWgAwIBAgIUAkNMzbJeAz2OfRxfoSF4TpLcA6owDQYJKoZIhvcNAQEL\n' + 
    'MIIDHTCCAgWgAwIBAgIUAkNMzbJeAz2OfRxfoSF4TpLcA6owDQYJKoZIhvcNAQEL\n' + 
    'MIIDHTCCAgWgAwIBAgIUAkNMzbJeAz2OfRxfoSF4TpLcA6owDQYJKoZIhvcNAQEL\n' + 
    'MIIDHTCCAgWgAwIBAgIUAkNMzbJeAz2OfRxfoSF4TpLcA6owDQYJKoZIhvcNAQEL\n' + 
    'lqTCiie89peszqIhCoJQUtBP9oQpcOmTCCaDQ9fkEa122g3VLY7sTwqGG5zrGGGN\n' + 
    '5OdAjKnMQPDNXnaRFFFgsLDAYT8DVoma9AxgkMtD2rja\n' + 
    '-----END CERTIFICATE-----'

  const params = {
    subscribe: 'some-channel-name',
    url: 'redis://user:pass@host.name:6379',
    cert
  }

  const base64_params = {
    subscribe: 'some-channel-name',
    url: 'redis://user:pass@host.name:6379',
    cert: Buffer.from(cert).toString('base64'),
    cert_format: 'base64'
  }

  const check_conn = () => Promise.resolve()
  const valid_params = await validate(base64_params, check_conn)
  t.deepEqual(valid_params, params)
})

test('should throw error on invalid cert formats', async t => {
  const cert = '-----BEGIN CERTIFICATE-----\n' + 
    'MIIDHTCCAgWgAwIBAgIUAkNMzbJeAz2OfRxfoSF4TpLcA6owDQYJKoZIhvcNAQEL\n' + 
    'MIIDHTCCAgWgAwIBAgIUAkNMzbJeAz2OfRxfoSF4TpLcA6owDQYJKoZIhvcNAQEL\n' + 
    'MIIDHTCCAgWgAwIBAgIUAkNMzbJeAz2OfRxfoSF4TpLcA6owDQYJKoZIhvcNAQEL\n' + 
    'MIIDHTCCAgWgAwIBAgIUAkNMzbJeAz2OfRxfoSF4TpLcA6owDQYJKoZIhvcNAQEL\n' + 
    'lqTCiie89peszqIhCoJQUtBP9oQpcOmTCCaDQ9fkEa122g3VLY7sTwqGG5zrGGGN\n' + 
    '5OdAjKnMQPDNXnaRFFFgsLDAYT8DVoma9AxgkMtD2rja\n' + 
    '-----END CERTIFICATE-----'

  const params = {
    subscribe: 'some-channel-name',
    url: 'redis://user:pass@host.name:6379',
    cert: Buffer.from(cert).toString('base64'),
    cert_format: 'json'
  }

  await t.throwsAsync(async () => validate(params), {message: 'redis trigger feed: cert_format parameter must be utf-8 or base64'});
})
