import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../src/App';

describe('App', () => {
  it('renders the day shop name', () => {
    render(<App />);
    expect(screen.getByRole('link', { name: /Reclaim and Co\. Holiday Market, home/ })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: /Gifts for everyone coming home/ })).toBeTruthy();
    expect(screen.getAllByRole('article').length).toBeGreaterThanOrEqual(18);
  });
});
