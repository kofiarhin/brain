import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { List } from './List';

describe('List', () => {
  it('renders object items as readable brain data instead of [object Object]', () => {
    render(<List items={[{ time: '09:00', activity: 'Deep work' }, { title: 'Ship audit fix' }]} />);

    expect(screen.getByText('09:00 - Deep work')).toBeTruthy();
    expect(screen.getByText('Ship audit fix')).toBeTruthy();
    expect(screen.queryByText('[object Object]')).toBeNull();
  });

  it('renders an empty state for missing items', () => {
    render(<List items={null} />);

    expect(screen.getByText('Nothing saved yet.')).toBeTruthy();
  });
});
