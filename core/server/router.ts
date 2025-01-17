type ResponseFn = (request: Request) => Promise<Response|undefined|void>|undefined;

export class Router {
  routes: { method: string|string[]; path: string; response: ResponseFn }[] = [];

  add(method: string|string[], path: string, response: ResponseFn) {
    this.routes.push({ 
      method: Array.isArray(method) ? method.map(m => m.toLowerCase()) : method.toLowerCase(),
      path,
      response 
    });
  }

  get(path: string, response: ResponseFn) { this.add('get', path, response); }
  post(path: string, response: ResponseFn) { this.add('post', path, response); }
  put(path: string, response: ResponseFn) { this.add('put', path, response); }
  delete(path: string, response: ResponseFn) { this.add('delete', path, response); }
  patch(path: string, response: ResponseFn) { this.add('patch', path, response); }
  head(path: string, response: ResponseFn) { this.add('head', path, response); }
  options(path: string, response: ResponseFn) { this.add('options', path, response); }
}
