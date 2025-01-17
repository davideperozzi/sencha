import * as path from 'node:path';
import { type SenchaPlugin } from '../plugin.ts';
import { Sencha } from '../sencha.ts';
import { ServerWebSocket } from 'bun';

const routePath = '/c2VuY2hhbGl2ZXJlbG9hZAo';
const reloadScript = (wsPath: string) => `
  let isClosed = false;
  let webSocket = null;

  function createWebSocket() {
    if (webSocket && webSocket.readyState !== 3) {
      return;
    }

    const { protocol, host } = document.location;
    const proto = protocol === 'https:' ? 'wss://' : 'ws://';

    webSocket = new WebSocket(proto + host + "${wsPath}");

    webSocket.addEventListener('close', () => {
      isClosed = true;
      setTimeout(createWebSocket, 1000);
    });

    webSocket.addEventListener('open', () => {
      console.log('Sencha livereload got your back!');

      if (isClosed) {
        location.reload();
      }
    });

    webSocket.addEventListener('message', (e) => {
      try {
        const { type, file, reload = false } = JSON.parse(e.data);

        if (reload) {
          location.reload();
        }

        if (type === 'asset') {
          if (file.endsWith('.css')) {
            const link = document.querySelector('link[href^="' + file + '"]');

            if (link) {
              link.href = file + '?t=' + Date.now();
            }
          } else {
            location.reload();
          }
        }
      } catch(err) {
        console.error('Invalid data from livereload server:', err);
      }
    });

    webSocket.addEventListener('error', (err) => {
      console.error('livereload WebSocket error:', err);
    });
  }

  addEventListener('pagehide', () => webSocket ?? webSocket.close());
  createWebSocket();
`;

export default (sencha: Sencha) => {
  let sockets: Map<string, ServerWebSocket<unknown>> = new Map();

  return {
    hooks: {
      watcherChange: ({ file }) => {
        const relFile = path.relative(sencha.dirs.root, file);

        if (relFile.startsWith('.') || file.startsWith(sencha.dirs.out)) {
          return;
        }

        for (const socket of sockets.values()) {
          socket.send(JSON.stringify({
            type: 'file',
            reload: false,
            file
          }));
        }
      },
      assetProcess: (asset) => {
        if ( ! asset.isFirst()) {
          for (const socket of sockets.values()) {
            socket.send(JSON.stringify({
              type: 'asset',
              reload: false,
              file: asset.url
            }));
          }
        }
      },
      buildSuccess: () => {
        for (const socket of sockets.values()) {
          socket.send(JSON.stringify({
            type: 'build',
            reload: true,
            file: null,
          }));
        }
      },
      serverUpgrade: (router, { server, sockets: newSockets }) =>  {
        sockets = newSockets;

        router.get(routePath, async (req) => {
          const id = Bun.randomUUIDv7();

          if (!server.upgrade(req, { data: { id } })) {
            return new Response(reloadScript(routePath), {
              headers: {
                'Content-Type': 'text/javascript;charset=utf-8'
              }
            });
          }
        });
      },
      serverRenderRoute: ({ html }) => {
        const script = `<script async src="${routePath}"></script>`;

        if (html.search('</head>') > 0) {
          return html.replace('</head>', `${script}</head>`);
        }

        return html + script;
      }
    }
  } as SenchaPlugin;
};
