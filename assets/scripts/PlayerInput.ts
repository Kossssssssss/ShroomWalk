import { _decorator, Component, Vec2, input, Input, EventKeyboard, KeyCode } from 'cc';
import { gameEvents, GameEvent } from './GameEvents';
const { ccclass, property } = _decorator;

@ccclass( 'PlayerInput' )
export class PlayerInput extends Component
{
  @property( { tooltip: 'Сила «нахилу» від клавіатури без Shift. Має бути меншою за Run Threshold у PlayerController', range: [0, 1, 0.05], slide: true } )
  keyboardWalk = 0.5;

  private _keys = new Set<KeyCode>();
  private _stick = new Vec2();

  onEnable()
  {
    input.on( Input.EventType.KEY_DOWN, this.onKeyDown, this );
    input.on( Input.EventType.KEY_UP, this.onKeyUp, this );
    gameEvents.on( GameEvent.JoystickMoved, this.onJoystickMoved, this );
  }

  onDisable()
  {
    input.off( Input.EventType.KEY_DOWN, this.onKeyDown, this );
    input.off( Input.EventType.KEY_UP, this.onKeyUp, this );
    gameEvents.off( GameEvent.JoystickMoved, this.onJoystickMoved, this );
    this._keys.clear();
    this._stick.set( 0, 0 );
  }

  readMove( out: Vec2 ): Vec2
  {
    if ( this._stick.lengthSqr() > 0 ) return out.set( this._stick );

    out.set(
      this.axis( KeyCode.KEY_D, KeyCode.ARROW_RIGHT, KeyCode.KEY_A, KeyCode.ARROW_LEFT ),
      this.axis( KeyCode.KEY_W, KeyCode.ARROW_UP, KeyCode.KEY_S, KeyCode.ARROW_DOWN ),
    );
    if ( out.lengthSqr() > 0 )
    {
      const running = this._keys.has( KeyCode.SHIFT_LEFT ) || this._keys.has( KeyCode.SHIFT_RIGHT );
      out.normalize().multiplyScalar( running ? 1 : this.keyboardWalk );
    }
    return out;
  }

  private onJoystickMoved( x: number, y: number )
  {
    this._stick.set( x, y );
  }

  private onKeyDown( event: EventKeyboard )
  {
    this._keys.add( event.keyCode );
  }

  private onKeyUp( event: EventKeyboard )
  {
    this._keys.delete( event.keyCode );
  }

  private axis( positive: KeyCode, positiveAlt: KeyCode, negative: KeyCode, negativeAlt: KeyCode )
  {
    const plus = this._keys.has( positive ) || this._keys.has( positiveAlt ) ? 1 : 0;
    const minus = this._keys.has( negative ) || this._keys.has( negativeAlt ) ? 1 : 0;
    return plus - minus;
  }
}
