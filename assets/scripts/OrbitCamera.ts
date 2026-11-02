import { _decorator, Component, Vec3, input, Input, EventMouse, EventTouch, math } from 'cc';
const { ccclass, property } = _decorator;

@ccclass( 'OrbitCamera' )
export class OrbitCamera extends Component
{
  @property( { tooltip: 'Точка, навколо якої обертається камера' } )
  target = new Vec3( 0, 0.5, 0 );

  @property( { tooltip: 'Градусів на піксель руху мишки' } )
  rotateSpeed = 0.3;

  @property( { tooltip: 'Наскільки сильно колесо наближає' } )
  zoomSpeed = 0.01;

  @property
  minDistance = 2;

  @property
  maxDistance = 40;

  private _yaw = 0;
  private _pitch = 0;
  private _distance = 10;
  private _dragging = false;
  private _offset = new Vec3();

  onLoad()
  {
    Vec3.subtract( this._offset, this.node.position, this.target );
    this._distance = this._offset.length();
    this._yaw = math.toDegree( Math.atan2( this._offset.x, this._offset.z ) );
    this._pitch = -math.toDegree( Math.asin( this._offset.y / this._distance ) );
    this.apply();
  }

  onEnable()
  {
    input.on( Input.EventType.MOUSE_DOWN, this.onMouseDown, this );
    input.on( Input.EventType.MOUSE_UP, this.onMouseUp, this );
    input.on( Input.EventType.MOUSE_MOVE, this.onMouseMove, this );
    input.on( Input.EventType.MOUSE_WHEEL, this.onMouseWheel, this );
    input.on( Input.EventType.TOUCH_MOVE, this.onTouchMove, this );
  }

  onDisable()
  {
    input.off( Input.EventType.MOUSE_DOWN, this.onMouseDown, this );
    input.off( Input.EventType.MOUSE_UP, this.onMouseUp, this );
    input.off( Input.EventType.MOUSE_MOVE, this.onMouseMove, this );
    input.off( Input.EventType.MOUSE_WHEEL, this.onMouseWheel, this );
    input.off( Input.EventType.TOUCH_MOVE, this.onTouchMove, this );
  }

  private onMouseDown()
  {
    this._dragging = true;
  }

  private onMouseUp()
  {
    this._dragging = false;
  }

  private onMouseMove( event: EventMouse )
  {
    if ( !this._dragging ) return;
    this.rotate( event.getDeltaX(), event.getDeltaY() );
  }

  private onTouchMove( event: EventTouch )
  {
    const delta = event.getDelta();
    this.rotate( delta.x, delta.y );
  }

  private onMouseWheel( event: EventMouse )
  {
    this._distance = math.clamp( this._distance - event.getScrollY() * this.zoomSpeed, this.minDistance, this.maxDistance );
    this.apply();
  }

  private rotate( dx: number, dy: number )
  {
    this._yaw -= dx * this.rotateSpeed;
    this._pitch = math.clamp( this._pitch - dy * this.rotateSpeed, -85, -2 );
    this.apply();
  }

  private apply()
  {
    const yaw = math.toRadian( this._yaw );
    const pitch = math.toRadian( this._pitch );
    const horizontal = this._distance * Math.cos( pitch );
    this.node.setPosition(
      this.target.x + horizontal * Math.sin( yaw ),
      this.target.y - this._distance * Math.sin( pitch ),
      this.target.z + horizontal * Math.cos( yaw ),
    );
    this.node.lookAt( this.target );
  }
}
