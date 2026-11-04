import { SaveSystem } from './SaveSystem';

const SAVE_KEY = 'mushroom-coop/quests';
const SAVE_VERSION = 1;

export interface QuestData
{
  /** не змінюйте після релізу: за ним зберігається прогрес */
  id: string;
  title: string;
  /** '' — підходить будь-який їстівний гриб */
  species: string;
  count: number;
  /** секунд; 0 — без обмеження */
  time: number;
}

interface QuestsSave
{
  version: number;
  completed: string[];
}

// дані з файлу — чужі: зламаний запис пропускаємо, а не падаємо
export function parseQuests( json: unknown ): QuestData[]
{
  const list = ( json as { quests?: unknown } | null )?.quests;
  if ( !Array.isArray( list ) ) return [];

  const result: QuestData[] = [];
  for ( const item of list )
  {
    const count = Number( item?.count );
    if ( typeof item?.id !== 'string' || typeof item.title !== 'string' || !( count > 0 ) )
    {
      console.warn( '[Quests] пропущено зламане завдання', item );
      continue;
    }
    const time = Number( item.time );
    result.push( {
      id: item.id,
      title: item.title,
      species: typeof item.species === 'string' ? item.species : '',
      count,
      time: time > 0 ? time : 0,
    } );
  }
  return result;
}

class QuestProgress
{
  private _completed = new Set<string>();
  private _loaded = false;

  isCompleted( id: string )
  {
    this.ensureLoaded();
    return this._completed.has( id );
  }

  get completedCount()
  {
    this.ensureLoaded();
    return this._completed.size;
  }

  complete( id: string )
  {
    this.ensureLoaded();
    this._completed.add( id );
    const data: QuestsSave = { version: SAVE_VERSION, completed: [...this._completed] };
    SaveSystem.save( SAVE_KEY, data );
  }

  reset()
  {
    this._completed.clear();
    this._loaded = true;
    SaveSystem.remove( SAVE_KEY );
  }

  private ensureLoaded()
  {
    if ( this._loaded ) return;
    this._loaded = true;

    const data = SaveSystem.load<QuestsSave>( SAVE_KEY );
    if ( !data || data.version !== SAVE_VERSION || !Array.isArray( data.completed ) ) return;
    for ( const id of data.completed )
    {
      if ( typeof id === 'string' ) this._completed.add( id );
    }
  }
}

export const questProgress = new QuestProgress();
