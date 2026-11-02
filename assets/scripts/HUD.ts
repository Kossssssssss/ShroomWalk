import { _decorator, Component, Node, Label, Button, director } from 'cc';
import { gameEvents, GameEvent } from './GameEvents';
import { basket } from './Basket';
import { SPECIES_NAMES, PICK_NAMES, formatCounts } from './Species';
const { ccclass, property } = _decorator;

@ccclass( 'HUD' )
export class HUD extends Component
{
  @property( { type: Label, tooltip: 'Напис з кількістю грибів у кошику' } )
  basketLabel: Label | null = null;

  @property( { type: Node, tooltip: 'Кнопка «Зібрати» (вузол з компонентом Button)' } )
  pickButton: Node | null = null;

  @property( { type: Label, tooltip: 'Тимчасове повідомлення по центру зверху' } )
  messageLabel: Label | null = null;

  @property( { tooltip: 'Скільки секунд показувати повідомлення' } )
  messageDuration = 2;

  @property( { type: Node, tooltip: 'Кнопка «Меню» (вузол з компонентом Button)' } )
  menuButton: Node | null = null;

  @property( { tooltip: 'Назва сцени меню' } )
  menuScene = 'Menu';

  private _pickButtonLabel: Label | null = null;

  onLoad()
  {
    if ( this.pickButton )
    {
      this._pickButtonLabel = this.pickButton.getComponentInChildren( Label );
      this.pickButton.active = false;
    }
    if ( this.messageLabel ) this.messageLabel.node.active = false;
    this.refreshBasket();
  }

  onEnable()
  {
    gameEvents.on( GameEvent.PickTargetChanged, this.onPickTargetChanged, this );
    gameEvents.on( GameEvent.MushroomPicked, this.onMushroomPicked, this );
    gameEvents.on( GameEvent.BasketChanged, this.refreshBasket, this );
    this.pickButton?.on( Button.EventType.CLICK, this.onPickClick, this );
    this.menuButton?.on( Button.EventType.CLICK, this.onMenuClick, this );
  }

  onDisable()
  {
    gameEvents.off( GameEvent.PickTargetChanged, this.onPickTargetChanged, this );
    gameEvents.off( GameEvent.MushroomPicked, this.onMushroomPicked, this );
    gameEvents.off( GameEvent.BasketChanged, this.refreshBasket, this );
    this.pickButton?.off( Button.EventType.CLICK, this.onPickClick, this );
    this.menuButton?.off( Button.EventType.CLICK, this.onMenuClick, this );
  }

  private onPickTargetChanged( target: Node | null, species: string )
  {
    if ( this.pickButton ) this.pickButton.active = target !== null;
    if ( this._pickButtonLabel && target )
    {
      const name = PICK_NAMES[species];
      this._pickButtonLabel.string = name ? `Зібрати ${name}` : 'Зібрати';
    }
  }

  private onMushroomPicked( species: string, added: boolean )
  {
    if ( !added ) this.showMessage( `${SPECIES_NAMES[species] ?? species} неїстівні!` );
  }

  private onPickClick()
  {
    gameEvents.emit( GameEvent.PickRequested );
  }

  private onMenuClick()
  {
    director.loadScene( this.menuScene );
  }

  private refreshBasket()
  {
    if ( !this.basketLabel ) return;
    this.basketLabel.string = formatCounts( basket.counts ) || 'Кошик порожній';
  }

  private showMessage( text: string )
  {
    if ( !this.messageLabel ) return;
    this.messageLabel.string = text;
    this.messageLabel.node.active = true;
    this.unschedule( this.hideMessage );
    this.scheduleOnce( this.hideMessage, this.messageDuration );
  }

  // метод, а не стрілка: unschedule шукає таймер саме за цією функцією
  private hideMessage()
  {
    if ( this.messageLabel ) this.messageLabel.node.active = false;
  }
}
