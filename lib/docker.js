/**
 * Daemon - Docker Management
 *
 * Handles Docker container operations for the Daemon toolkit.
 */

const { execSync } = require('child_process');

const CONFIG = {
  imageName: 'daemon-tools',
  containerName: 'daemon-tools',
  dockerfile: path.join(__dirname, '..', 'bin', 'Dockerfile'),
};

/**
 * Check if Docker is running
 */
function isDockerRunning() {
  try {
    execSync('docker info', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if image exists
 */
function imageExists() {
  try {
    const output = execSync(`docker images -q ${CONFIG.imageName}`, { stdio: 'pipe' });
    return output.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Build the Docker image
 */
function buildImage(options = {}) {
  const cmd = `docker build -t ${CONFIG.imageName} -f "${CONFIG.dockerfile}" "${path.dirname(CONFIG.dockerfile)}"`;

  return execSync(cmd, {
    stdio: options.silent ? 'pipe' : 'inherit',
    timeout: options.timeout || 600000, // 10 minutes
  });
}

/**
 * Check if container is running
 */
function isContainerRunning() {
  try {
    const output = execSync(
      `docker ps --filter "name=^${CONFIG.containerName}$" --format "{{.Names}}"`,
      { stdio: 'pipe' }
    );
    return output.trim() === CONFIG.containerName;
  } catch {
    return false;
  }
}

/**
 * Check if container exists
 */
function containerExists() {
  try {
    const output = execSync(
      `docker ps -a --filter "name=^${CONFIG.containerName}$" --format "{{.Names}}"`,
      { stdio: 'pipe' }
    );
    return output.trim() === CONFIG.containerName;
  } catch {
    return false;
  }
}

/**
 * Start container
 */
function startContainer() {
  const cmd = `docker start ${CONFIG.containerName}`;
  return execSync(cmd, { stdio: 'pipe' });
}

/**
 * Create container
 */
function createContainer(options = {}) {
  const isLinux = process.platform === 'linux';
  const networkFlag = isLinux ? '--network=host' : '';
  const cmd = `docker run -d --name ${CONFIG.containerName} ${networkFlag} ${CONFIG.imageName}`;

  return execSync(cmd, { stdio: 'pipe' });
}

/**
 * Stop container
 */
function stopContainer() {
  try {
    return execSync(`docker stop ${CONFIG.containerName}`, { stdio: 'pipe' });
  } catch {
    return null;
  }
}

/**
 * Remove container
 */
function removeContainer() {
  try {
    return execSync(`docker rm -f ${CONFIG.containerName}`, { stdio: 'pipe' });
  } catch {
    return null;
  }
}

/**
 * Execute command in container
 */
function execInContainer(command, options = {}) {
  const cmd = `docker exec ${CONFIG.containerName} ${command}`;

  try {
    return {
      success: true,
      output: execSync(cmd, {
        encoding: 'utf-8',
        stdio: options.silent ? 'pipe' : 'inherit',
        timeout: options.timeout || 60000,
      }),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      output: error.stdout || '',
    };
  }
}

/**
 * Get container logs
 */
function getLogs(options = {}) {
  const tail = options.tail || 100;
  const cmd = `docker logs --tail ${tail} ${CONFIG.containerName}`;

  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
  } catch {
    return '';
  }
}

/**
 * Setup container (build, start, or create as needed)
 */
async function setupContainer(options = {}) {
  // Check Docker
  if (!isDockerRunning()) {
    throw new Error('Docker is not running');
  }

  // Build image if needed
  if (!imageExists()) {
    if (options.onBuildStart) {
      options.onBuildStart();
    }
    buildImage({ silent: options.silent });
    if (options.onBuildComplete) {
      options.onBuildComplete();
    }
  }

  // Start or create container
  if (isContainerRunning()) {
    return { status: 'running' };
  }

  if (containerExists()) {
    startContainer();
    return { status: 'started' };
  }

  createContainer();
  return { status: 'created' };
}

module.exports = {
  isDockerRunning,
  imageExists,
  buildImage,
  isContainerRunning,
  containerExists,
  startContainer,
  createContainer,
  stopContainer,
  removeContainer,
  execInContainer,
  getLogs,
  setupContainer,
};
