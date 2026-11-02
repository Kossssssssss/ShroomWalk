import { _decorator, Component, Node, Vec2, Vec3, EventTouch, UITransform, UIOpacity } from 'cc';
import { gameEvents, GameEvent } from './GameEvents';
const { ccclass, property } = _decorator;

@ccclass( 'VirtualJoystick' )
export class VirtualJoystick extends Component
{
  @property( { type: Node, tooltip: 'Основа (коло) — дитина цього вузла' } )
  base: Node | null = null;

  @property( { type: Node, tooltip: 'Ручка — дитина основи' } )
  knob: Node | null = null;

  @property( { tooltip: 'Наскільки далеко ручка відходить від центру, px' } )
  radius = 100;

  @property( { tooltip: 'Мертва зона: менші відхилення вважаються нулем', range: [0, 0.5, 0.01], slide: true } )
  deadZone = 0.15;

  @property( { type: Vec2, tooltip: 'Де стоїть джойстик у спокої: відступ від лівого нижнього кута зони, px' } )
  restOffset = new Vec2( 200, 200 );

  @property( { type: UIOpacity, tooltip: 'UIOpacity на основі: робить прозорими основу разом з ручкою' } )
  opacity: UIOpacity | null = null;

  @property( { tooltip: 'Прозорість у спокої (0–255)', range: [0, 255, 1], slide: true } )
  idleOpacity = 100;

  @property( { tooltip: 'Прозорість під пальцем (0–255)', range: [0, 255, 1], slide: true } )
  activeOpacity = 255;

  private _transform: UITransform | null = null;
  private _touchId: number | null = null;
  private _point = new Vec3();
  private _ui = new Vec2();
  private _value = new Vec2();

  onLoad()
  {
    this._transform = this.getComponent( UITransform );
  }

  start()
  {
    this.moveToRest();
    this.setOpacity( this.idleOpacity );
  }

  onEnable()
  {
    this.node.on( Node.EventType.TOUCH_START, this.onTouchStart, this );
    this.node.on( Node.EventType.TOUCH_MOVE, this.onTouchMove, this );
    this.node.on( Node.EventType.TOUCH_END, this.onTouchEnd, this );
    this.node.on( Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this );
    this.node.on( Node.EventType.SIZE_CHANGED, this.onSizeChanged, this );
  }

  onDisable()
  {
    this.node.off( Node.EventType.TOUCH_START, this.onTouchStart, this );
    this.node.off( Node.EventType.TOUCH_MOVE, this.onTouchMove, this );
    this.node.off( Node.EventType.TOUCH_END, this.onTouchEnd, this );
    this.node.off( Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this );
    this.node.off( Node.EventType.SIZE_CHANGED, this.onSizeChanged, this );
    this.release();
  }

  private onTouchStart( event: EventTouch )
  {
    if ( this._touchId !== null ) return;
    this._touchId = event.getID();
    this.base?.setPosition( this.toLocal( event, this._point ) );
    this.knob?.setPosition( Vec3.ZERO );
    this.setOpacity( this.activeOpacity );
  }

  private onTouchMove( event: EventTouch )
  {
    if ( !this.base || event.getID() !== this._touchId ) return;
    this.toLocal( event, this._point );

    const center = this.base.position;
    let dx = this._point.x - center.x;
    let dy = this._point.y - center.y;
    const length = Math.sqrt( dx * dx + dy * dy );
    if ( length > this.radius )
    {
      dx *= this.radius / length;
      dy *= this.radius / length;
    }
    this.knob?.setPosition( dx, dy, 0 );

    const x = dx / this.radius;
    const y = dy / this.radius;
    if ( x * x + y * y < this.deadZone * this.deadZone )
    {
      this.setValue( 0, 0 );
    } else
    {
      this.setValue( x, y );
    }
  }

  private onTouchEnd( event: EventTouch )
  {
    if ( event.getID() !== this._touchId ) return;
    this.release();
  }

  private onSizeChanged()
  {
    if ( this._touchId === null ) this.moveToRest();
  }

  private release()
  {
    this._touchId = null;
    this.moveToRest();
    this.setValue( 0, 0 );
    this.setOpacity( this.idleOpacity );
  }

  private setOpacity( value: number )
  {
    if ( this.opacity ) this.opacity.opacity = value;
  }

  private setValue( x: number, y: number )
  {
    if ( this._value.x === x && this._value.y === y ) return;
    this._value.set( x, y );
    gameEvents.emit( GameEvent.JoystickMoved, x, y );
  }

  private moveToRest()
  {
    if ( !this._transform ) return;
    const t = this._transform;
    this.base?.setPosition(
      -t.width * t.anchorX + this.restOffset.x,
      -t.height * t.anchorY + this.restOffset.y,
      0,
    );
    this.knob?.setPosition( Vec3.ZERO );
  }

  private toLocal( event: EventTouch, out: Vec3 ): Vec3
  {
    event.getUILocation( this._ui );
    out.set( this._ui.x, this._ui.y, 0 );
    return this._transform ? this._transform.convertToNodeSpaceAR( out, out ) : out;
  }
}
