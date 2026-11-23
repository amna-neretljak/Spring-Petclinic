import { saveCredentials, clearCredentials, isSignedIn } from '../../src/util/authStorage';

describe('authStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('writes petclinic.username and petclinic.password', () => {
    saveCredentials('admin', 'secret');

    expect(localStorage.getItem('petclinic.username')).toBe('admin');
    expect(localStorage.getItem('petclinic.password')).toBe('secret');
    expect(isSignedIn()).toBe(true);
  });

  it('clears both keys', () => {
    saveCredentials('admin', 'secret');
    clearCredentials();

    expect(localStorage.getItem('petclinic.username')).toBeNull();
    expect(localStorage.getItem('petclinic.password')).toBeNull();
    expect(isSignedIn()).toBe(false);
  });
});
