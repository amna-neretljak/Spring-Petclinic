import * as React from 'react';
import { render } from '@testing-library/react';

import Menu from '../../../src/components/Menu';

describe('Menu', () => {
  it('shows a Login link to /login', () => {
    const { container } = render(<Menu name='/' />);

    const loginLink = container.querySelector('a[href="/login"]');
    expect(loginLink).not.toBeNull();
    expect(loginLink.textContent).toContain('Login');
  });
});
