const USERNAME_KEY = 'petclinic.username';
const PASSWORD_KEY = 'petclinic.password';

export const saveCredentials = (username: string, password: string) => {
  localStorage.setItem(USERNAME_KEY, username);
  localStorage.setItem(PASSWORD_KEY, password);
};

export const clearCredentials = () => {
  localStorage.removeItem(USERNAME_KEY);
  localStorage.removeItem(PASSWORD_KEY);
};

export const isSignedIn = (): boolean => {
  const username = localStorage.getItem(USERNAME_KEY);
  const password = localStorage.getItem(PASSWORD_KEY);
  return !!username && !!password;
};
