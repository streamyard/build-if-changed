import { findPackages, loadPackages, getChanged, buildPackages } from '.'
import { GitIgnore } from './gitignore'
import { resolve } from 'path'
import createLog from './log'
import fs = require('saxon/sync')

exports.run = async (opts = {}) => {
  const log = createLog(opts)

  if (opts.help) {
    log(fs.read(resolve(__dirname, '..', 'help.txt')))
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
  const packagePaths = await findPackages(opts)
  const packages = loadPackages(packagePaths, opts)

  // Find which packages have changed.
  const changed = await getChanged(packages, opts)
  if (!hasTruthy(changed)) {
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

type Falsy = null | undefined | false | 0 | ''

function hasTruthy<T>(changed: T[]): changed is Exclude<T, Falsy>[] {
  return changed.some(Boolean)
}
