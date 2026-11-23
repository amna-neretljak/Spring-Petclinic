import { url, submitForm } from '../../src/util';

const mockResponse = (body: any, status: number) => {
  globalThis.fetch = jest.fn(() => Promise.resolve({
    status,
    json: () => Promise.resolve(body)
  } as Response));
};

describe('util', () => {
  describe('url', () => {
    it('returns url with full path', () => {
      expect(url('xxx')).toBe('http://localhost:9966/petclinic/xxx');
    });

    it('does not insert a double slash when the path starts with /', () => {
      expect(url('/api/owners/1')).toBe('http://localhost:9966/petclinic/api/owners/1');
    });
  });

  describe('submitForm', () => {
    it('submits all data', () => {
      mockResponse({ 'x': 'y' }, 200);
      return submitForm('POST', '/some-enzyme', { name: 'Test' }, (status, response) => {
        const fetchMock = globalThis.fetch as jest.Mock;
        // make sure request data is passed to fetch as expected 
        expect(fetchMock.mock.calls.length).toBe(1);
        expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:9966/petclinic/some-enzyme');
        expect(fetchMock.mock.calls[0][1].method).toBe('POST');
        expect(fetchMock.mock.calls[0][1].body).toEqual(JSON.stringify({ name: 'Test' }));

        // make sure response from fetch ist corrently passed to the onSuccess callback
        expect(status).toBe(200);
        expect(response).toEqual({ 'x': 'y' });
      });
    });

    it('works with No Content (204) responses', () => {
      mockResponse('', 204);
      return submitForm('PUT', '/somewhere', { name: 'Test' }, (status, response) => {
        expect((globalThis.fetch as jest.Mock).mock.calls.length).toBe(1);
        expect(status).toBe(204);
        expect(response).toEqual({});
      });
    });
  });
});
