import { join, resolve, basename, dirname, isAbsolute } from 'path'
import { crawl, GlobMatcher } from 'recrawl'
import fs = require('saxon/sync')
import spawn from './spawn'
import checksum from './checksum'
import createLog from './log'

const PKG_JSON = 'package.json'
const CACHE_NAME = '.bic_cache'
const ALWAYS_SKIP = [CACHE_NAME, '.git', 'node_modules']

export const findPackages = opts => {
  const filter: GlobMatcher | undefined =
    opts.filter &&
    ((file, name) => {
      return opts.filter(join(opts.cwd, file), name)
    })
  return crawl(opts.cwd, {
    only: [PKG_JSON],
    skip: ALWAYS_SKIP.concat(opts.skip || []),
    enter: filter && (dir => filter(dir)),
    filter,
  })
}

export const loadPackages = (packages, opts: any = {}) => {
  const log = createLog(opts)
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

export const buildPackages = async (packages, opts: any = {}) => {
  const log = createLog(opts)
  const exitCodes = await Promise.all(
    packages.map(pkg => {
      const cmd = getRunner(pkg.root)
      const proc = spawn(`${cmd} run build`, {
        cwd: pkg.root,
      })

      const prefix = getPrefix(pkg.name)
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

export const getChanged = (packages, opts: any = {}) => {
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

    const filter: GlobMatcher | undefined =
      opts.filter &&
      ((file, name) => {
        return opts.filter(join(pkg.root, file), name)
      })

    const files = await crawl(pkg.root, {
      only: Array.isArray(config) ? config : config.only,
      skip: ALWAYS_SKIP.concat(config.skip || []),
      enter: filter && (dir => filter(dir)),
      filter,
    })

    const cachePath = join(pkg.root, CACHE_NAME)
    const cache = fs.isFile(cachePath) ? fs.readJson(cachePath) : {}

    // Track changed paths for easier debugging.
    const changed: string[] = []

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
          } else {
            prev[0] = mtime
          }
        }
      })
    )

    if (changed.length) fs.write(cachePath, JSON.stringify(cache))
    return !!(changed.length || opts.force)
  })

  // Return the packages that changed.
  return Promise.all(promises).then(changed =>
    packages.filter((_, i) => changed[i])
  )
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
    .trim()
    .split(/\r?\n/)
}

function getRunner(root) {
  return fs.isFile(join(root, 'package-lock.json')) ? 'npm' : 'yarn'
}
