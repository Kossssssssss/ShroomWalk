/**
 * У APK код виконує V8 всередині Cocos, а не браузер: там немає URL, URLSearchParams і Headers,
 * а Colyseus SDK на них спирається. Мінімальні заміни ставимо лише туди, де справжніх немає.
 */
const g = globalThis as any;

function decode( text: string )
{
  return decodeURIComponent( text.replace( /\+/g, ' ' ) );
}

class SearchParamsLite
{
  private _pairs: [string, string][] = [];

  constructor( init: string = '' )
  {
    const query = init.startsWith( '?' ) ? init.slice( 1 ) : init;
    for ( const part of query.split( '&' ) )
    {
      if ( !part ) continue;
      const index = part.indexOf( '=' );
      const key = index < 0 ? part : part.slice( 0, index );
      const value = index < 0 ? '' : part.slice( index + 1 );
      this._pairs.push( [decode( key ), decode( value )] );
    }
  }

  get( key: string )
  {
    return this._pairs.find( ( pair ) => pair[0] === key )?.[1] ?? null;
  }

  has( key: string )
  {
    return this._pairs.some( ( pair ) => pair[0] === key );
  }

  set( key: string, value: string )
  {
    this.delete( key );
    this._pairs.push( [key, String( value )] );
  }

  append( key: string, value: string )
  {
    this._pairs.push( [key, String( value )] );
  }

  delete( key: string )
  {
    this._pairs = this._pairs.filter( ( pair ) => pair[0] !== key );
  }

  forEach( callback: ( value: string, key: string ) => void )
  {
    for ( const [key, value] of this._pairs ) callback( value, key );
  }

  toString()
  {
    return this._pairs.map( ( [key, value] ) => `${encodeURIComponent( key )}=${encodeURIComponent( value )}` ).join( '&' );
  }
}

// лише абсолютні адреси на кшталт https://host:port/path?query#hash — інших SDK не будує
const URL_PATTERN = /^([a-z][a-z0-9+.-]*:)\/\/([^/?#:]*)(?::(\d+))?([^?#]*)(\?[^#]*)?(#.*)?$/i;

class UrlLite
{
  protocol: string;
  hostname: string;
  port: string;
  pathname: string;
  hash: string;
  searchParams: SearchParamsLite;

  constructor( url: string, base?: string )
  {
    let full = String( url );
    if ( base && full.startsWith( '/' ) ) full = new UrlLite( base ).origin + full;
    const match = URL_PATTERN.exec( full );
    if ( !match ) throw new TypeError( `Invalid URL: ${url}` );
    this.protocol = match[1].toLowerCase();
    this.hostname = match[2];
    this.port = match[3] ?? '';
    this.pathname = match[4] || '/';
    this.searchParams = new SearchParamsLite( match[5] ?? '' );
    this.hash = match[6] ?? '';
  }

  get host()
  {
    return this.port ? `${this.hostname}:${this.port}` : this.hostname;
  }

  get origin()
  {
    return `${this.protocol}//${this.host}`;
  }

  get search()
  {
    const query = this.searchParams.toString();
    return query ? `?${query}` : '';
  }

  get href()
  {
    return `${this.origin}${this.pathname}${this.search}${this.hash}`;
  }

  toString()
  {
    return this.href;
  }
}

class HeadersLite
{
  private _map = new Map<string, string>();

  constructor( init?: any )
  {
    if ( !init ) return;
    if ( Array.isArray( init ) )
    {
      for ( const [name, value] of init ) this.append( name, value );
    } else if ( typeof init.forEach === 'function' )
    {
      init.forEach( ( value: string, name: string ) => this.append( name, value ) );
    } else
    {
      for ( const name of Object.keys( init ) ) this.append( name, init[name] );
    }
  }

  get( name: string )
  {
    return this._map.get( name.toLowerCase() ) ?? null;
  }

  has( name: string )
  {
    return this._map.has( name.toLowerCase() );
  }

  set( name: string, value: string )
  {
    this._map.set( name.toLowerCase(), String( value ) );
  }

  append( name: string, value: string )
  {
    const key = name.toLowerCase();
    const old = this._map.get( key );
    this._map.set( key, old === undefined ? String( value ) : `${old}, ${value}` );
  }

  delete( name: string )
  {
    this._map.delete( name.toLowerCase() );
  }

  forEach( callback: ( value: string, name: string, headers: HeadersLite ) => void )
  {
    this._map.forEach( ( value, name ) => callback( value, name, this ) );
  }

  entries()
  {
    return this._map.entries();
  }

  [Symbol.iterator]()
  {
    return this._map.entries();
  }
}

// адаптер Cocos на телефоні має власний URL лише для Blob: адрес він не розбирає і падає
function isWorkingUrl( Url: any )
{
  try
  {
    const url = new Url( 'https://a.b:1/c?d=1' );
    return url.hostname === 'a.b' && url.port === '1' && url.searchParams?.get( 'd' ) === '1';
  } catch ( e )
  {
    return false;
  }
}

if ( typeof g.URLSearchParams === 'undefined' ) g.URLSearchParams = SearchParamsLite;
if ( typeof g.Headers === 'undefined' ) g.Headers = HeadersLite;
if ( typeof g.URL === 'undefined' || !isWorkingUrl( g.URL ) )
{
  const adapterUrl = g.URL;
  g.URL = UrlLite;
  if ( adapterUrl?.createObjectURL ) ( UrlLite as any ).createObjectURL = adapterUrl.createObjectURL;
  if ( adapterUrl?.revokeObjectURL ) ( UrlLite as any ).revokeObjectURL = adapterUrl.revokeObjectURL;
}

export {};
