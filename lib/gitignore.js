'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
const path_1 = require('path')
const recrawl_1 = require('recrawl')
const fs = require('saxon/sync')
const os = require('os')
const readLines = path => fs.read(path).split(/\r?\n/)
const isHomeDir = path => path === '/' || path === os.homedir()
class GitIgnore {
  constructor(
    /** Tree paths are relative to this */
    rootDir,
    /** This maps tree paths to their own glob registry */
    globTree = {},
    /** These globs are always used */
    rootGlobs = ['.*', 'node_modules']
  ) {
    this.rootDir = rootDir
    this.globTree = globTree
    this.rootGlobs = rootGlobs
    this.matchRootGlobs = recrawl_1.createMatcher(rootGlobs)
  }
  test(file, name) {
    if (!path_1.isAbsolute(file)) {
      throw Error('Expected an absolute path')
    }
    if (!name) {
      name = path_1.basename(file)
    }
    let match
    if ((match = this.matchRootGlobs)) {
      if (match(file, name)) return true
    }
    for (
      let dir = path_1.dirname(file);
      !isHomeDir(dir);
      dir = path_1.dirname(dir)
    ) {
      const path = path_1.join(dir, '.gitignore')
      const pathId = path_1.relative(this.rootDir, path)
      match = this.globTree[pathId]
      if (match !== false) {
        if (match) {
          if (match(file, name)) {
            return true
          }
        } else if (fs.isFile(path)) {
          const lines = readLines(path).filter(line => line && line[0] !== '#')
          match = recrawl_1.createMatcher(lines, glob => path_1.join(dir, glob))
          this.globTree[pathId] = match || false
          if (match && match(file, name)) {
            return true
          }
        } else {
          this.globTree[pathId] = false
        }
      }
      // Never use .gitignore outside the git repository.
      if (fs.isDir(path_1.join(dir, '.git'))) {
        break
      }
    }
    return false
  }
}
exports.GitIgnore = GitIgnore
