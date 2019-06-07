const errors = require('./errors.js')

const ValidCertFormats = [ 'utf-8', 'base64' ]

module.exports = async (params, check_db) => {
  const valid = {}

  if (!params.hasOwnProperty('url')) {
    throw new Error(`redis trigger feed: missing url parameter`)
  }

  valid.url = params.url

  if (params.hasOwnProperty('subscribe')) {
    if (params.hasOwnProperty('psubscribe')) {
      throw new Error(`redis trigger feed: cannot have both subscribe and psubscribe parameters`)
    }
    valid.subscribe = params.subscribe
  } else if (params.hasOwnProperty('psubscribe')) {
    valid.psubscribe = params.psubscribe
  } else {
    throw new Error(`redis trigger feed: missing subscribe or psubscribe parameter`)
  }

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
