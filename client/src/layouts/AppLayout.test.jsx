import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from './AppLayout';

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ username: 'kofi', logout: vi.fn() }),
}));

vi.mock('../components/GlobalPageLoader', () => ({
  GlobalPageLoadingOverlay: () => null,
}));

function renderLayout(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<div>Dashboard page</div>} />
          <Route path="/notes" element={<div>Notes page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('AppLayout collapsible sidebar', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('collapses the desktop sidebar into icon-only mode and persists preference', async () => {
    const user = userEvent.setup();
    renderLayout('/notes');

    const sidebar = screen.getByLabelText('Desktop sidebar');
    expect(sidebar).toHaveClass('md:w-64');

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

    expect(sidebar).toHaveClass('md:w-[72px]');
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
    expect(localStorage.getItem('brain.sidebarCollapsed')).toBe('true');
  });

  it('loads the persisted collapsed preference', () => {
    localStorage.setItem('brain.sidebarCollapsed', 'true');
    renderLayout('/notes');

    expect(screen.getByLabelText('Desktop sidebar')).toHaveClass('md:w-[72px]');
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
  });
});
