import '../../config.ts';

import { SenchaPlugin } from '../../plugin.ts';
import { Sencha } from '../../sencha.ts';

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
        const files = JSON.parse(e.data);

        if ( ! Array.isArray(files)) {
          console.error(
            'Invalid data type from livereload server:',
            typeof e.data
          );

          return;
        }

        /** @todo do all the style inject and image replace shizzle */
        location.reload();
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
      watcherChange: (path) => {
        for (const socket of sockets) {
          socket.send(JSON.stringify([path.file]));
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
          '</body>',
          `<script async src="${routePath}"></script></body>`
        );
      }
    }
  } as SenchaPlugin;
};
