'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
const child_process_1 = require('child_process')
exports.default = (command, opts) => {
  let file, args
  if (process.platform === 'win32') {
    file = process.env.comspec || 'cmd.exe'
    args = ['/s', '/c', '"' + command + '"']
    opts = Object.assign({}, opts, { windowsVerbatimArguments: true })
  } else {
    file = '/bin/sh'
    args = ['-c', command]
  }
  return child_process_1.spawn(file, args, opts)
}
