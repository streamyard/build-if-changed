'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
const path_1 = require('path')
const recrawl_1 = require('recrawl')
const fs = require('saxon/sync')
const spawn_1 = require('./spawn')
const checksum_1 = require('./checksum')
const log_1 = require('./log')
const PKG_JSON = 'package.json'
const CACHE_NAME = '.bic_cache'
const ALWAYS_SKIP = ['.*', 'node_modules']
exports.findPackages = opts => {
  const filter =
    opts.filter &&
    ((file, name) => {
      return opts.filter(path_1.join(opts.cwd, file), name)
    })
  return recrawl_1.crawl(opts.cwd, {
    only: [PKG_JSON],
    skip: ALWAYS_SKIP.concat(opts.skip || []),
    enter: filter && (dir => filter(dir)),
    filter,
  })
}
exports.loadPackages = (packages, opts) => {
  const log = log_1.default(opts)
  return packages
    .map(pkg => {
      pkg = path_1.resolve(opts.cwd, pkg)
      if (!path_1.isAbsolute(pkg)) {
        log.warn('Package path must be absolute:\n  %O', pkg)
        return
      }
      if (path_1.basename(pkg) === PKG_JSON) {
        pkg = path_1.dirname(pkg)
      }
      const configPath = path_1.join(pkg, PKG_JSON)
      if (!fs.isFile(configPath)) {
        log.warn('Package has no "%s" module:\n  %O', PKG_JSON, pkg)
        return
      }
      try {
        const config = fs.readJson(configPath)
        config.root = pkg
        if (!config.name) {
          config.name = path_1.basename(pkg)
        }
        return config
      } catch (_a) {
        log.warn('Package has invalid "%s" module:\n  %O', PKG_JSON, pkg)
      }
    })
    .filter(Boolean)
}
exports.buildPackages = async (packages, opts) => {
  const log = log_1.default(opts)
  const procs = new Set()
  return runTopological(packages, pkg => {
    const cmd = getRunner(pkg.root)
    const proc = spawn_1.default(`${cmd} run build`, {
      cwd: pkg.root,
    })
    procs.add(proc)
    const prefix = getPrefix(pkg.name)
    proc.stdout.on('data', data => {
      getLines(data).forEach(line => {
        log(prefix, line)
      })
    })
    proc.stderr.on('data', data => {
      getLines(data).forEach(line => {
        process.stderr.write(`${prefix} ${line}\n`)
      })
    })
    return new Promise((resolve, reject) => {
      proc.on('error', err => {
        console.error(err)
        onExit(1)
      })
      proc.on('exit', onExit)
      function onExit(code) {
        procs.delete(proc)
        // Update the cache only if the build succeeds.
        if (code === 0) {
          fs.write(path_1.join(pkg.root, CACHE_NAME), JSON.stringify(pkg.cache))
          resolve()
        } else {
          reject(new Error('Build failed: ' + pkg.root))
        }
      }
    })
  }).catch(err => {
    // Stop all processes on error.
    procs.forEach(proc => proc.kill())
    throw err
  })
}
exports.getChanged = (packages, opts) => {
  const promises = packages.map(async pkg => {
    let config = pkg.bic == null ? {} : pkg.bic
    if (config === false) {
      return null
    }
    if (Array.isArray(config)) {
      config = { only: config }
    }
    // Bail when the "build" script is empty or it executes
    // the "bic" or "build-if-changed" command.
    const script = pkg.scripts && pkg.scripts.build
    if (!script || /\b(bic|build-if-changed)\b/.test(script)) {
      return null
    }
    const filter =
      opts.filter &&
      ((file, name) => {
        return opts.filter(path_1.join(pkg.root, file), name)
      })
    const files = await recrawl_1.crawl(pkg.root, {
      only: config.only,
      skip: ALWAYS_SKIP.concat(config.skip || []),
      enter: filter && (dir => filter(dir)),
      filter,
    })
    const cachePath = path_1.join(pkg.root, CACHE_NAME)
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
        const path = path_1.join(pkg.root, name)
        const prev = cache[name] || [0, '']
        const mtime = Number(fs.stat(path).mtime)
        if (mtime !== prev[0]) {
          const hash = await checksum_1.default(path)
          if (hash !== prev[1]) {
            cache[name] = [mtime, hash]
            changed.push(name)
          } else {
            prev[0] = mtime
          }
        }
      })
    )
    if (changed.length || opts.force) {
      pkg.cache = cache
      return pkg
    }
    return null
  })
  return Promise.all(promises).then(filterTruthy)
}
const runTopological = (packages, action) => {
  const promises = []
  const run = (pkg, index) =>
    promises[index] ||
    (promises[index] = Promise.all(
      Object.entries(pkg.dependencies || {}).map(([name, value]) => {
        let predicate
        if (value.startsWith('link:')) {
          const root = path_1.resolve(pkg.root, value.slice(5))
          predicate = pkg => pkg.root === root
        } else {
          predicate = pkg => pkg.name === name
        }
        const index = packages.findIndex(predicate)
        return index >= 0 && run(packages[index], index)
      })
    ).then(() => action(pkg)))
  packages.forEach(run)
  return Promise.all(promises)
}
const nextColor = (() => {
  const colors = require('./colors').default
  const keys = Object.keys(colors).reverse()
  let i = 0
  return () => {
    const key = keys[i++]
    if (i >= keys.length) i = 0
    return colors[key]
  }
})()
function getPrefix(name) {
  return nextColor()(`[${name}]`)
}
function getLines(data) {
  return data
    .toString()
    .replace(/^\s*\n/, '')
    .replace(/\n\s*$/, '')
    .split(/\r?\n/)
}
function getRunner(directory) {
  if (fs.isFile(path_1.join(directory, 'package-lock.json'))) {
    return 'npm'
  } else if (fs.isFile(path_1.join(directory, 'yarn.lock'))) {
    return 'yarn'
  } else if (fs.isFile(path_1.join(directory, 'pnpm-lock.yaml'))) {
    return 'pnpm'
  }
  return getRunner(path_1.join(directory, '..'))
}
function filterTruthy(changed) {
  return changed.filter(Boolean)
}
