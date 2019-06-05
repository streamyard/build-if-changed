import * as crypto from 'crypto'
import * as fs from 'fs'

export default (filename, opts: any = {}) => {
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
