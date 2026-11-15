import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../src/App';

describe('App', () => {
  it('renders the day shop name', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /Reclaim & Co\. Holiday Market/ })).toBeTruthy();
  });
});
