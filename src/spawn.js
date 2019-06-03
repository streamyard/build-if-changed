const { spawn } = require('child_process')

module.exports = (command, opts) => {
  let file, args
  if (process.platform === 'win32') {
    file = process.env.comspec || 'cmd.exe'
    args = ['/s', '/c', '"' + command + '"']
    opts = { ...opts, windowsVerbatimArguments: true }
  } else {
    file = '/bin/sh'
    args = ['-c', command]
  }
  return spawn(file, args, opts)
}
