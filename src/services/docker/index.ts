/**
 * Docker Service Module
 *
 * Service de gestion des conteneurs Docker pour Daemon.
 *
 * @module services/docker
 */

export {
  DockerManager,
  dockerManager,
  type BuildOptions,
  type BuildResult,
  type SetupOptions,
  type SetupResult,
  type SetupStatus,
} from './docker-manager.js';
