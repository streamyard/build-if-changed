const { findPackages, loadPackages, getChanged, buildPackages } = require('.')
const createLog = require('./log')
const path = require('path')
const fs = require('saxon/sync')

exports.run = async (opts = {}) => {
  const log = createLog(opts)

  if (opts.help) {
    log(fs.read(path.resolve(__dirname, './help.txt')))
    process.exit()
  }

  if (opts.cwd == null) opts.cwd = process.cwd()
  if (opts.ignore == null) {
    opts.ignore = await require('./gitignore')(opts.cwd)
  }

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
