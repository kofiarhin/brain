import { EmailMessage } from '../../models/EmailMessage.js';
import { GmailConnection } from '../../models/GmailConnection.js';
import { InboxBriefing } from '../../models/InboxBriefing.js';
import { fetchGmailMessageMetadata, listGmailMessageIds, refreshAccessToken } from './googleOAuth.js';

const DEFAULT_QUERIES = ['newer_than:1d', 'is:unread'];

function getHeader(message, name) {
  const headers = message.payload?.headers || [];
  return headers.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value || '';
}

function classify(message) {
  const labels = message.labelIds || [];
  const unread = labels.includes('UNREAD');
  return unread ? { priority: 'must', nextAction: 'review', score: 60 } : { priority: 'should', nextAction: 'review', score: 30 };
}

async function getToken() {
  if (process.env.GMAIL_REFRESH_TOKEN) return process.env.GMAIL_REFRESH_TOKEN;
  const connection = await GmailConnection.findOne({ provider: 'gmail', status: 'connected' });
  if (!connection) throw new Error('No Gmail connection found.');
  return connection.refreshToken;
}

export async function executeEmailBriefing(options = {}) {
  const queries = options.queries || process.env.GMAIL_BRIEFING_QUERIES?.split(',').map((value) => value.trim()).filter(Boolean) || DEFAULT_QUERIES;
  const maxResults = Number(options.maxResults || process.env.GMAIL_BRIEFING_MAX_RESULTS || 30);
  const tokenPayload = await refreshAccessToken(await getToken());
  const ids = new Set();

  for (const query of queries) {
    const messages = await listGmailMessageIds(tokenPayload.access_token, { query, maxResults });
    for (const message of messages) ids.add(message.id);
  }

  const records = [];
  for (const messageId of ids) {
    const message = await fetchGmailMessageMetadata(tokenPayload.access_token, messageId);
    const result = classify(message);
    const subject = getHeader(message, 'Subject') || '(no subject)';
    const record = await EmailMessage.findOneAndUpdate(
      { provider: 'gmail', messageId },
      { $set: {
        provider: 'gmail',
        messageId,
        threadId: message.threadId || '',
        historyId: message.historyId || '',
        from: getHeader(message, 'From'),
        to: getHeader(message, 'To'),
        subject,
        snippet: message.snippet || '',
        labelIds: message.labelIds || [],
        receivedAt: message.internalDate ? new Date(Number(message.internalDate)) : null,
        internalDate: message.internalDate ? Number(message.internalDate) : null,
        isUnread: (message.labelIds || []).includes('UNREAD'),
        importanceScore: result.score,
        priority: result.priority,
        nextAction: result.nextAction,
        actionSummary: subject,
        lastFetchedAt: new Date()
      } },
      { upsert: true, new: true, runValidators: true }
    );
    records.push(record);
  }

  const top = records.slice(0, 7);
  const toItem = (record) => ({
    emailMessageId: record._id,
    messageId: record.messageId,
    sender: record.from,
    subject: record.subject,
    summary: record.actionSummary || record.snippet,
    priority: record.priority,
    nextAction: record.nextAction,
    rationale: record.isUnread ? 'Unread.' : 'Recent.'
  });

  const briefing = await InboxBriefing.create({
    runDate: new Date(),
    status: 'success',
    query: queries.join(' | '),
    summary: `Fetched ${records.length} Gmail metadata records.`,
    topPriorities: top.map(toItem),
    followUps: [],
    routines: [],
    reviewLater: records.slice(7, 15).map(toItem),
    fetchedCount: records.length,
    briefedCount: top.length
  });

  await GmailConnection.findOneAndUpdate({ provider: 'gmail' }, { $set: { lastSyncedAt: new Date(), status: 'connected', lastError: '' } });
  return { command: 'email-briefing', status: 'success', ids: { inboxBriefingId: String(briefing._id) }, counts: { fetched: records.length, topPriorities: top.length }, briefing };
}
