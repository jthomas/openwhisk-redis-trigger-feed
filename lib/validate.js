const errors = require('./errors.js')

const ValidCertFormats = [ 'utf-8', 'base64' ]

const RedisParams = ['stream', 'subscribe', 'psubscribe']

module.exports = async (params, check_db) => {
  const valid = {}

  if (!params.hasOwnProperty('url')) {
    throw new Error(`redis trigger feed: missing url parameter`)
  }

  valid.url = params.url

  const redisParams = RedisParams.filter(param => params.hasOwnProperty(param))

  if (redisParams.length < 1) {
    throw new Error(`redis trigger feed: missing subscribe, psubscribe or stream parameter`)
  } else if (redisParams.length > 1) {
    throw new Error(`redis trigger feed: cannot have more than one of subscribe, psubscribe and stream parameters`)
  }

  valid[redisParams[0]] = params[redisParams[0]]

  if (params.hasOwnProperty('cert')) {
    const cert_format = params.cert_format || 'utf-8'

    if (!ValidCertFormats.includes(cert_format)) {
      throw new Error(`redis trigger feed: cert_format parameter must be utf-8 or base64`)
    }

    valid.cert = Buffer.from(params.cert, cert_format).toString('utf-8')
  }

  try {
    if (valid.cert) {
      await check_db({ url: valid.url, tls: { ca: valid.cert } })
    } else {
      await check_db(valid.url)
    }
    return valid 
  } catch (err) {
    const message = errors.format(err)
    throw new Error(message)
  }
}
