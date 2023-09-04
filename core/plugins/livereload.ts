import { path } from '../../deps/std.ts';
import { SenchaPlugin } from '../plugin.ts';
import { Sencha } from '../sencha.ts';

const routePath = '/c2VuY2hhbGl2ZXJlbG9hZAo';
const reloadScript = /* js */`
  let isClosed = false;
  let webSocket = null;

  function createWebSocket() {
    if (webSocket && webSocket.readyState !== 3) {
      return;
    }

    const { protocol, host } = document.location;
    const proto = protocol === 'https:' ? 'wss://' : 'ws://';

    webSocket = new WebSocket(proto + host + "${routePath}");

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
  const sockets: WebSocket[] = [];

  return {
    hooks: {
      watcherChange: ({ file }) => {
        const relFile = path.relative(sencha.dirs.root, file);

        if (relFile.startsWith('.') || file.startsWith(sencha.dirs.out)) {
          return;
        }

        for (const socket of sockets) {
          socket.send(JSON.stringify({
            type: 'file',
            reload: false,
            file
          }));
        }
      },
      assetProcess: (asset) => {
        if ( ! asset.isFirst()) {
          for (const socket of sockets) {
            socket.send(JSON.stringify({
              type: 'asset',
              reload: false,
              file: asset.url
            }));
          }
        }
      },
      buildSuccess: () => {
        for (const socket of sockets) {
          socket.send(JSON.stringify({
            type: 'build',
            reload: true,
            file: null,
          }));
        }
      },
      serverUpgrade: (router) =>  {
        router.get(routePath, (ctx) => {
          if ( ! ctx.isUpgradable) {
            ctx.response.body = reloadScript;

            return;
          }

          const socket = ctx.upgrade();

          socket.onopen = () => sockets.push(socket);
          socket.onclose = () => {
            const index = sockets.indexOf(socket);

            if (index > -1) {
              sockets.splice(index, 1);
            }
          };
        })
      },
      serverRenderRoute: ({ html }) => {
        return html.replace(
          '</head>',
          `<script async src="${routePath}"></script></head>`
        );
      }
    }
  } as SenchaPlugin;
};
