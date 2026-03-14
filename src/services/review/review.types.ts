/**
 * Review & Fix Types
 *
 * Types pour le service de review et correction automatique de code.
 * Fournit des interfaces pour l'analyse statique, la sécurité,
 * les dépendances, les performances et les corrections.
 *
 * @module services/review/review.types
 */

/**
 * Catégories d'issues détectables
 */
export type IssueCategory =
  | 'static'
  | 'security'
  | 'dependency'
  | 'performance'
  | 'testing'
  | 'code-quality'
  | 'documentation';

/**
 * Sévérité des issues
 */
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Localisation d'une issue dans le code
 */
export interface Location {
  /** Chemin du fichier */
  file: string;
  /** Ligne de début (1-based) */
  line: number;
  /** Colonne de début (1-based) */
  column?: number;
  /** Ligne de fin */
  endLine?: number;
  /** Colonne de fin */
  endColumn?: number;
}

/**
 * Issue détectée lors de l'analyse
 */
export interface Issue {
  /** Identifiant unique de l'issue */
  id: string;
  /** Catégorie de l'issue */
  category: IssueCategory;
  /** Sévérité de l'issue */
  severity: IssueSeverity;
  /** Description de l'issue */
  description: string;
  /** Message détaillé */
  message?: string;
  /** Localisation dans le code */
  location: Location;
  /** Code source concerné */
  code?: string;
  /** L'issue peut être corrigée automatiquement */
  fixable: boolean;
  /** Effort de correction estimé (1-10) */
  effort: number;
  /** Règle ou analyseur à l'origine */
  ruleId?: string;
  /** Liens vers la documentation */
  docs?: string[];
  /** Suggestions de correction */
  suggestions?: string[];
}

/**
 * Résultat d'une correction appliquée
 */
export interface Fix {
  /** Identifiant de l'issue corrigée */
  issueId: string;
  /** La correction a été appliquée */
  applied: boolean;
  /** Correction automatique ou manuelle */
  automatic: boolean;
  /** Description de la correction */
  description: string;
  /** Fichiers modifiés */
  filesChanged: string[];
  /** Diff de la correction */
  diff?: string;
  /** Erreur si la correction a échoué */
  error?: string;
}

/**
 * Suggestion de refactoring
 */
export interface Suggestion {
  /** Identifiant unique */
  id: string;
  /** Type de suggestion */
  type: 'refactor' | 'optimization' | 'pattern' | 'naming' | 'extraction';
  /** Priorité (1-10) */
  priority: number;
  /** Titre de la suggestion */
  title: string;
  /** Description détaillée */
  description: string;
  /** Localisation */
  location: Location;
  /** Exemple de code avant */
  before?: string;
  /** Exemple de code après */
  after?: string;
  /** Bénéfices attendus */
  benefits?: string[];
  /** Effort d'implémentation (1-10) */
  effort: number;
}

/**
 * Score de qualité du projet
 */
export interface ProjectScore {
  /** Score global (0-100) */
  overall: number;
  /** Score par catégorie */
  categories: {
    static: number;
    security: number;
    dependency: number;
    performance: number;
    testing: number;
    codeQuality: number;
    documentation: number;
  };
  /** Évolution par rapport au précédent scan */
  delta?: number;
  /** Nombre d'issues par sévérité */
  issueCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
}

/**
 * Statistiques de couverture de tests
 */
export interface CoverageStats {
  /** Pourcentage de lignes couvertes */
  lines: number;
  /** Pourcentage de branches couvertes */
  branches: number;
  /** Pourcentage de fonctions couvertes */
  functions: number;
  /** Pourcentage de statements couverts */
  statements: number;
  /** Nombre total de lignes */
  totalLines: number;
  /** Nombre de lignes couvertes */
  coveredLines: number;
}

/**
 * Informations sur une dépendance
 */
export interface DependencyInfo {
  /** Nom du package */
  name: string;
  /** Version actuelle */
  version: string;
  /** Dernière version disponible */
  latest?: string;
  /** Version vulnérable si applicable */
  vulnerableVersions?: string[];
  /** Sévérité des vulnérabilités */
  vulnerabilitySeverity?: 'critical' | 'high' | 'medium' | 'low';
  /** Licence */
  license?: string;
  /** Type de dépendance */
  type: 'dependencies' | 'devDependencies' | 'peerDependencies';
  /** Est utilisée dans le code */
  isUsed: boolean;
  /** Taille du package */
  size?: number;
}

/**
 * Résultat d'analyse de dépendances
 */
export interface DependencyAnalysis {
  /** Dépendances obsolètes */
  outdated: DependencyInfo[];
  /** Dépendances vulnérables */
  vulnerable: DependencyInfo[];
  /** Dépendances non utilisées */
  unused: DependencyInfo[];
  /** Dépendances en double */
  duplicates: Array<{
    name: string;
    versions: string[];
  }>;
  /** Problèmes de licence */
  licenseIssues: Array<{
    name: string;
    license: string;
    issue: string;
  }>;
}

/**
 * Métriques de performance
 */
export interface PerformanceMetrics {
  /** Taille estimée du bundle */
  bundleSize?: {
    js: number;
    css: number;
    total: number;
  };
  /** Impact du lazy loading */
  lazyLoadingOpportunities: number;
  /** Composants avec re-renders inutiles */
  unnecessaryRerenders: number;
  /** Requêtes N+1 détectées */
  nPlusOneQueries: Array<{
    file: string;
    line: number;
    description: string;
  }>;
  /** Index manquants */
  missingIndexes: Array<{
    table: string;
    column: string;
    query: string;
  }>;
  /** Lazy components detected */
  lazyComponents: string[];
}

/**
 * Options de review
 */
export interface ReviewOptions {
  /** Analyser uniquement certaines catégories */
  categories?: IssueCategory[];
  /** Niveau de sévérité minimum */
  minSeverity?: IssueSeverity;
  /** Exclure certains fichiers/chemins */
  exclude?: string[];
  /** Inclure uniquement certains fichiers/chemins */
  include?: string[];
  /** Nombre maximum de fichiers à analyser */
  maxFiles?: number;
  /** Activer/désactiver les analyseurs */
  analyzers?: {
    static?: boolean;
    security?: boolean;
    dependency?: boolean;
    performance?: boolean;
    testing?: boolean;
  };
  /** Timeout pour l'analyse (ms) */
  timeout?: number;
  /** Utiliser le cache des résultats */
  useCache?: boolean;
  /** Comparer avec le scan précédent */
  compareWithPrevious?: boolean;
}

/**
 * Options de correction
 */
export interface FixOptions {
  /** Appliquer automatiquement les corrections sûres */
  autoApply?: boolean;
  /** Catégories à corriger */
  categories?: IssueCategory[];
  /** Sévérité maximum à corriger automatiquement */
  maxSeverity?: IssueSeverity;
  /** Effort maximum de correction */
  maxEffort?: number;
  /** Créer un backup avant correction */
  createBackup?: boolean;
  /** Générer les tests manquants */
  generateTests?: boolean;
  /** Mode dry-run (simulation) */
  dryRun?: boolean;
  /** Ignorer certaines issues */
  ignore?: string[];
}

/**
 * Résultat complet d'un review
 */
export interface ReviewResult {
  /** Chemin du projet analysé */
  projectPath: string;
  /** Timestamp de l'analyse */
  timestamp: Date;
  /** Durée de l'analyse (ms) */
  duration: number;
  /** Score de qualité */
  score: ProjectScore;
  /** Liste des issues détectées */
  issues: Issue[];
  /** Corrections appliquées */
  fixes: Fix[];
  /** Suggestions de refactoring */
  suggestions: Suggestion[];
  /** Statistiques de couverture */
  coverage?: CoverageStats;
  /** Analyse des dépendances */
  dependencies?: DependencyAnalysis;
  /** Métriques de performance */
  performance?: PerformanceMetrics;
  /** Résumé de l'analyse */
  summary: {
    totalIssues: number;
    fixableIssues: number;
    fixedIssues: number;
    suggestions: number;
  };
  /** Hash du contenu pour comparaison */
  contentHash?: string;
}

/**
 * Résultat d'une opération de fix
 */
export interface FixResult {
  /** Succès de l'opération */
  success: boolean;
  /** Nombre de corrections tentées */
  attempted: number;
  /** Nombre de corrections appliquées */
  applied: number;
  /** Nombre de corrections échouées */
  failed: number;
  /** Liste des corrections */
  fixes: Fix[];
  /** Suggestions restantes */
  remainingSuggestions: Suggestion[];
  /** Durée de l'opération */
  duration: number;
  /** Erreur globale si échec */
  error?: string;
}

/**
 * Format d'export du rapport
 */
export type ReportFormat = 'json' | 'html' | 'markdown' | 'console';

/**
 * Options de génération de rapport
 */
export interface ReportOptions {
  /** Format de sortie */
  format: ReportFormat;
  /** Chemin de sortie du fichier */
  outputPath?: string;
  /** Inclure les suggestions */
  includeSuggestions?: boolean;
  /** Inclure le diff des corrections */
  includeDiff?: boolean;
  /** Niveau de détail */
  verbosity?: 'summary' | 'normal' | 'detailed';
  /** Comparer avec le scan précédent */
  showDelta?: boolean;
}

/**
 * Configuration de l'analyseur statique
 */
export interface StaticAnalyzerConfig {
  /** Utiliser ESLint */
  useEslint?: boolean;
  /** Utiliser le compilateur TypeScript */
  useTsc?: boolean;
  /** Détecter les imports inutilisés */
  detectUnusedImports?: boolean;
  /** Détecter les variables inutilisées */
  detectUnusedVars?: boolean;
  /** Détecter le code mort */
  detectDeadCode?: boolean;
  /** Configuration ESLint personnalisée */
  eslintConfig?: string;
}

/**
 * Configuration de l'analyseur de sécurité
 */
export interface SecurityAnalyzerConfig {
  /** Activer la détection OWASP Top 10 */
  owaspTop10?: boolean;
  /** Détecter les injections SQL */
  sqlInjection?: boolean;
  /** Détecter les XSS */
  xss?: boolean;
  /** Détecter les CSRF */
  csrf?: boolean;
  /** Vérifier l'auth/authorization */
  authIssues?: boolean;
  /** Détecter les données sensibles exposées */
  sensitiveData?: boolean;
}

/**
 * Configuration de l'analyseur de dépendances
 */
export interface DependencyAnalyzerConfig {
  /** Vérifier les versions obsolètes */
  checkOutdated?: boolean;
  /** Vérifier les vulnérabilités */
  checkVulnerabilities?: boolean;
  /** Détecter les dépendances non utilisées */
  detectUnused?: boolean;
  /** Détecter les doublons */
  detectDuplicates?: boolean;
  /** Vérifier les licences */
  checkLicenses?: boolean;
  /** Licenses autorisées */
  allowedLicenses?: string[];
}

/**
 * Configuration de l'analyseur de performance
 */
export interface PerformanceAnalyzerConfig {
  /** Analyser la taille du bundle */
  analyzeBundleSize?: boolean;
  /** Détecter les opportunités de lazy loading */
  detectLazyOpportunities?: boolean;
  /** Détecter les re-renders React */
  detectRerenders?: boolean;
  /** Détecter les requêtes N+1 */
  detectNPlusOne?: boolean;
  /** Détecter les index manquants */
  detectMissingIndexes?: boolean;
}

/**
 * Test généré
 */
export interface GeneratedTest {
  /** Chemin du fichier de test */
  filePath: string;
  /** Contenu du test */
  content: string;
  /** Type de test */
  type: 'unit' | 'integration' | 'e2e';
  /** Pourcentage de couverture estimé */
  estimatedCoverage?: number;
}

/**
 * Résultat de la génération de tests
 */
export interface TestGenerationResult {
  /** Tests générés avec succès */
  generated: GeneratedTest[];
  /** Tests qui n'ont pas pu être générés */
  failed: Array<{
    filePath: string;
    reason: string;
  }>;
  /** Couverture totale estimée */
  totalCoverage?: CoverageStats;
}
