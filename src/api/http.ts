// HTTP access to the site's own files (relative URLs: the site may live under any path).

export class HttpError extends Error {
  readonly status: number;
  constructor(url: string, status: number) {
    super(`${url}: ${status}`);
    this.status = status;
  }
}

async function get(url: string): Promise<Response> {
  const res = await fetch(url);
  if (!res.ok) throw new HttpError(url, res.status);
  return res;
}

export const getJson = async <T>(url: string): Promise<T> => (await (await get(url)).json()) as T;
export const getText = async (url: string): Promise<string> => (await get(url)).text();
