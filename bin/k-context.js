#!/usr/bin/env node

import { createCLI } from '../src/cli.js';

const cli = createCLI();
cli.parse(process.argv);
