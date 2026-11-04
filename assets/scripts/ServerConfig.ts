import { sys } from 'cc';

/** Сервер в інтернеті (без «/» в кінці). Порожньо — сервер на своєму ПК (npm run dev). */
export const ONLINE_SERVER = 'https://mushroom-coop-server.onrender.com';

export function serverUrl( localHost: string, localPort: number ): string
{
  if ( ONLINE_SERVER ) return ONLINE_SERVER;
  // у браузері сервер на тому ж ПК, що й сторінка; у APK адреси сторінки немає
  const location = ( globalThis as any ).location;
  const host = sys.isBrowser && location?.hostname ? location.hostname : localHost;
  return `http://${host}:${localPort}`;
}

/**
 * Як Colyseus робить HTTP-запити: він просить cookies (credentials: 'include'), і fetch адаптера Cocos
 * на телефоні вмикає для цього XMLHttpRequest.withCredentials, а нативний XHR змінювати його не дає.
 * Cookies нам не потрібні, тож на телефоні просимо їх не надсилати.
 */
export function clientOptions()
{
  if ( sys.isBrowser ) return undefined;
  return { fetchFn: ( input: any, init?: any ) => fetch( input, { ...init, credentials: 'same-origin' } ) };
}

/** Безкоштовний хостинг присипляє сервер, до якого довго ніхто не звертався; цей запит будить його або не дає заснути. */
export function wakeServer()
{
  if ( !ONLINE_SERVER ) return;
  const request = new XMLHttpRequest();
  request.open( 'GET', `${ONLINE_SERVER}/health` );
  request.send();
}
