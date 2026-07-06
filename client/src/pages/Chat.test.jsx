import React from 'react';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Chat } from './Chat';
import * as chatApi from '../api/chat';

vi.mock('../api/chat', () => ({
  listChatConversations: vi.fn(),
  listChatMessages: vi.fn(),
  sendChatMessage: vi.fn(),
}));

function renderChat() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><Chat /></QueryClientProvider>);
}

beforeEach(() => {
  cleanup();
  chatApi.listChatConversations.mockResolvedValue([]);
  chatApi.listChatMessages.mockResolvedValue([]);
  vi.clearAllMocks();
  chatApi.sendChatMessage.mockResolvedValue({
    conversationId: 'c1',
    message: { role: 'assistant', content: 'Focus on Brain App.', createdAt: new Date().toISOString() },
    contextUsed: { tasks: 2, projects: 1 },
  });
});

describe('Chat', () => {
  test('renders empty state', async () => {
    renderChat();
    expect(await screen.findByText('Start a Brain App chat')).toBeInTheDocument();
  });

  test('suggested prompt sends message', async () => {
    const user = userEvent.setup();
    renderChat();
    await user.click((await screen.findAllByText('What should I focus on today?'))[0]);
    await waitFor(() => expect(chatApi.sendChatMessage).toHaveBeenCalledWith(expect.objectContaining({ message: 'What should I focus on today?', conversationId: null }), expect.anything()));
  });

  test('user can type and submit', async () => {
    const user = userEvent.setup();
    renderChat();
    await user.type(screen.getByLabelText('Message'), 'Hello Brain');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(chatApi.sendChatMessage).toHaveBeenCalledWith(expect.objectContaining({ message: 'Hello Brain', conversationId: null }), expect.anything()));
  });

  test('loading state disables send button', async () => {
    let resolve;
    chatApi.sendChatMessage.mockReturnValue(new Promise((r) => { resolve = r; }));
    const user = userEvent.setup();
    renderChat();
    await user.type(screen.getByLabelText('Message'), 'Slow request');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    resolve({ conversationId: 'c1', message: { role: 'assistant', content: 'Done', createdAt: new Date().toISOString() }, contextUsed: {} });
  });

  test('error state is displayed', async () => {
    chatApi.sendChatMessage.mockRejectedValueOnce(new Error('Provider failed'));
    const user = userEvent.setup();
    renderChat();
    await user.type(screen.getByLabelText('Message'), 'Fail');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Provider failed');
    expect(screen.getByLabelText('Message')).toHaveValue('Fail');
  });

  test('assistant response and context summary appear after success', async () => {
    const user = userEvent.setup();
    renderChat();
    await user.type(screen.getByLabelText('Message'), 'Help');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Focus on Brain App.')).toBeInTheDocument();
    expect(await screen.findByText('tasks: 2')).toBeInTheDocument();
    expect(screen.getByText('projects: 1')).toBeInTheDocument();
  });
});
