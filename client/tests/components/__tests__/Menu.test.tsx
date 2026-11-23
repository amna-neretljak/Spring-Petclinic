import * as React from 'react';
import { render, fireEvent } from '@testing-library/react';

import Menu from '../../../src/components/Menu';

describe('Menu', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows a Login link to /login', () => {
    const { container } = render(<Menu name='/' />);

    const loginLink = container.querySelector('a[href="/login"]');
    expect(loginLink).not.toBeNull();
    expect(loginLink.textContent).toContain('Login');
    expect(container.textContent).not.toContain('Logout');
  });

  it('shows Logout instead of Login when credentials are stored', () => {
    localStorage.setItem('petclinic.username', 'admin');
    localStorage.setItem('petclinic.password', 'admin');

    const { container } = render(<Menu name='/' />);

    expect(container.querySelector('a[href="/login"]')).toBeNull();
    expect(container.textContent).toContain('Logout');
  });

  it('clears credentials and shows Login after Logout', () => {
    localStorage.setItem('petclinic.username', 'admin');
    localStorage.setItem('petclinic.password', 'admin');

    const { container } = render(<Menu name='/' />);

    const logout = Array.from(container.querySelectorAll('a')).find(link => link.textContent.indexOf('Logout') !== -1);
    fireEvent.click(logout);

    expect(localStorage.getItem('petclinic.username')).toBeNull();
    expect(localStorage.getItem('petclinic.password')).toBeNull();
    expect(container.querySelector('a[href="/login"]')).not.toBeNull();
    expect(container.textContent).toContain('Login');
    expect(container.textContent).not.toContain('Logout');
  });
});
