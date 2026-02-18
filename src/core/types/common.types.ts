/**
 * Common Types
 *
 * Shared utility types used across the codebase.
 */

/**
 * Result type for operations that can fail
 *
 * Alternative to exceptions for error handling
 */
export type Result<T, E = Error> =
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: E };

/**
 * Extract success type from Result
 */
export type SuccessType<R extends Result<unknown, unknown>> =
  R extends Result<infer T, unknown> ? T : never;

/**
 * Extract error type from Result
 */
export type ErrorType<R extends Result<unknown, unknown>> =
  R extends Result<unknown, infer E> ? E : never;

/**
 * Options base type
 *
 * Base interface for all options objects
 */
export interface BaseOptions {
  /** Enable verbose logging */
  verbose?: boolean;
  /** Operation timeout in milliseconds */
  timeout?: number;
}

/**
 * Async result promise type
 */
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

/**
 * Maybe type - value or null/undefined
 */
export type Maybe<T> = T | null | undefined;

/**
 * Nullable type - value or null
 */
export type Nullable<T> = T | null;

/**
 * Optional type - value or undefined
 */
export type Optional<T> = T | undefined;

/**
 * Deep partial type
 *
 * Makes all nested properties optional
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object
    ? DeepPartial<T[P]>
    : T[P];
};

/**
 * Deep readonly type
 *
 * Makes all nested properties readonly
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object
    ? DeepReadonly<T[P]>
    : T[P];
};

/**
 * Deep required type
 *
 * Makes all nested properties required
 */
export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object
    ? DeepRequired<T[P]>
    : T[P];
};

/**
 * ValueOf type
 *
 * Extracts union type of object values
 */
export type ValueOf<T> = T[keyof T];

/**
 * Tuple type
 *
 * Creates a tuple type from an array
 */
export type Tuple<T, N extends number> = N extends N
  ? number extends N
    ? T[]
    : _TupleOf<T, N, []>
  : never;

/** @internal */
type _TupleOf<T, N extends number, R extends unknown[]> = R['length'] extends N
  ? R
  : _TupleOf<T, N, [...R, T]>;

/**
 * Enum values type
 *
 * Extracts union of enum values
 */
export type EnumValues<T> = T[keyof T];

/**
 * Make required type
 *
 * Makes specified properties required
 */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Make optional type
 *
 * Makes specified properties optional
 */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Equality comparison type
 *
 * Types that can be compared with ===
 */
export type Comparable = string | number | boolean | symbol | null | undefined;

/**
 * Async function type
 *
 * Type for async functions with specific parameters and return
 */
export type AsyncFunction<TArgs extends unknown[] = unknown[], TReturn = unknown> =
  (...args: TArgs) => Promise<TReturn>;

/**
 * Sync function type
 *
 * Type for sync functions with specific parameters and return
 */
export type SyncFunction<TArgs extends unknown[] = unknown[], TReturn = unknown> =
  (...args: TArgs) => TReturn;

/**
 * Any function type
 */
export type AnyFunction<TArgs extends unknown[] = unknown[], TReturn = unknown> =
  | AsyncFunction<TArgs, TReturn>
  | SyncFunction<TArgs, TReturn>;

/**
 * Constructor type
 *
 * Type for class constructors
 */
export type Constructor<T = object, TArgs extends unknown[] = any[]> =
  new (...args: TArgs) => T;

/**
 * Abstract constructor type
 *
 * Type for abstract class constructors
 */
export type AbstractConstructor<T = object, TArgs extends unknown[] = any[]> =
  abstract new (...args: TArgs) => T;

/**
 * Class type
 *
 * Type for class (constructor + static methods)
 */
export type Class<T = object> = Constructor<T> & { prototype: T };

/**
 * Mutable type
 *
 * Converts readonly properties to mutable
 */
export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

/**
 * Prettify type
 *
 * Improves type display in IDEs
 */
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

/**
 * Event listener type
 */
export type EventListener<TEvent = unknown> = (event: TEvent) => void;

/**
 * Observer type for reactive patterns
 */
export type Observer<T> = {
  next: (value: T) => void;
  error?: (err: unknown) => void;
  complete?: () => void;
};

/**
 * Observable type for reactive patterns
 */
export type Observable<T> = {
  subscribe: (observer: Observer<T>) => {
    unsubscribe: () => void;
  };
};

/**
 * Retry options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxAttempts?: number;
  /** Initial delay in milliseconds */
  initialDelay?: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier?: number;
  /** Maximum delay between attempts */
  maxDelay?: number;
  /** Whether to jitter the delay */
  jitter?: boolean;
  /** Callback to determine if error is retryable */
  retryable?: (error: unknown) => boolean;
}

/**
 * Throttle options
 */
export interface ThrottleOptions {
  /** Throttle delay in milliseconds */
  delay: number;
  /** Whether to call leading edge */
  leading?: boolean;
  /** Whether to call trailing edge */
  trailing?: boolean;
}

/**
 * Debounce options
 */
export interface DebounceOptions {
  /** Debounce delay in milliseconds */
  delay: number;
  /** Maximum wait time */
  maxWait?: number;
  /** Whether to call leading edge */
  leading?: boolean;
}

/**
 * Progress callback type
 */
export type ProgressCallback<TProgress = number> = (
  progress: TProgress,
  total?: TProgress
) => void;

/**
 * Progress result type
 */
export interface ProgressResult<TData = unknown, TProgress = number> {
  /** Result data (available on completion) */
  data?: TData;
  /** Current progress value */
  progress: TProgress;
  /** Total value for progress calculation */
  total: TProgress;
  /** Whether operation is complete */
  isComplete: boolean;
  /** Whether operation failed */
  isFailed: boolean;
  /** Error if failed */
  error?: unknown;
}
