'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
const _1 = require('.')
const gitignore_1 = require('./gitignore')
const path_1 = require('path')
const log_1 = require('./log')
const fs = require('saxon/sync')
exports.run = async (opts = {}) => {
  const log = log_1.default(opts)
  if (opts.help) {
    log(fs.read(path_1.resolve(__dirname, '..', 'help.txt')))
    process.exit()
  }
  if (opts.cwd == null) {
    opts.cwd = process.cwd()
  }
  const filter = opts.filter
  const gitIgnore = new gitignore_1.GitIgnore(opts.cwd)
  opts.filter = (file, name) =>
    !gitIgnore.test(file, name) && (!filter || filter(file, name))
  // Load "package.json" modules into memory.
  const packagePaths = await _1.findPackages(opts)
  if (!packagePaths.length) {
    log('⚠️  No packages were found.')
    return []
  }
  // Find which packages have changed.
  const packages = _1.loadPackages(packagePaths, opts)
  const changed = await _1.getChanged(packages, opts)
  if (!changed.length) {
    log('✨  No changes were found.')
    return []
  }
  log(`📦  Building ${changed.length} ${plural('package', changed.length)}...`)
  try {
    await _1.buildPackages(changed, opts)
    log(`✨  Finished without errors.`)
  } catch (_a) {
    log(`💥  Build failed. Check the logs above.`)
    process.exit(1)
  }
}
function plural(word, count) {
  return count == 1 ? word : word + 's'
}
