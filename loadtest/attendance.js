import http from 'k6/http';
import { check, sleep } from 'k6';

// Matches APP_PORT in infra/.env, which the prod webserver container publishes to.
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const CLASS_ID = __ENV.CLASS_ID || 1;

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 150 },
    { duration: '1m', target: 300 },
    { duration: '1m', target: 500 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const readRes = http.get(`${BASE_URL}/api/v1/classes/${CLASS_ID}/attendees`);
  check(readRes, { 'read 200': (r) => r.status === 200 });

  sleep(0.5);
}
