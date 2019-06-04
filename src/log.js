const { yellow } = require('./colors')

module.exports = (opts = {}) => {
  const log = opts.silent ? () => {} : opts.log || console.log
  const warn = yellow('warn:')
  log.warn = opts.silent
    ? log
    : (msg, ...args) =>
        typeof msg == 'string'
          ? log(warn + ' ' + msg, ...args)
          : log(warn, msg, ...args)
  return log
}
