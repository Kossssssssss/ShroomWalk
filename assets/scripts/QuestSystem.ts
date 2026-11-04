import { _decorator, Component, JsonAsset, resources } from 'cc';
import { gameEvents, GameEvent } from './GameEvents';
import { QuestData, parseQuests, questProgress } from './Quests';
import { session } from './Session';
const { ccclass, property } = _decorator;

@ccclass( 'QuestSystem' )
export class QuestSystem extends Component
{
  @property( { tooltip: 'Файл із завданнями в assets/resources (без .json)' } )
  questsFile = 'quests';

  @property( { tooltip: 'Пауза між завданнями, с' } )
  nextDelay = 2;

  private _quests: QuestData[] = [];
  private _current: QuestData | null = null;
  private _progress = 0;
  private _timeLeft = 0;
  private _shownSeconds = -1;

  onLoad()
  {
    // завдання — лише соло; вимкнений компонент не отримає ні onEnable, ні update
    if ( session.mode !== 'solo' )
    {
      this.enabled = false;
      return;
    }

    resources.load( this.questsFile, JsonAsset, ( error, asset ) =>
    {
      if ( !this.isValid ) return;
      if ( error )
      {
        console.error( `[QuestSystem] не вдалося завантажити «${this.questsFile}»`, error );
        return;
      }
      this._quests = parseQuests( asset.json );
      this.startNext();
    } );
  }

  onEnable()
  {
    gameEvents.on( GameEvent.MushroomPicked, this.onMushroomPicked, this );
  }

  onDisable()
  {
    gameEvents.off( GameEvent.MushroomPicked, this.onMushroomPicked, this );
  }

  update( dt: number )
  {
    if ( !this._current || this._current.time <= 0 ) return;

    this._timeLeft -= dt;
    if ( this._timeLeft <= 0 )
    {
      this.fail();
      return;
    }
    // напис оновлюємо раз на секунду, а не щокадру
    if ( Math.ceil( this._timeLeft ) !== this._shownSeconds ) this.emitChanged();
  }

  private onMushroomPicked( species: string, added: boolean )
  {
    const quest = this._current;
    if ( !quest || !added ) return;
    if ( quest.species && quest.species !== species ) return;

    this._progress++;
    if ( this._progress >= quest.count ) this.complete();
    else this.emitChanged();
  }

  // метод, а не стрілка: так його можна передати в scheduleOnce
  private startNext()
  {
    const next = this._quests.find( ( quest ) => !questProgress.isCompleted( quest.id ) );
    if ( !next )
    {
      this.setCurrent( null );
      gameEvents.emit( GameEvent.Toast, 'Усі завдання виконано!' );
      return;
    }
    this._progress = 0;
    this._timeLeft = next.time;
    this.setCurrent( next );
  }

  private complete()
  {
    const quest = this._current!;
    questProgress.complete( quest.id );
    this.setCurrent( null );
    gameEvents.emit( GameEvent.Toast, `Виконано: ${quest.title}` );
    this.scheduleOnce( this.startNext, this.nextDelay );
  }

  private fail()
  {
    this.setCurrent( null );
    gameEvents.emit( GameEvent.Toast, 'Час вийшов — спробуйте ще раз' );
    // startNext знову візьме перше невиконане, тобто це саме завдання
    this.scheduleOnce( this.startNext, this.nextDelay );
  }

  private setCurrent( quest: QuestData | null )
  {
    this._current = quest;
    this.emitChanged();
  }

  private emitChanged()
  {
    this._shownSeconds = Math.ceil( this._timeLeft );
    gameEvents.emit( GameEvent.QuestChanged, this._current, this._progress, this._timeLeft );
  }
}
