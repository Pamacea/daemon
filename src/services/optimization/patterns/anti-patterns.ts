/**
 * Anti-Patterns Catalog
 *
 * Collection of known anti-patterns with detection rules,
 * severity levels, and recommended solutions.
 */

import type { AntiPattern } from '../optimization.types.js';

/**
 * React/Hooks Anti-Patterns
 */
const reactAntiPatterns: AntiPattern[] = [
  {
    id: 'react-missing-deps',
    name: 'Missing useEffect Dependencies',
    category: 'bug',
    description: 'useEffect is missing dependencies in its dependency array, which can cause stale closures or infinite loops',
    severity: 'high',
    pattern: /useEffect\s*\(\s*\(\)\s*=>\s*{[^}]*}\s*,\s*\[\s*\]\s*\)/gs,
    fix: 'Add all external values used inside the effect to the dependency array',
    badExample: `useEffect(() => {
  console.log(userId);
}, []);`,
    goodExample: `useEffect(() => {
  console.log(userId);
}, [userId]);`,
    resources: ['https://react.dev/reference/react/useEffect'],
  },
  {
    id: 'react-setstate-in-render',
    name: 'setState During Render',
    category: 'bug',
    description: 'Calling setState during render can cause infinite loops',
    severity: 'critical',
    pattern: /(?:useState|setState)\([^)]*\)\s*\([^)]*\)/s,
    fix: 'Move state update to useEffect or event handler',
    badExample: `function Component() {
  const [count, setCount] = useState(0);
  setCount(count + 1); // Infinite loop!
  return <div>{count}</div>;
}`,
    goodExample: `function Component() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(count + 1);
  }, []);
  return <div>{count}</div>;
}`,
  },
  {
    id: 'react-missing-memo',
    name: 'Missing React.memo on Expensive Component',
    category: 'performance',
    description: 'Component performs expensive computations on every render without memoization',
    severity: 'medium',
    pattern: /export\s+function\s+\w+\s*\([^)]*\)\s*{[\s\S]{500,}/s,
    fix: 'Wrap component in React.memo or use useMemo for expensive calculations',
    badExample: `export function ExpensiveList({ items }) {
  const sorted = items.sort((a, b) => a.value - b.value);
  const filtered = sorted.filter(i => i.active);
  return filtered.map(i => <Item key={i.id} {...i} />);
}`,
    goodExample: `export const ExpensiveList = React.memo(({ items }) => {
  const sorted = useMemo(() => [...items].sort((a, b) => a.value - b.value), [items]);
  const filtered = useMemo(() => sorted.filter(i => i.active), [sorted]);
  return filtered.map(i => <Item key={i.id} {...i} />);
});`,
  },
  {
    id: 'react-inline-function-in-loop',
    name: 'Inline Function in Loop',
    category: 'performance',
    description: 'Creating new functions on every iteration causes child re-renders',
    severity: 'medium',
    pattern: /{.*\.map\s*\([^)]*\)\s*=>\s*<[^>]+onClick={\s*\([^)]*\)\s*=>/s,
    fix: 'Move function outside component or use useCallback',
    badExample: `{items.map(item => (
  <Button onClick={() => handleClick(item.id)}>{item.name}</Button>
))}`,
    goodExample: `const handleItemClick = useCallback((id) => {
  handleClick(id);
}, [handleClick]);

{items.map(item => (
  <Button onClick={() => handleItemClick(item.id)}>{item.name}</Button>
))}`,
  },
];

/**
 * Security Anti-Patterns
 */
const securityAntiPatterns: AntiPattern[] = [
  {
    id: 'xss-innerhtml',
    name: 'XSS via innerHTML',
    category: 'bug',
    description: 'Using innerHTML with user input can lead to XSS attacks',
    severity: 'critical',
    pattern: /innerHTML\s*=\s*[^;]+/s,
    fix: 'Use textContent or sanitize input with DOMPurify',
    badExample: `element.innerHTML = userInput;`,
    goodExample: `element.textContent = userInput;
// OR
import DOMPurify from 'dompurify';
element.innerHTML = DOMPurify.sanitize(userInput);`,
    resources: ['https://owasp.org/www-community/attacks/xss/'],
  },
  {
    id: 'xss-dangerouslysetinnerhtml',
    name: 'React dangerouslySetInnerHTML',
    category: 'bug',
    description: 'Using dangerouslySetInnerHTML with unsanitized data',
    severity: 'high',
    pattern: /dangerouslySetInnerHTML\s*=\s*{\s*__html:\s*[^}]+\s*}/s,
    fix: 'Sanitize HTML with DOMPurify or use safe alternatives',
    badExample: `<div dangerouslySetInnerHTML={{ __html: userContent }} />`,
    goodExample: `import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userContent) }} />`,
  },
  {
    id: 'sql-injection-string-concat',
    name: 'SQL Injection via String Concatenation',
    category: 'bug',
    description: 'Building SQL queries with string concatenation is vulnerable to injection',
    severity: 'critical',
    pattern: /(?:SELECT|INSERT|UPDATE|DELETE)\s+.*?\+\s*[^;\s]+/gis,
    fix: 'Use parameterized queries or prepared statements',
    badExample: `const query = "SELECT * FROM users WHERE id = " + userId;`,
    goodExample: `const query = "SELECT * FROM users WHERE id = $1";
await db.query(query, [userId]);`,
    resources: ['https://owasp.org/www-community/attacks/SQL_Injection'],
  },
  {
    id: 'missing-input-validation',
    name: 'Missing Input Validation',
    category: 'bug',
    description: 'User input is used without validation',
    severity: 'high',
    pattern: /(?:req\.body|req\.query|req\.params|formData|URLSearchParams)\.[^;]+(?!\s*\.|!|\?|&&|\|\||typeof|instanceof)/s,
    fix: 'Validate input with a schema validator like Zod',
    badExample: `const email = req.body.email;
await sendEmail(email);`,
    goodExample: `const schema = z.object({ email: z.string().email() });
const { email } = schema.parse(req.body);
await sendEmail(email);`,
  },
];

/**
 * Memory Leak Anti-Patterns
 */
const memoryLeakPatterns: AntiPattern[] = [
  {
    id: 'missing-cleanup-useeffect',
    name: 'Missing useEffect Cleanup',
    category: 'bug',
    description: 'useEffect with subscriptions or timers lacks cleanup function',
    severity: 'high',
    pattern: /addEventListener\s*\([^)]*\)\s*(?!.*return\s*\(\s*=>\s*.*removeEventListener)|setInterval\s*\([^)]*\)\s*(?!.*return\s*\(\s*=>\s*.*clearInterval)|setTimeout\s*\([^)]*\)\s*(?!.*return\s*\(\s*=>\s*.*clearTimeout)/s,
    fix: 'Return a cleanup function from useEffect',
    badExample: `useEffect(() => {
  window.addEventListener('resize', handleResize);
}, []);`,
    goodExample: `useEffect(() => {
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);`,
  },
  {
    id: 'closure-in-setinterval',
    name: 'Stale Closure in setInterval',
    category: 'bug',
    description: 'setInterval captures stale state values due to closure',
    severity: 'high',
    pattern: /setInterval\s*\(\s*\(\)\s*=>\s*{[^}]*state[^}]*}\s*,/s,
    fix: 'Use useRef for state that needs to be accessed in intervals, or use setInterval with state updater function',
    badExample: `const [count, setCount] = useState(0);
useEffect(() => {
  const id = setInterval(() => {
    console.log(count); // Always 0
  }, 1000);
  return () => clearInterval(id);
}, []);`,
    goodExample: `const [count, setCount] = useState(0);
const countRef = useRef(count);
countRef.current = count;

useEffect(() => {
  const id = setInterval(() => {
    console.log(countRef.current);
  }, 1000);
  return () => clearInterval(id);
}, []);`,
  },
];

/**
 * Performance Anti-Patterns
 */
const performanceAntiPatterns: AntiPattern[] = [
  {
    id: 'n-plus-1-query',
    name: 'N+1 Query Problem',
    category: 'performance',
    description: 'Querying related data inside a loop causes N+1 database queries',
    severity: 'high',
    pattern: /for\s*\(?:(?:const|let|var)\s+\w+\s+of\s+[^)]+\)\s*{[\s\S]*?(?:await|\.then|exec|query)\s*\(/s,
    fix: 'Use eager loading, joins, or batch queries',
    badExample: `const posts = await db.post.findMany();
for (const post of posts) {
  post.author = await db.user.findUnique({ where: { id: post.authorId } });
}`,
    goodExample: `const posts = await db.post.findMany({
  include: { author: true }
});`,
  },
  {
    id: 'missing-usememo-computation',
    name: 'Expensive Computation Without useMemo',
    category: 'performance',
    description: 'Expensive calculation recalculates on every render',
    severity: 'medium',
    pattern: /const\s+\w+\s*=\s*(?:array|object)?\.?(?:sort|filter|reduce|map)\s*\([^)]+\)\s*(?:\.sort|\.filter|\.reduce|\.map)\s*\([^)]+\)/s,
    fix: 'Wrap expensive calculations in useMemo',
    badExample: `const sortedFiltered = items.filter(i => i.active).sort((a, b) => a.value - b.value);`,
    goodExample: `const sortedFiltered = useMemo(
  () => items.filter(i => i.active).sort((a, b) => a.value - b.value),
  [items]
);`,
  },
  {
    id: 'unnecessary-rerender-prop-change',
    name: 'Unnecessary Re-render from Prop Change',
    category: 'performance',
    description: 'Component re-renders because prop reference changes on every parent render',
    severity: 'medium',
    pattern: /<\w+\s+(?:on\w+|data-\w+)={\s*\([^)]*\)\s*=>/s,
    fix: 'Use useCallback for event handlers passed as props',
    badExample: `function Parent() {
  const [count, setCount] = useState(0);
  return <Child onClick={() => console.log(count)} />;
}`,
    goodExample: `function Parent() {
  const [count, setCount] = useState(0);
  const handleClick = useCallback(() => console.log(count), [count]);
  return <Child onClick={handleClick} />;
}`,
  },
  {
    id: 'large-bundle-chunk',
    name: 'Large Bundle Chunk',
    category: 'performance',
    description: 'Bundle contains large chunks that could be code-split',
    severity: 'medium',
    pattern: /{[\s\S]{500,}}/s, // General indicator, needs analysis
    fix: 'Use dynamic import for code splitting',
    badExample: `import { HeavyComponent } from './HeavyComponent';
<HeavyComponent />`,
    goodExample: `const HeavyComponent = lazy(() => import('./HeavyComponent'));
<Suspense fallback={<Loading />}>
  <HeavyComponent />
</Suspense>`,
  },
];

/**
 * Code Smell Anti-Patterns
 */
const codeSmellPatterns: AntiPattern[] = [
  {
    id: 'long-function',
    name: 'Long Function',
    category: 'code-smell',
    description: 'Function is too long and does too many things',
    severity: 'low',
    pattern: /function\s+\w+\s*\([^)]*\)\s*{[\s\S]{1000,}}/s,
    fix: 'Break function into smaller, single-purpose functions',
    badExample: `function processUserData(data) {
  // 50+ lines of processing...
}`,
    goodExample: `function processUserData(data) {
  const validated = validateData(data);
  const transformed = transformData(validated);
  return saveData(transformed);
}`,
  },
  {
    id: 'magic-number',
    name: 'Magic Number',
    category: 'code-smell',
    description: 'Unnamed numeric literal obscures meaning',
    severity: 'low',
    pattern: /[^a-zA-Z0-9](?:\d{2,}|0x[0-9A-Fa-f]+)[^a-zA-Z0-9]/s,
    fix: 'Extract to named constant',
    badExample: `if (status === 2) { ... }
setTimeout(callback, 86400000);`,
    goodExample: `const STATUS_ACTIVE = 2;
const MILLISECONDS_PER_DAY = 86400000;
if (status === STATUS_ACTIVE) { ... }
setTimeout(callback, MILLISECONDS_PER_DAY);`,
  },
  {
    id: 'deep-nesting',
    name: 'Deep Nesting',
    category: 'code-smell',
    description: 'Code is nested too deeply (arrow code)',
    severity: 'medium',
    pattern: /(?:if|for|while|try|function|=>)\s*\([^)]*\)\s*{[^}]{50}(?:if|for|while|try|function|=>)\s*\([^)]*\)\s*{[^}]{50}(?:if|for|while|try|function|=>)\s*\([^)]*\)\s*{/s,
    fix: 'Use early returns and guard clauses',
    badExample: `function process(data) {
  if (data) {
    if (data.items) {
      for (const item of data.items) {
        if (item.active) {
          if (item.valid) {
            // Process item
          }
        }
      }
    }
  }
}`,
    goodExample: `function process(data) {
  if (!data?.items) return;
  for (const item of data.items) {
    if (!item.active || !item.valid) continue;
    // Process item
  }
}`,
  },
  {
    id: 'god-object',
    name: 'God Object',
    category: 'code-smell',
    description: 'Class/object knows too much or does too much',
    severity: 'medium',
    pattern: /class\s+\w+\s*{[\s\S]{1000,}(?:public|private|protected)\s+\w+\s*\([^)]*\)[\s\S]{200,}(?:public|private|protected)\s+\w+\s*\([^)]*\)[\s\S]{200,}(?:public|private|protected)\s+\w+\s*\([^)]*\)/s,
    fix: 'Split into smaller, focused classes with single responsibility',
    badExample: `class UserManager {
  createUser() { /* ... */ }
  updateUser() { /* ... */ }
  deleteUser() { /* ... */ }
  sendEmail() { /* ... */ }
  generateReport() { /* ... */ }
  handlePayments() { /* ... */ }
  // 20+ more methods...
}`,
    goodExample: `class UserService {
  create() { /* ... */ }
  update() { /* ... */ }
  delete() { /* ... */ }
}
class EmailService {
  send() { /* ... */ }
}
class ReportService {
  generate() { /* ... */ }
}`,
  },
  {
    id: 'duplicated-code',
    name: 'Duplicated Code',
    category: 'code-smell',
    description: 'Same or very similar code appears in multiple places',
    severity: 'medium',
    pattern: '', // Requires cross-file analysis (detected separately)
    fix: 'Extract to a reusable function or component',
    badExample: `// File A
function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}
// File B
function checkEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}`,
    goodExample: `// utils/validation.js
export function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}
// Both files import and use isValidEmail`,
  },
];

/**
 * Async/Await Anti-Patterns
 */
const asyncAntiPatterns: AntiPattern[] = [
  {
    id: 'missing-await-promise',
    name: 'Missing await on Promise',
    category: 'bug',
    description: 'Promise is not awaited, potentially causing unhandled rejections',
    severity: 'high',
    pattern: /(?:const|let|var)\s+\w+\s*=\s*(?!await)(?:fetch|axios|request|\.query|\.exec|\.find)[(\s]/s,
    fix: 'Add await keyword or handle the Promise properly',
    badExample: `const data = fetchData();
console.log(data.results); // undefined!`,
    goodExample: `const data = await fetchData();
console.log(data.results);`,
  },
  {
    id: 'race-condition-state-update',
    name: 'Race Condition in State Update',
    category: 'bug',
    description: 'State update based on previous state without using updater function',
    severity: 'high',
    pattern: /setState\s*\(\s*\w+\s*\+\s*1\s*\)/s,
    fix: 'Use functional state updates',
    badExample: `const [count, setCount] = useState(0);
setCount(count + 1);
setCount(count + 1); // Both use same count value!`,
    goodExample: `const [count, setCount] = useState(0);
setCount(c => c + 1);
setCount(c => c + 1); // Correct sequential updates`,
  },
  {
    id: 'fire-and-forget-async',
    name: 'Fire and Forget Async',
    category: 'bug',
    description: 'Async function called without await, errors are silently ignored',
    severity: 'medium',
    pattern: /[a-zA-Z]\w*\s*\([^)]*\)\s*(?!.*(?:await|\.then|\.catch)\s*;)\s*;/s,
    fix: 'Await the promise or add error handling',
    badExample: `async function saveData() {
  await db.save(data);
}
saveData(); // Errors are ignored!`,
    goodExample: `async function saveData() {
  await db.save(data);
}
await saveData();
// OR
saveData().catch(console.error);`,
  },
  {
    id: 'missing-error-handling',
    name: 'Missing Error Handling',
    category: 'bug',
    description: 'Async operation lacks try/catch or .catch()',
    severity: 'high',
    pattern: /await\s+[\w\[\].]+(?:\([^)]*\))?(?!\s*(?:\?\s*\.|\.catch|try\s*{))/s,
    fix: 'Wrap in try/catch or add .catch()',
    badExample: `const data = await fetch(url);
const json = await data.json();`,
    goodExample: `try {
  const data = await fetch(url);
  const json = await data.json();
} catch (error) {
  console.error('Failed to fetch:', error);
}`,
  },
];

/**
 * All anti-patterns catalog
 */
export const ANTI_PATTERNS: AntiPattern[] = [
  ...reactAntiPatterns,
  ...securityAntiPatterns,
  ...memoryLeakPatterns,
  ...performanceAntiPatterns,
  ...codeSmellPatterns,
  ...asyncAntiPatterns,
];

/**
 * Get anti-patterns by category
 */
export function getAntiPatternsByCategory(
  category: 'bug' | 'performance' | 'code-smell'
): AntiPattern[] {
  return ANTI_PATTERNS.filter(p => p.category === category);
}

/**
 * Get anti-pattern by ID
 */
export function getAntiPatternById(id: string): AntiPattern | undefined {
  return ANTI_PATTERNS.find(p => p.id === id);
}

/**
 * Get anti-patterns by severity
 */
export function getAntiPatternsBySeverity(severity: 'critical' | 'high' | 'medium' | 'low'): AntiPattern[] {
  return ANTI_PATTERNS.filter(p => p.severity === severity);
}

/**
 * Check if code matches any anti-pattern
 */
export function findMatchingAntiPatterns(
  code: string,
  language?: string
): Array<{ pattern: AntiPattern; matches: string[] }> {
  const results: Array<{ pattern: AntiPattern; matches: string[] }> = [];

  for (const pattern of ANTI_PATTERNS) {
    if (typeof pattern.pattern === 'string' && pattern.pattern) {
      const regex = new RegExp(pattern.pattern);
      const matches = code.match(regex);
      if (matches) {
        results.push({ pattern, matches: matches.filter(m => m) as string[] });
      }
    } else if (pattern.pattern instanceof RegExp) {
      const matches = code.match(pattern.pattern);
      if (matches) {
        results.push({ pattern, matches: matches.filter(m => m) as string[] });
      }
    }
  }

  return results;
}
