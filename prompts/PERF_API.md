# Performance Test Guide (k6)

This prompt is included by EXECUTE.md. It provides detailed guidance for API performance testing.

---

## k6 Setup

```javascript
// tests/performance/lib/config.js
export const config = {
  BASE_URL: __ENV.BASE_URL || 'http://host.docker.internal:3000',
  TIMEOUT: '30s',
};
```

---

## Load Testing Patterns

### Basic Load Test

```javascript
// tests/performance/scenarios/basic-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom error rate
const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 10 },    // Stay at 10 users
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '2m', target: 50 },    // Stay at 50 users
    { duration: '30s', target: 100 },  // Spike to 100 users
    { duration: '1m', target: 100 },   // Stay at 100 users
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.05'],
  },
};

const BASE_URL = 'http://host.docker.internal:3000';

export default function () {
  // Test homepage
  let res = http.get(`${BASE_URL}/`);
  check(res, {
    'homepage status 200': (r) => r.status === 200,
    'homepage response time < 200ms': (r) => r.timings.duration < 200,
  }) || errorRate.add(1);

  sleep(1);

  // Test API
  res = http.get(`${BASE_URL}/api/users`);
  check(res, {
    'users API status 200': (r) => r.status === 200,
    'users response time < 200ms': (r) => r.timings.duration < 200,
  }) || errorRate.add(1);

  sleep(1);
}

export function handleSummary(data) {
  return {
    'stdout': JSON.stringify(data, null, 2),
  };
}
```

### Stress Test

```javascript
// tests/performance/scenarios/stress.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up to 100
    { duration: '5m', target: 100 },  // Stay at 100
    { duration: '2m', target: 200 },  // Ramp to 200
    { duration: '5m', target: 200 },  // Stay at 200
    { duration: '2m', target: 300 },  // Ramp to 300
    { duration: '5m', target: 300 },  // Stay at 300
    { duration: '10m', target: 0 },   // Recovery
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.05'],  // Allow more errors during stress
  },
};

const BASE_URL = 'http://host.docker.internal:3000';

export default function () {
  const responses = http.batch([
    ['GET', `${BASE_URL}/api/users`],
    ['GET', `${BASE_URL}/api/posts`],
    ['GET', `${BASE_URL}/api/comments`],
  ]);

  responses.forEach((res) => {
    check(res, {
      'status 200': (r) => r.status === 200,
      'not rate limited': (r) => r.status !== 429,
    });
  });

  sleep(1);
}
```

### Spike Test

```javascript
// tests/performance/scenarios/spike.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Normal load
    { duration: '10s', target: 500 }, // Sudden spike!
    { duration: '2m', target: 500 },  // Stay at spike
    { duration: '2m', target: 10 },   // Recovery
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.10'],  // Allow some failures during spike
  },
};

const BASE_URL = 'http://host.docker.internal:3000';

export default function () {
  const res = http.get(`${BASE_URL}/api/users`);
  check(res, {
    'status acceptable': (r) => r.status < 500,
  });
}
```

---

## API Endpoint Testing

### CRUD Operations

```javascript
// tests/performance/scenarios/api-crud.js
import http from 'k6/http';
import { check, group } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export const options = {
  stages: [
    { duration: '1m', target: 20 },
    { duration: '3m', target: 20 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'],
  },
};

const BASE_URL = 'http://host.docker.internal:3000';

export default function () {
  const headers = { 'Content-Type': 'application/json' };

  group('Create', () => {
    const payload = JSON.stringify({
      email: `${randomString(10)}@example.com`,
      name: randomString(10),
    });

    const res = http.post(`${BASE_URL}/api/users`, payload, { headers });

    check(res, {
      'create status 201': (r) => r.status === 201,
      'create response time < 300ms': (r) => r.timings.duration < 300,
    });
  });

  group('Read', () => {
    const res = http.get(`${BASE_URL}/api/users`);

    check(res, {
      'read status 200': (r) => r.status === 200,
      'read has data': (r) => JSON.parse(r.body).users.length > 0,
    });
  });

  group('Update', () => {
    const payload = JSON.stringify({ name: randomString(10) });
    const res = http.patch(`${BASE_URL}/api/users/1`, payload, { headers });

    check(res, {
      'update status 200': (r) => r.status === 200,
    });
  });

  group('Delete', () => {
    const res = http.del(`${BASE_URL}/api/users/1`);

    check(res, {
      'delete status 204': (r) => r.status === 204,
    });
  });
}
```

### Authenticated Requests

```javascript
// tests/performance/scenarios/authenticated.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 30 },
    { duration: '3m', target: 30 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<250'],
  },
};

const BASE_URL = 'http://host.docker.internal:3000';

// Get auth token (run once per VU)
let authToken;

export function setup() {
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: 'test@example.com',
    password: 'password123',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  return { token: loginRes.json('token') };
}

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.token}`,
  };

  const res = http.get(`${BASE_URL}/api/protected`, { headers });

  check(res, {
    'status 200': (r) => r.status === 200,
    'has data': (r) => JSON.parse(r.body).data !== undefined,
  });
}
```

---

## Scenario Testing

### User Journey

```javascript
// tests/performance/scenarios/user-journey.js
import http from 'k6/http';
import { check, group } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 50 },
    { duration: '5m', target: 50 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<400'],
  },
};

const BASE_URL = 'http://host.docker.internal:3000';

export default function () {
  group('Browse Homepage', () => {
    const res = http.get(`${BASE_URL}/`);
    check(res, { 'homepage OK': (r) => r.status === 200 });
  });

  group('Search Products', () => {
    const res = http.get(`${BASE_URL}/api/products?search=test`);
    check(res, {
      'search OK': (r) => r.status === 200,
      'has results': (r) => JSON.parse(r.body).products.length > 0,
    });
  });

  group('View Product', () => {
    const res = http.get(`${BASE_URL}/products/1`);
    check(res, {
      'product OK': (r) => r.status === 200,
      'has price': (r) => JSON.parse(r.body).price !== undefined,
    });
  });

  group('Add to Cart', () => {
    const res = http.post(`${BASE_URL}/api/cart/items`, JSON.stringify({
      productId: 1,
      quantity: 1,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

    check(res, {
      'added to cart': (r) => r.status === 201,
    });
  });
}
```

---

## Data Management Tests

### Concurrent Writes

```javascript
// tests/performance/scenarios/concurrent-writes.js
import http from 'k6/http';
import { check } from 'k6';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export const options = {
  scenarios: {
    concurrent_writes: {
      executor: 'constant-vus',
      vus: 50,
      duration: '2m',
      gracefulStop: '10s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.02'],
  },
};

const BASE_URL = 'http://host.docker.internal:3000';

export default function () {
  const userId = randomIntBetween(1, 1000);
  const payload = JSON.stringify({
    userId,
    action: 'update',
    timestamp: Date.now(),
  });

  const res = http.post(`${BASE_URL}/api/actions`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'write successful': (r) => r.status === 201 || r.status === 200,
    'no conflict': (r) => r.status !== 409,
  });
}
```

### Cache Performance

```javascript
// tests/performance/scenarios/cache.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '3m', target: 10 },
    { duration: '1m', target: 0 },
  ],
};

const BASE_URL = 'http://host.docker.internal:3000';
const ENDPOINT = '/api/users';

export default function () {
  // First request (cache miss expected)
  const miss = http.get(`${BASE_URL}${ENDPOINT}`);

  check(miss, {
    'miss status OK': (r) => r.status === 200,
    'miss time < 500ms': (r) => r.timings.duration < 500,
  });

  // Second request (cache hit expected)
  const hit = http.get(`${BASE_URL}${ENDPOINT}`);

  check(hit, {
    'hit status OK': (r) => r.status === 200,
    'hit faster than miss': (r) => r.timings.duration < miss.timings.duration,
    'hit time < 100ms': (r) => r.timings.duration < 100,
  });
}
```

---

## Running Performance Tests

```bash
# Run basic load test
docker exec daemon-tools k6 run tests/performance/scenarios/basic-load.js

# Run with environment variables
docker exec daemon-tools k6 run -e BASE_URL=http://host.docker.internal:3000 tests/performance/scenarios/basic-load.js

# Run with output file
docker exec daemon-tools k6 run --out json=results.json tests/performance/scenarios/basic-load.js

# Run specific stage
docker exec daemon-tools k6 run --execution-segment "0:2m,5m:8m" tests/performance/scenarios/basic-load.js
```
