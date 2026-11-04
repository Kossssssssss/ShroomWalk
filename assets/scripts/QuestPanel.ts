import { _decorator, Component, Label } from 'cc';
import { gameEvents, GameEvent } from './GameEvents';
import { QuestData } from './Quests';
const { ccclass, requireComponent } = _decorator;

@ccclass( 'QuestPanel' )
@requireComponent( Label )
export class QuestPanel extends Component
{
  private _label: Label | null = null;

  onLoad()
  {
    this._label = this.getComponent( Label );
    // ховаємо Label, а не вузол: з вимкненим вузлом вимкнувся б і цей компонент разом з підпискою
    if ( this._label ) this._label.enabled = false;
  }

  onEnable()
  {
    gameEvents.on( GameEvent.QuestChanged, this.onQuestChanged, this );
  }

  onDisable()
  {
    gameEvents.off( GameEvent.QuestChanged, this.onQuestChanged, this );
  }

  private onQuestChanged( quest: QuestData | null, progress: number, timeLeft: number )
  {
    if ( !this._label ) return;
    this._label.enabled = quest !== null;
    if ( !quest ) return;

    let text = `${quest.title}: ${progress}/${quest.count}`;
    if ( quest.time > 0 ) text += ` · ${formatTime( timeLeft )}`;
    this._label.string = text;
  }
}

function formatTime( seconds: number )
{
  const total = Math.max( 0, Math.ceil( seconds ) );
  const rest = total % 60;
  return `${Math.floor( total / 60 )}:${rest < 10 ? '0' : ''}${rest}`;
}
