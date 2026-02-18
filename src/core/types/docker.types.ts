/**
 * Docker Types
 *
 * Types for Docker container and image management.
 */

/**
 * Container status states
 */
export type ContainerStatus =
  | 'created'
  | 'running'
  | 'paused'
  | 'restarting'
  | 'exited'
  | 'removing'
  | 'dead'
  | 'unknown';

/**
 * Docker image architecture
 */
export type ImageArchitecture =
  | 'amd64'
  | 'arm64'
  | 'arm/v7'
  | 'ppc64le'
  | 's390x'
  | 'unknown';

/**
 * Docker command execution options
 */
export interface DockerExecOptions {
  /** Working directory inside container */
  workingDir?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Execute with specific user */
  user?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Whether to throw on error */
  throwOnError?: boolean;
  /** Capture stdout */
  captureStdout?: boolean;
  /** Capture stderr */
  captureStderr?: boolean;
}

/**
 * Docker command execution result
 */
export interface DockerExecResult {
  /** Exit code */
  exitCode: number;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Whether command succeeded */
  success: boolean;
  /** Execution duration in milliseconds */
  duration: number;
}

/**
 * Docker container configuration
 */
export interface DockerConfig {
  /** Container name */
  containerName: string;
  /** Image name */
  imageName: string;
  /** Docker file path */
  dockerfilePath?: string;
  /** Build context directory */
  buildContext?: string;
  /** Port mappings (host:container) */
  portMappings?: Record<string, number>;
  /** Volume mappings (host:container) */
  volumeMappings?: Record<string, string>;
  /** Environment variables */
  environment?: Record<string, string>;
  /** Network to attach to */
  network?: string;
  /** Auto-remove container on exit */
  autoRemove?: boolean;
  /** Detach mode */
  detach?: boolean;
}

/**
 * Docker build options
 */
export interface DockerBuildOptions {
  /** Docker file path */
  dockerfile?: string;
  /** Build context directory */
  context?: string;
  /** Build arguments */
  buildArgs?: Record<string, string>;
  /** Target stage for multi-stage builds */
  target?: string;
  /** Cache from images */
  cacheFrom?: string[];
  /** Build tags */
  tags?: string[];
  /** Suppress build output */
  quiet?: boolean;
  /** Platform to build for */
  platform?: ImageArchitecture;
}

/**
 * Docker create/run options
 */
export interface DockerCreateOptions {
  /** Container name */
  name?: string;
  /** Port mappings (container:host) */
  ports?: Record<number, number>;
  /** Volume bindings */
  volumes?: Array<string>;
  /** Environment variables */
  env?: Record<string, string>;
  /** Environment variables from files */
  envFile?: string[];
  /** Working directory */
  workdir?: string;
  /** User to run as */
  user?: string;
  /** Hostname */
  hostname?: string;
  /** Auto-remove on exit */
  autoRemove?: boolean;
  /** Detach mode */
  detach?: boolean;
  /** Interactive mode */
  interactive?: boolean;
  /** Allocate pseudo-TTY */
  tty?: boolean;
  /** Network to attach to */
  network?: string;
  /** Command to run */
  command?: string[];
  /** Health check command */
  healthcheck?: {
    command: string[];
    interval?: number;
    timeout?: number;
    retries?: number;
    startPeriod?: number;
  };
}

/**
 * Docker container inspect result
 */
export interface ContainerInspectResult {
  /** Container ID */
  id: string;
  /** Container name */
  name: string;
  /** Container status */
  status: ContainerStatus;
  /** Image ID */
  imageId: string;
  /** Image name */
  imageName: string;
  /** Created timestamp */
  created: Date;
  /** Port bindings */
  ports: Record<string, Array<{ hostIp: string; hostPort: string }>>;
  /** Mounts */
  mounts: Array<{
    type: string;
    source: string;
    destination: string;
    mode: string;
  }>;
  /** Network settings */
  networkSettings: {
    networks: Record<string, {
      networkId: string;
      ipAddress: string;
      gateway: string;
      macAddress: string;
    }>;
  };
  /** State */
  state: {
    running: boolean;
    paused: boolean;
    restarting: boolean;
    dead: boolean;
    pid: number;
    exitCode: number;
    startedAt: Date;
    finishedAt?: Date;
  };
}

/**
 * Docker image inspect result
 */
export interface ImageInspectResult {
  /** Image ID */
  id: string;
  /** Image tags */
  tags: string[];
  /** Created timestamp */
  created: Date;
  /** Size in bytes */
  size: number;
  /** Virtual size */
  virtualSize: number;
  /** Architecture */
  architecture: ImageArchitecture;
  /** Operating system */
  os: string;
  /** Layers */
  layers: string[];
  /** History */
  history: Array<{
    created: Date;
    createdBy: string;
    size: number;
    comment: string;
  }>;
}

/**
 * Docker log options
 */
export interface DockerLogOptions {
  /** Number of lines to tail */
  tail?: number;
  /** Follow log output */
  follow?: boolean;
  /** Show timestamps */
  timestamps?: boolean;
  /** Only return stderr logs */
  stderr?: boolean;
  /** Only return stdout logs */
  stdout?: boolean;
  /** Since timestamp (Unix timestamp) */
  since?: number;
  /** Until timestamp (Unix timestamp) */
  until?: number;
}

/**
 * Docker result wrapper
 *
 * Standard result type for Docker operations
 */
export interface DockerResult<T = unknown> {
  /** Whether operation succeeded */
  success: boolean;
  /** Result data if successful */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Operation duration in milliseconds */
  duration: number;
}

/**
 * Docker service health status
 */
export interface DockerHealthStatus {
  /** Whether container is healthy */
  healthy: boolean;
  /** Health check status */
  status: 'starting' | 'healthy' | 'unhealthy' | 'unknown';
  /** Number of consecutive failures */
  failingStreak: number;
  /** Last check timestamp */
  lastCheck: Date | null;
}

/**
 * Docker volume info
 */
export interface DockerVolume {
  /** Volume name */
  name: string;
  /** Driver name */
  driver: string;
  /** Mount point */
  mountpoint: string;
  /** Created timestamp */
  created: Date;
  /** Labels */
  labels: Record<string, string>;
}

/**
 * Docker network info
 */
export interface DockerNetwork {
  /** Network ID */
  id: string;
  /** Network name */
  name: string;
  /** Driver name */
  driver: string;
  /** Scope (local/global) */
  scope: string;
  /** Subnet */
  subnet?: string;
  /** Gateway */
  gateway?: string;
  /** Created timestamp */
  created: Date;
}

/**
 * Docker system info
 */
export interface DockerSystemInfo {
  /** Number of containers */
  containers: number;
  /** Number of running containers */
  containersRunning: number;
  /** Number of paused containers */
  containersPaused: number;
  /** Number of stopped containers */
  containersStopped: number;
  /** Number of images */
  images: number;
  /** Docker version */
  version: string;
  /** API version */
  apiVersion: string;
  /** Operating system */
  operatingSystem: string;
  /** Architecture */
  architecture: ImageArchitecture;
  /** Number of CPUs */
  cpus: number;
  /** Total memory in bytes */
  memory: number;
  /** Server hostname */
  serverName: string;
}
