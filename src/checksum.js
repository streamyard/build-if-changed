const crypto = require('crypto')
const fs = require('fs')

module.exports = function checksum(filename, opts = {}) {
  const { algorithm = 'sha1', encoding = 'hex' } = opts

  const hash = crypto.createHash(algorithm)
  hash.setEncoding(encoding)

  const fileStream = fs.createReadStream(filename)
  fileStream.pipe(
    hash,
    { end: false }
  )

  return new Promise((resolve, reject) => {
    fileStream.on('error', reject)
    fileStream.on('end', () => {
      hash.end()
      resolve(hash.read())
    })
  })
}
