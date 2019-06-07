module.exports.format = err => {
  const msg = err.message || 'unknown'
  const code = err.code || 'unknown'
  const response = `code: ${code}, message: ${msg}`
  return `redis trigger feed: client error => (${response})`
}
