import { _decorator, Component, Node, Label, Button, UIOpacity, Tween, tween, director } from 'cc';
import { gameEvents, GameEvent } from './GameEvents';
import { basket } from './Basket';
import { SPECIES_NAMES, PICK_NAMES, formatCounts } from './Species';
import { punch } from './Juice';
import { setupScreen } from './ScreenSetup';
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

  @property( { type: Node, tooltip: 'Плашка повідомлення (батько напису): зʼявляється й зникає разом із ним. Порожньо — лише напис' } )
  messageBox: Node | null = null;

  @property( { tooltip: 'Скільки секунд показувати повідомлення' } )
  messageDuration = 2;

  @property( { tooltip: 'Тривалість появи й зникнення повідомлення, с' } )
  messageFade = 0.2;

  @property( { type: Node, tooltip: 'Кнопка «Меню» (вузол з компонентом Button)' } )
  menuButton: Node | null = null;

  @property( { tooltip: 'Назва сцени меню' } )
  menuScene = 'Menu';

  @property( { type: Label, tooltip: 'Код кімнати в кооперативі' } )
  roomLabel: Label | null = null;

  private _pickButtonLabel: Label | null = null;
  private _messageOpacity: UIOpacity | null = null;

  onLoad()
  {
    setupScreen();
    if ( this.pickButton )
    {
      this._pickButtonLabel = this.pickButton.getComponentInChildren( Label );
      this.pickButton.active = false;
    }
    const box = this.messageNode();
    if ( box )
    {
      box.active = false;
      this._messageOpacity = box.getComponent( UIOpacity ) ?? box.addComponent( UIOpacity );
      this._messageOpacity.opacity = 0;
    }
    if ( this.roomLabel ) this.roomLabel.node.active = false;
    this.refreshBasket();
  }

  onEnable()
  {
    gameEvents.on( GameEvent.PickTargetChanged, this.onPickTargetChanged, this );
    gameEvents.on( GameEvent.MushroomPicked, this.onMushroomPicked, this );
    gameEvents.on( GameEvent.BasketChanged, this.refreshBasket, this );
    gameEvents.on( GameEvent.Toast, this.showMessage, this );
    gameEvents.on( GameEvent.RoomJoined, this.onRoomJoined, this );
    gameEvents.on( GameEvent.RoomLeft, this.onRoomLeft, this );
    this.pickButton?.on( Button.EventType.CLICK, this.onPickClick, this );
    this.menuButton?.on( Button.EventType.CLICK, this.onMenuClick, this );
  }

  onDisable()
  {
    gameEvents.off( GameEvent.PickTargetChanged, this.onPickTargetChanged, this );
    gameEvents.off( GameEvent.MushroomPicked, this.onMushroomPicked, this );
    gameEvents.off( GameEvent.BasketChanged, this.refreshBasket, this );
    gameEvents.off( GameEvent.Toast, this.showMessage, this );
    gameEvents.off( GameEvent.RoomJoined, this.onRoomJoined, this );
    gameEvents.off( GameEvent.RoomLeft, this.onRoomLeft, this );
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
    else if ( this.basketLabel ) punch( this.basketLabel.node );
  }

  private onRoomJoined( code: string )
  {
    if ( !this.roomLabel ) return;
    this.roomLabel.string = `Кімната ${code}`;
    this.roomLabel.node.active = true;
  }

  private onRoomLeft()
  {
    if ( this.roomLabel ) this.roomLabel.node.active = false;
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
    const box = this.messageNode();
    if ( !this.messageLabel || !box ) return;
    this.messageLabel.string = text;
    box.active = true;
    this.fadeMessage( 255 );
    this.unschedule( this.hideMessage );
    this.scheduleOnce( this.hideMessage, this.messageDuration );
  }

  // метод, а не стрілка: unschedule шукає таймер саме за цією функцією
  private hideMessage()
  {
    this.fadeMessage( 0, () =>
    {
      const box = this.messageNode();
      if ( box ) box.active = false;
    } );
  }

  private messageNode()
  {
    return this.messageBox ?? this.messageLabel?.node ?? null;
  }

  private fadeMessage( opacity: number, done?: () => void )
  {
    const fader = this._messageOpacity;
    if ( !fader ) return;
    Tween.stopAllByTarget( fader );
    tween( fader ).to( this.messageFade, { opacity } ).call( () => done?.() ).start();
  }
}
