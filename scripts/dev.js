#!/usr/bin/env node

/**
 * Daemon Development Script
 *
 * For local development and testing of the Daemon CLI.
 */

const { execSync } = require('child_process');
const path = require('path');

const command = process.argv[2] || 'help';

const commands = {
  help: () => {
    console.log(`
Daemon Development Commands

  Usage: node scripts/dev.js <command>

  Commands:
    test       Run detector test
    build      Build Docker image
    start      Start container
    stop       Stop container
    clean      Remove container and image
    logs       Show container logs
    shell      Open shell in container
    link       Link package globally for testing
  `);
  },

  test: () => {
    console.log('Testing detector...');
    const detector = require('../agents/detector.js');
    detector.analyze(process.cwd())
      .then((context) => {
        console.log(JSON.stringify(context, null, 2));
      })
      .catch((err) => {
        console.error('Detection failed:', err);
        process.exit(1);
      });
  },

  build: () => {
    console.log('Building Docker image...');
    const dockerfile = path.join(__dirname, '..', 'bin', 'Dockerfile');
    execSync(`docker build -t daemon-tools -f "${dockerfile}" "${path.dirname(dockerfile)}"`, {
      stdio: 'inherit',
    });
    console.log('✓ Build complete');
  },

  start: () => {
    console.log('Starting container...');
    try {
      execSync('docker start daemon-tools', { stdio: 'inherit' });
      console.log('✓ Container started');
    } catch {
      const isLinux = process.platform === 'linux';
      const networkFlag = isLinux ? '--network=host' : '';
      execSync(`docker run -d --name daemon-tools ${networkFlag} daemon-tools`, {
        stdio: 'inherit',
      });
      console.log('✓ Container created');
    }
  },

  stop: () => {
    console.log('Stopping container...');
    execSync('docker stop daemon-tools', { stdio: 'inherit' });
    console.log('✓ Container stopped');
  },

  clean: () => {
    console.log('Removing container...');
    execSync('docker rm -f daemon-tools', { stdio: 'inherit', timeout: 5000 }).catch(() => {});
    console.log('Removing image...');
    execSync('docker rmi daemon-tools', { stdio: 'inherit', timeout: 30000 }).catch(() => {});
    console.log('✓ Clean complete');
  },

  logs: () => {
    execSync('docker logs -f daemon-tools', { stdio: 'inherit' });
  },

  shell: () => {
    console.log('Opening shell in container...');
    execSync('docker exec -it daemon-tools bash', { stdio: 'inherit' });
  },

  link: () => {
    console.log('Linking package globally...');
    execSync('npm link', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    console.log('✓ Package linked globally');
    console.log('You can now run: daemon');
  },
};

if (commands[command]) {
  commands[command]();
} else {
  console.log(`Unknown command: ${command}`);
  commands.help();
}
