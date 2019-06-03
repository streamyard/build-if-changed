const { dirname, join, relative, isAbsolute } = require('path')
const { crawl } = require('recrawl')
const fs = require('saxon/sync')

const GI = '.gitignore'

// First, this finds all .gitignore files in the given root directory.
// Then, it creates a function that matches a given directory with any or all of
// the .gitignore files that were found, returning a deduped array of globs.
module.exports = async root => {
  const paths = await crawl(root, {
    only: [GI],
    skip: ['.git', 'node_modules'],
  })
  // TODO: only load the paths that are used
  const globs = paths.map(file => {
    return fs
      .read(file)
      .split(/\r?\n/)
      .filter(glob => !!glob)
  })
  return dir => {
    if (isAbsolute(dir)) {
      dir = relative(root, dir) || '.'
    }
    // Some paths are always ignored.
    const matches = ['.git', 'node_modules']
    while (true) {
      const path = join(dir, GI)
      const index = paths.indexOf(path)
      if (index >= 0) {
        matches.push(...globs[index])
      }
      if (dir === '.') break
      dir = dirname(dir)
    }
    // Dedupe the matches before returning.
    return Array.from(new Set(matches))
  }
}
