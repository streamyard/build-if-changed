#!/usr/bin/env node
const hasFlag = require('has-flag')
require('../src/cli')
  .run({ force: hasFlag('f') })
  .catch(console.error)
