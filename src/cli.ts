import { findPackages, loadPackages, getChanged, buildPackages } from '.'
import { GitIgnore } from './gitignore'
import createLog from './log'
import path from 'path'
import fs = require('saxon/sync')

exports.run = async (opts = {}) => {
  const log = createLog(opts)

  if (opts.help) {
    log(fs.read(path.resolve(__dirname, '..', 'help.txt')))
    process.exit()
  }

  if (opts.cwd == null) {
    opts.cwd = process.cwd()
  }

  const filter = opts.filter
  const gitIgnore = new GitIgnore(opts.cwd)
  opts.filter = (file, name) =>
    !gitIgnore.test(file, name) && (!filter || filter(file, name))

  // Load "package.json" modules into memory.
  let packages = await findPackages(opts)
  packages = loadPackages(packages, opts)

  const changed = await getChanged(packages, opts)
  if (!changed.length) {
    log('✨  No changes were found.')
    return []
  }

  log(`📦  Building ${changed.length} ${plural('package', changed.length)}...`)
  if (await buildPackages(changed, opts)) {
    log(`✨  Finished without errors.`)
  } else {
    log(`💥  Build failed. Check the logs above.`)
    process.exit(1)
  }
}

function plural(word, count) {
  return count == 1 ? word : word + 's'
}
