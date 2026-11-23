import * as React from 'react';
import { render, fireEvent } from '@testing-library/react';

import { submitForm } from '../../../src/util';
import LoginPage from '../../../src/components/LoginPage';

jest.mock('../../../src/util', () => ({
  url: (path: string) => path,
  submitForm: jest.fn()
}));

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear();
    (submitForm as jest.Mock).mockReset();
  });

  it('renders username, password, and a Login button', () => {
    const { container } = render(<LoginPage />);

    expect(container.querySelector('h2').textContent).toBe('Login');
    expect(container.querySelector('input[name="username"]')).not.toBeNull();

    const password = container.querySelector('input[name="password"]');
    expect(password).not.toBeNull();
    expect(password.getAttribute('type')).toBe('password');

    expect(container.querySelector('button[type="submit"]').textContent).toContain('Login');
  });

  it('posts username and password to /api/login', () => {
    const { container } = render(<LoginPage />);

    fireEvent.change(container.querySelector('input[name="username"]'), { target: { value: 'admin' } });
    fireEvent.change(container.querySelector('input[name="password"]'), { target: { value: 'secret' } });
    fireEvent.click(container.querySelector('button[type="submit"]'));

    expect(submitForm).toHaveBeenCalledWith(
      'POST',
      '/api/login',
      { username: 'admin', password: 'secret' },
      expect.any(Function)
    );
  });

  it('stays on the form and shows an error when login is not 2xx', () => {
    (submitForm as jest.Mock).mockImplementation((_method, _path, _data, onSuccess) => {
      onSuccess(401, {});
    });

    const { container } = render(<LoginPage />);

    fireEvent.change(container.querySelector('input[name="username"]'), { target: { value: 'admin' } });
    fireEvent.change(container.querySelector('input[name="password"]'), { target: { value: 'wrong' } });
    fireEvent.click(container.querySelector('button[type="submit"]'));

    expect(container.textContent).toMatch(/invalid username or password/i);
    expect(container.querySelector('input[name="username"]')).not.toBeNull();
    expect(container.querySelector('input[name="password"]')).not.toBeNull();
    expect(localStorage.getItem('petclinic.username')).toBeNull();
  });

  it('writes credentials to localStorage on 2xx login', () => {
    (submitForm as jest.Mock).mockImplementation((_method, _path, _data, onSuccess) => {
      onSuccess(200, {});
    });

    const { container } = render(<LoginPage />);

    fireEvent.change(container.querySelector('input[name="username"]'), { target: { value: 'admin' } });
    fireEvent.change(container.querySelector('input[name="password"]'), { target: { value: 'secret' } });
    fireEvent.click(container.querySelector('button[type="submit"]'));

    expect(localStorage.getItem('petclinic.username')).toBe('admin');
    expect(localStorage.getItem('petclinic.password')).toBe('secret');
  });
});

