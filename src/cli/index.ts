#!/usr/bin/env node
/**
 * Daemon CLI - Entry Point
 *
 * Main entry point for the Daemon toolkit CLI.
 */

import { DaemonCli } from './cli.js';

const cli = new DaemonCli();
await cli.run(process.argv);
