import { IHttpMethod } from '../types';
import { getCredentials } from './authStorage';

const BACKEND_URL = (typeof __API_SERVER_URL__ === 'undefined' ? 'http://localhost:9966/petclinic' : __API_SERVER_URL__);

export const url = (path: string): string => {
  const base = String(BACKEND_URL).replace(/\/+$/, '');
  const suffix = String(path).replace(/^\/+/, '');
  return `${base}/${suffix}`;
};

const authHeaders = (): Record<string, string> => {
  const credentials = getCredentials();
  if (!credentials) {
    return {};
  }
  return {
    'Authorization': 'Basic ' + btoa(credentials.username + ':' + credentials.password)
  };
};

export const apiFetch = (requestUrl: string, init: RequestInit = {}) => {
  const headers = Object.assign({ 'Accept': 'application/json' }, authHeaders(), init.headers);
  return fetch(requestUrl, Object.assign({}, init, { headers }));
};

/**
 * path: relative PATH without host and port (i.e. '/api/123')
 * data: object that will be passed as request body
 * onSuccess: callback handler if request succeeded. Succeeded means it could technically be handled (i.e. valid json is returned)
 * regardless of the HTTP status code.
 */
export const submitForm = (method: IHttpMethod, path: string, data: any, onSuccess: (status: number, response: any) => void) => {
  const requestUrl = url(path);

  const fetchParams = {
    method: method,
    headers: Object.assign({
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }, authHeaders()),
    body: JSON.stringify(data)
  };

  console.log('Submitting to ' + method + ' ' + requestUrl);
  return apiFetch(requestUrl, fetchParams)
    .then(response => {
      if (response.status === 204) {
        return onSuccess(response.status, {});
      }
      return response.text().then(text => {
        const result = text ? JSON.parse(text) : {};
        return onSuccess(response.status, result);
      });
    });
};
