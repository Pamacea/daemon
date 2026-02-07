import http from 'k6/http';
import { check, sleep } from 'k6';

// Configuration
export const options = {
  stages: [
    { duration: '30s', target: 20 },   // Ramp up to 20 users
    { duration: '1m', target: 20 },    // Stay at 20 users
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '1m', target: 50 },    // Stay at 50 users
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://host.docker.internal:3000';

export default function () {
  // Test homepage
  let res = http.get(`${BASE_URL}/`);
  check(res, {
    'homepage status 200': (r) => r.status === 200,
    'homepage response time < 200ms': (r) => r.timings.duration < 200,
  });

  sleep(1);

  // Test API endpoint
  res = http.get(`${BASE_URL}/api/users`);
  check(res, {
    'users API status 200': (r) => r.status === 200,
    'users response time < 200ms': (r) => r.timings.duration < 200,
  });

  sleep(1);

  // Test POST endpoint
  res = http.post(`${BASE_URL}/api/contact`, JSON.stringify({
    name: 'Test User',
    email: 'test@example.com',
    message: 'Test message',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'contact API status 200': (r) => r.status === 200,
  });

  sleep(1);
}
