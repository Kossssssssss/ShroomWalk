import { sys } from 'cc';

export const SaveSystem = {
  load<T>( key: string ): T | null
  {
    try
    {
      const raw = sys.localStorage.getItem( key );
      return raw ? ( JSON.parse( raw ) as T ) : null;
    } catch ( e )
    {
      console.warn( `[SaveSystem] не вдалося прочитати «${key}»`, e );
      return null;
    }
  },

  save( key: string, data: unknown )
  {
    try
    {
      sys.localStorage.setItem( key, JSON.stringify( data ) );
    } catch ( e )
    {
      console.warn( `[SaveSystem] не вдалося записати «${key}»`, e );
    }
  },

  remove( key: string )
  {
    sys.localStorage.removeItem( key );
  },
};
