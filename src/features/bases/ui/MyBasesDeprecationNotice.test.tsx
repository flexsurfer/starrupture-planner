import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MyBasesDeprecationNotice } from './MyBasesDeprecationNotice';

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    sessionStorage.clear();
});

it('keeps the notice dismissed across remounts until the browser session ends', () => {
    const firstVisit = render(<MyBasesDeprecationNotice />);
    expect(screen.getByRole('note')).toHaveTextContent('Use Factory Map instead.');
    fireEvent.click(screen.getByRole('button', { name: 'Hide this notice for this session' }));
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    firstVisit.unmount();

    const nextVisit = render(<MyBasesDeprecationNotice />);
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    nextVisit.unmount();

    // A new tab session has no previous dismissal.
    sessionStorage.clear();
    render(<MyBasesDeprecationNotice />);
    expect(screen.getByRole('note')).toBeVisible();
});

it('can still close the notice when session storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    render(<MyBasesDeprecationNotice />);
    fireEvent.click(screen.getByRole('button', { name: 'Hide this notice for this session' }));
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
});
