#!/usr/bin/env node
require('../src/cli')
  .run()
  .catch(console.error)
