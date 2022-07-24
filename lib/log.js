'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
const colors_1 = require('./colors')
exports.default = (opts = {}) => {
  const log = opts.silent ? () => {} : opts.log || console.log
  const warn = colors_1.default.yellow('warn:')
  log.warn = opts.silent
    ? log
    : (msg, ...args) =>
        typeof msg == 'string'
          ? log(warn + ' ' + msg, ...args)
          : log(warn, msg, ...args)
  return log
}
