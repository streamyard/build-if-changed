import colors from './colors'

export default (opts: any = {}) => {
  const log = opts.silent ? () => {} : opts.log || console.log
  const warn = colors.yellow('warn:')
  log.warn = opts.silent
    ? log
    : (msg, ...args) =>
        typeof msg == 'string'
          ? log(warn + ' ' + msg, ...args)
          : log(warn, msg, ...args)
  return log
}
