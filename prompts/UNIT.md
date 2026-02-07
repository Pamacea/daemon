# Unit Test Generation Guide

This prompt is included by EXECUTE.md. It provides detailed guidance for generating unit tests.

---

## Component Test Patterns

### Presentational Components

```typescript
// Button component test
describe('Button', () => {
  it('should render with default props', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('should apply variant classes', () => {
    render(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-danger');
  });

  it('should be disabled when loading', () => {
    render(<Button loading>Submit</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });
});
```

### Container Components

```typescript
// UserList component test
describe('UserList', () => {
  it('should show loading state', () => {
    vi.mocked(useUsers).mockReturnValue({ data: null, loading: true });
    render(<UserList />);
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('should show error state', () => {
    vi.mocked(useUsers).mockReturnValue({
      data: null,
      loading: false,
      error: new Error('Failed to fetch')
    });
    render(<UserList />);
    expect(screen.getByText('Failed to fetch')).toBeInTheDocument();
  });

  it('should render users', () => {
    vi.mocked(useUsers).mockReturnValue({
      data: [{ id: '1', name: 'John' }],
      loading: false,
      error: null
    });
    render(<UserList />);
    expect(screen.getByText('John')).toBeInTheDocument();
  });
});
```

---

## Hook Test Patterns

```typescript
import { renderHook, act, waitFor } from '@testing-library/react';

describe('useDebounce', () => {
  vi.useFakeTimers();

  it('should debounce value changes', async () => {
    const { result } = renderHook(() => useDebounce('test', 500));

    // Immediate value
    expect(result.current).toBe('test');

    // Change value immediately
    act(() => {
      result.current.setValue('test2');
    });
    expect(result.current.value).toBe('test'); // Not debounced yet

    // Fast-forward
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.value).toBe('test2');
  });
});
```

---

## Utility Function Patterns

```typescript
describe('formatCurrency', () => {
  it('should format positive numbers', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('should format zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('should handle negative numbers', () => {
    expect(formatCurrency(-100)).toBe('-$100.00');
  });

  it('should round to 2 decimal places', () => {
    expect(formatCurrency(1.999)).toBe('$2.00');
  });
});
```

---

## Validator Test Patterns (Zod)

```typescript
import { z } from 'zod';
import { userSchema } from './schema';

describe('userSchema', () => {
  const validData = {
    email: 'test@example.com',
    age: 25,
    name: 'John Doe'
  };

  it('should accept valid data', () => {
    expect(() => userSchema.parse(validData)).not.toThrow();
  });

  it('should reject invalid email', () => {
    expect(() =>
      userSchema.parse({ ...validData, email: 'invalid' })
    ).toThrow(z.ZodError);
  });

  it('should reject negative age', () => {
    expect(() =>
      userSchema.parse({ ...validData, age: -1 })
    ).toThrow(z.ZodError);
  });

  it('should reject missing required fields', () => {
    expect(() => userSchema.parse({})).toThrow(z.ZodError);
  });
});
```

---

## Store Test Patterns (Zustand)

```typescript
import { create } from 'zustand';
import { useAuthStore } from './authStore';

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
  });

  it('should set user on login', () => {
    const user = { id: '1', name: 'John' };
    useAuthStore.getState().login(user);
    expect(useAuthStore.getState().user).toEqual(user);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('should clear user on logout', () => {
    useAuthStore.getState().login({ id: '1', name: 'John' });
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
```

---

## Mock Patterns

### Mocking React Query

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
}

function Wrapper({ children }) {
  return (
    <QueryClientProvider client={createTestQueryClient()}>
      {children}
    </QueryClientProvider>
  );
}

describe('MyComponent', () => {
  it('should work with React Query', () => {
    render(<MyComponent />, { wrapper: Wrapper });
  });
});
```

### Mocking Next.js Router

```typescript
import { useRouter } from 'next/navigation';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    pathname: '/test'
  }),
  useSearchParams: () => new URLSearchParams('foo=bar'),
  usePathname: () => '/test'
}));
```

### Mocking Fetch

```typescript
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ data: 'test' })
  })
) as ReturnType<typeof vi.fn>;

// Or use MSW for more complex scenarios
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  http.get('/api/users', () => {
    return HttpResponse.json({ users: [] });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```
