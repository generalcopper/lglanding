import http from 'node:http';
import { createHandler, postmarkSender } from './handler.js';
import { createStore } from './store.js';

const token = process.env.POSTMARK_SERVER_TOKEN?.trim();
if (!token || token === 'POSTMARK_API_TEST') throw new Error('Production Postmark token is required');
const project = process.env.GOOGLE_CLOUD_PROJECT;
const database = process.env.CONTACT_DATABASE;
if (!project) throw new Error('Google Cloud project must be explicitly configured');

const server = http.createServer(createHandler({
  store: createStore(project, database),
  send: postmarkSender(token, fetch, process.env.CONTACT_FROM_EMAIL || 'info@lgtrading.it'),
  hashSecret: token,
  version: process.env.CONTACT_RELEASE || 'development'
}));
server.requestTimeout = 25000;
server.headersTimeout = 10000;
server.listen(Number(process.env.PORT || 8080), '0.0.0.0');
process.on('SIGTERM', () => server.close());
