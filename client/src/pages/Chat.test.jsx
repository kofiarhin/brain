import React from 'react';
import { beforeEach, cleanup, describe, expect, test, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Chat } from './Chat';
import * as chatApi from '../api/chat';

vi.mock('../api/chat', () => ({
  listChatConversations: vi.fn(),
  listChatMessages: vi.fn(),
  sendChatMessage: vi.fn(),
}));

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ username: 'admin', logout: vi.fn() }),
}));

function renderChat() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <MemoryRouter initialEntries={['/chat']}>
      <QueryClientProvider client={client}>
        <Chat />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  chatApi.listChatConversations.mockResolvedValue([]);
  chatApi.listChatMessages.mockResolvedValue([]);
  chatApi.sendChatMessage.mockResolvedValue({
    conversationId: 'c1',
    userMessage: { _id: 'u1', role: 'user', content: 'Help', createdAt: '2026-07-29T08:00:00.000Z' },
    message: { _id: 'a1', role: 'assistant', content: 'Focus on Brain App.', createdAt: '2026-07-29T08:00:01.000Z' },
    contextUsed: { tasks: 2, projects: 1 },
    retrieval: { mode: 'keyword', degraded: false },
  });
});

describe('Chat', () => {
  test('renders the immersive empty state', async () => {
    renderChat();
    expect(await screen.findByText('Start a Brain OS chat')).toBeInTheDocument();
    expect(screen.getByText(/cannot change it/i)).toBeInTheDocument();
  });

  test('suggested prompt sends a message', async () => {
    const user = userEvent.setup();
    renderChat();

    await user.click(await screen.findByRole('button', { name: 'Summarize my notes' }));

    await waitFor(() => expect(chatApi.sendChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Summarize my notes', conversationId: null }),
      expect.anything(),
    ));
  });

  test('user can type and submit with Enter', async () => {
    const user = userEvent.setup();
    renderChat();

    const composer = screen.getByLabelText('Message');
    await user.type(composer, 'Hello Brain{enter}');

    await waitFor(() => expect(chatApi.sendChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Hello Brain', conversationId: null }),
      expect.anything(),
    ));
  });

  test('Shift+Enter keeps a newline in the draft', async () => {
    const user = userEvent.setup();
    renderChat();

    const composer = screen.getByLabelText('Message');
    await user.type(composer, 'Line one{shift>}{enter}{/shift}Line two');

    expect(composer).toHaveValue('Line one\nLine two');
    expect(chatApi.sendChatMessage).not.toHaveBeenCalled();
  });

  test('loading state disables the send button', async () => {
    let resolve;
    chatApi.sendChatMessage.mockReturnValue(new Promise((resolver) => { resolve = resolver; }));
    const user = userEvent.setup();
    renderChat();

    await user.type(screen.getByLabelText('Message'), 'Slow request');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    expect(screen.getByLabelText('Brain OS is thinking')).toBeInTheDocument();

    resolve({
      conversationId: 'c1',
      userMessage: { _id: 'u1', role: 'user', content: 'Slow request', createdAt: new Date().toISOString() },
      message: { _id: 'a1', role: 'assistant', content: 'Done', createdAt: new Date().toISOString() },
      contextUsed: {},
      retrieval: {},
    });
  });

  test('error state is displayed and the draft is preserved', async () => {
    chatApi.sendChatMessage.mockRejectedValueOnce(new Error('Provider failed'));
    const user = userEvent.setup();
    renderChat();

    await user.type(screen.getByLabelText('Message'), 'Fail');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Provider failed');
    expect(screen.getByLabelText('Message')).toHaveValue('Fail');
  });

  test('successful cache reconciliation renders the assistant response once', async () => {
    const user = userEvent.setup();
    renderChat();

    await user.type(screen.getByLabelText('Message'), 'Help');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Focus on Brain App.')).toBeInTheDocument();
    expect(screen.getAllByText('Focus on Brain App.')).toHaveLength(1);
    expect(screen.getByText('tasks: 2')).toBeInTheDocument();
    expect(screen.getByText('projects: 1')).toBeInTheDocument();
  });

  test('selecting a conversation loads its messages', async () => {
    chatApi.listChatConversations.mockResolvedValue([
      { _id: 'c1', title: 'Project status update', lastMessageAt: '2026-07-29T08:00:00.000Z' },
    ]);
    chatApi.listChatMessages.mockResolvedValue([
      { _id: 'm1', role: 'assistant', content: 'Existing answer', createdAt: '2026-07-29T08:01:00.000Z' },
    ]);
    const user = userEvent.setup();
    renderChat();

    await user.click(await screen.findByRole('button', { name: /Project status update/i }));

    await waitFor(() => expect(chatApi.listChatMessages).toHaveBeenCalledWith('c1'));
    expect(await screen.findByText('Existing answer')).toBeInTheDocument();
  });

  test('conversation search filters sidebar history', async () => {
    chatApi.listChatConversations.mockResolvedValue([
      { _id: 'c1', title: 'Brain launch plan', lastMessageAt: '2026-07-29T08:00:00.000Z' },
      { _id: 'c2', title: 'Client follow-up', lastMessageAt: '2026-07-28T08:00:00.000Z' },
    ]);
    const user = userEvent.setup();
    renderChat();

    const search = await screen.findByPlaceholderText('Search chats…');
    await user.type(search, 'brain');

    expect(screen.getByRole('button', { name: /Brain launch plan/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Client follow-up/i })).not.toBeInTheDocument();
  });
});
