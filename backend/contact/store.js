import { Firestore, Timestamp } from '@google-cloud/firestore';
import { ContactError } from './handler.js';

export function createStore(projectId, databaseId) {
  if (!projectId || databaseId !== 'lgtrading-contacts') throw new Error('An isolated contact database is required');
  const db = new Firestore({ projectId, databaseId, preferRest: true });
  const requests = db.collection('contactRequests');
  const limits = db.collection('contactRateLimits');
  return {
    async reserve(id, emailHash, now) {
      const request = requests.doc(id);
      const hour = Math.floor(now / 3600000);
      const perEmail = limits.doc('email-' + emailHash + '-' + hour);
      const global = limits.doc('site-' + hour);
      return db.runTransaction(async (tx) => {
        const [existing, emailRate, siteRate] = await tx.getAll(request, perEmail, global);
        const previous = existing.data();
        if (previous && previous.expiresAt.toMillis() > now && previous.state !== 'failed') {
          return previous.state;
        }
        const emailCount = emailRate.data()?.count || 0;
        const siteCount = siteRate.data()?.count || 0;
        if (emailCount >= 3 || siteCount >= 30) throw new ContactError(429, 'rate_limited');
        const expiresAt = Timestamp.fromMillis(now + 86400000);
        tx.set(perEmail, { count: emailCount + 1, expiresAt });
        tx.set(global, { count: siteCount + 1, expiresAt });
        tx.set(request, { state: 'pending', createdAt: Timestamp.fromMillis(now), expiresAt });
        return 'reserved';
      });
    },
    async finish(id, state, messageId = null) {
      await requests.doc(id).update({ state, messageId, updatedAt: Timestamp.now() });
    }
  };
}
