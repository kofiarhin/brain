import { request } from './http';

export function sendChatMessage({ message, conversationId }) {
  return request('/chat', { method: 'POST', body: JSON.stringify({ message, conversationId }) });
}

export function listChatConversations() {
  return request('/chat/conversations');
}

export function listChatMessages(conversationId) {
  return request(`/chat/conversations/${conversationId}/messages`);
}
