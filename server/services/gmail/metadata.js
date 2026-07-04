const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1';

export async function fetchMetadata(accessToken, messageId) {
  const params = new URLSearchParams({ format: 'metadata' });
  params.append('metadataHeaders', 'From');
  params.append('metadataHeaders', 'To');
  params.append('metadataHeaders', 'Subject');
  params.append('metadataHeaders', 'Date');

  const response = await fetch(`${GMAIL_API_BASE}/users/me/messages/${messageId}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || 'Gmail API request failed');
  return payload;
}
