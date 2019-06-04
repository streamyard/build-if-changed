const { join, resolve, basename, dirname, isAbsolute } = require('path')
const { crawl } = require('recrawl')
const fs = require('saxon/sync')
const log = require('lodge')
const spawn = require('./spawn')
const checksum = require('./checksum')

const PKG_JSON = 'package.json'
const CACHE_NAME = '.bic_cache'

exports.findPackages = opts =>
  crawl(opts.cwd, {
    only: [PKG_JSON],
    skip: opts.ignore ? opts.ignore(opts.cwd) : [],
  })

exports.loadPackages = (packages, opts = {}) => {
  const log = opts.log || require('./noop-log')
  return packages
    .map(pkg => {
      pkg = resolve(opts.cwd, pkg)
      if (!isAbsolute(pkg)) {
        log.warn('Package path must be absolute:\n  %O', pkg)
        return
      }
      if (basename(pkg) === PKG_JSON) {
        pkg = dirname(pkg)
      }
      const configPath = join(pkg, PKG_JSON)
      if (!fs.isFile(configPath)) {
        log.warn('Package has no "%s" module:\n  %O', PKG_JSON, pkg)
        return
      }
      try {
        const config = fs.readJson(configPath)
        config.root = pkg
        if (!config.name) {
          config.name = basename(pkg)
        }
        return config
      } catch {
        log.warn('Package has invalid "%s" module:\n  %O', PKG_JSON, pkg)
      }
    })
    .filter(pkg => !!pkg)
}

exports.buildPackages = async (packages, opts = {}) => {
  const log = opts.log || require('./noop-log')
  const exitCodes = await Promise.all(
    packages.map(pkg => {
      const cmd = fs.isFile(join(pkg.root, 'yarn.lock')) ? 'yarn' : 'npm'
      const proc = spawn(`${cmd} run build`, {
        cwd: pkg.root,
      })

      const prefix = getPrefix(pkg.name, log)
      proc.stdout.on('data', data => {
        getLines(data).forEach(line => {
          log(prefix, line)
        })
      })
      proc.stderr.on('data', data => {
        getLines(data).forEach(line => {
          process.stdout.write(`${prefix} ${line}\n`)
        })
      })

      return new Promise(resolve => {
        proc.on('error', err => {
          console.error(err)
          exit(1)
        })
        proc.on('exit', exit)
        function exit(code) {
          if (code != 0) {
            // Destroy the cache when build fails.
            fs.remove(join(pkg.root, CACHE_NAME))
          }
          resolve(code)
        }
      })
    })
  )
  return exitCodes.every(code => code == 0)
}

exports.getChanged = (packages, opts = {}) => {
  const promises = packages.map(async pkg => {
    const config = 'bic' in pkg ? pkg.bic : {}
    if (config === false) {
      return false
    }

    // Bail when the "build" script is empty or it executes
    // the "bic" or "build-if-changed" command.
    const script = pkg.scripts && pkg.scripts.build
    if (!script || /\b(bic|build-if-changed)\b/.test(script)) {
      return false
    }

    const files = await crawl(pkg.root, {
      only: Array.isArray(config) ? config : config.only,
      skip: [CACHE_NAME].concat(
        opts.ignore ? opts.ignore(pkg.root) : [],
        config.skip || []
      ),
    })

    const cachePath = join(pkg.root, CACHE_NAME)
    const cache = fs.isFile(cachePath) ? fs.readJson(cachePath) : {}

    // Track changed paths for easier debugging.
    const changed = []

    // Look for deleted files.
    for (const name in cache)
      if (!files.includes(name)) {
        delete cache[name]
        changed.push(name)
      }

    // Look for added/changed files.
    await Promise.all(
      files.map(async name => {
        const path = join(pkg.root, name)
        const prev = cache[name] || [0, '']
        const mtime = Number(fs.stat(path).mtime)
        if (mtime !== prev[0]) {
          const hash = await checksum(path)
          if (hash !== prev[1]) {
            cache[name] = [mtime, hash]
            changed.push(name)
          }
        }
      })
    )

    if (changed.length) fs.write(cachePath, JSON.stringify(cache))
    return !!(changed.length || opts.force)
  })

  // Return the packages that changed.
  return Promise.all(promises).then(changed =>
    packages.filter((p, i) => changed[i])
  )
}

const nextColor = (() => {
  const colors = ['yellow', 'green', 'cyan', 'pink', 'red', 'blue']
  colors.unshift(...colors.map(color => 'l' + color))

  let i = 0
  return () => {
    const color = colors[i++]
    if (i >= colors.length) i = 0
    return color
  }
})()

function getPrefix(name, log) {
  const prefix = `[${name}]`
  const color = nextColor()
  return log[color] ? log[color](prefix) : prefix
}

function getLines(data) {
  return data
    .toString()
    .trim()
    .split(/\r?\n/)
}
