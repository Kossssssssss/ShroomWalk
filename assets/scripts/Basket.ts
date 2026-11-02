import { gameEvents, GameEvent } from './GameEvents';
import { SaveSystem } from './SaveSystem';

const SAVE_KEY = 'mushroom-coop/basket';
// змінився формат запису — підніміть версію
const SAVE_VERSION = 1;

const INEDIBLE = new Set( ['Amanita'] );

interface BasketSave
{
  version: number;
  counts: { [species: string]: number };
}

class Basket
{
  private _counts = new Map<string, number>();
  private _loaded = false;

  isEdible( species: string )
  {
    return !INEDIBLE.has( species );
  }

  add( species: string ): boolean
  {
    this.ensureLoaded();
    if ( !this.isEdible( species ) ) return false;
    this._counts.set( species, ( this._counts.get( species ) ?? 0 ) + 1 );
    this.save();
    gameEvents.emit( GameEvent.BasketChanged );
    return true;
  }

  get counts(): ReadonlyMap<string, number>
  {
    this.ensureLoaded();
    return this._counts;
  }

  get total()
  {
    let sum = 0;
    for ( const count of this.counts.values() ) sum += count;
    return sum;
  }

  reset()
  {
    this._counts.clear();
    this._loaded = true;
    SaveSystem.remove( SAVE_KEY );
    gameEvents.emit( GameEvent.BasketChanged );
  }

  // не в конструкторі: модуль імпортується раніше, ніж рушій готовий
  private ensureLoaded()
  {
    if ( this._loaded ) return;
    this._loaded = true;

    const data = SaveSystem.load<BasketSave>( SAVE_KEY );
    if ( !data || data.version !== SAVE_VERSION || !data.counts ) return;
    for ( const species of Object.keys( data.counts ) )
    {
      const count = data.counts[species];
      if ( typeof count === 'number' && count > 0 ) this._counts.set( species, count );
    }
  }

  private save()
  {
    const data: BasketSave = { version: SAVE_VERSION, counts: {} };
    this._counts.forEach( ( count, species ) =>
    {
      data.counts[species] = count;
    } );
    SaveSystem.save( SAVE_KEY, data );
  }
}

export const basket = new Basket();
