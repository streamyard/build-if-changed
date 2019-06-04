#!/usr/bin/env node
const hasFlag = require('has-flag')
require('../src/cli')
  .run({
    force: hasFlag('-f'),
    silent: hasFlag('-s'),
  })
  .catch(console.error)
