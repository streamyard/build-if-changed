const { findPackages, loadPackages, getChanged, buildPackages } = require('.')

exports.run = async (opts = {}) => {
  if (opts.cwd == null) opts.cwd = process.cwd()
  if (opts.ignore == null) {
    opts.ignore = await require('./gitignore')(opts.cwd)
  }
  if (opts.log == null) opts.log = require('lodge')
  const log = opts.log || require('./noop-log')

  // Load "package.json" modules into memory.
  let packages = await findPackages(opts)
  packages = loadPackages(packages, opts)

  const changed = await getChanged(packages, opts)
  if (!changed.length) {
    log('✨ No changes were found.')
    return []
  }

  log(`🔨 Building ${changed.length} ${plural('package', changed.length)}...`)
  const success = await buildPackages(changed, opts)
  if (!success) process.exit(1)
  log(`✨ Finished without errors.`)
}

function plural(word, count) {
  return count == 1 ? word : word + 's'
}
