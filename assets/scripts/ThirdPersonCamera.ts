import { _decorator, Component, Node, Vec3, input, Input, EventMouse, EventTouch, math } from 'cc';
const { ccclass, property } = _decorator;

@ccclass( 'ThirdPersonCamera' )
export class ThirdPersonCamera extends Component
{
  @property( { type: Node, tooltip: 'За ким стежить камера' } )
  target: Node | null = null;

  @property( { tooltip: 'Висота точки погляду над ногами персонажа' } )
  lookHeight = 1.2;

  @property( { tooltip: 'Наскільки щільно камера встигає за персонажем (більше = жорсткіше)' } )
  followSharpness = 8;

  @property( { tooltip: 'Градусів на піксель руху мишки' } )
  rotateSpeed = 0.3;

  @property( { tooltip: 'Наскільки сильно колесо наближає' } )
  zoomSpeed = 0.005;

  @property
  distance = 6;

  @property
  minDistance = 3;

  @property
  maxDistance = 12;

  @property( { tooltip: 'Нахил камери, градуси (мінус = дивиться згори)' } )
  pitch = -20;

  @property
  yaw = 0;

  private _focus = new Vec3();
  private _goal = new Vec3();

  start()
  {
    if ( this.target ) this.goalPoint( this._focus );
    this.apply();
  }

  onEnable()
  {
    input.on( Input.EventType.MOUSE_WHEEL, this.onMouseWheel, this );
    input.on( Input.EventType.TOUCH_MOVE, this.onTouchMove, this );
  }

  onDisable()
  {
    input.off( Input.EventType.MOUSE_WHEEL, this.onMouseWheel, this );
    input.off( Input.EventType.TOUCH_MOVE, this.onTouchMove, this );
  }

  // лише TOUCH_MOVE: на ПК рушій сам робить дотик з мишки, і MOUSE_MOVE крутив би камеру вдвічі
  private onTouchMove( event: EventTouch )
  {
    const delta = event.getDelta();
    this.rotate( delta.x, delta.y );
  }

  private onMouseWheel( event: EventMouse )
  {
    this.distance = math.clamp( this.distance - event.getScrollY() * this.zoomSpeed, this.minDistance, this.maxDistance );
  }

  private rotate( dx: number, dy: number )
  {
    this.yaw -= dx * this.rotateSpeed;
    this.pitch = math.clamp( this.pitch - dy * this.rotateSpeed, -70, -5 );
  }

  lateUpdate( dt: number )
  {
    if ( !this.target ) return;
    this.goalPoint( this._goal );
    Vec3.lerp( this._focus, this._focus, this._goal, 1 - Math.exp( -this.followSharpness * dt ) );
    this.apply();
  }

  private goalPoint( out: Vec3 )
  {
    Vec3.copy( out, this.target!.worldPosition );
    out.y += this.lookHeight;
  }

  private apply()
  {
    const yaw = math.toRadian( this.yaw );
    const pitch = math.toRadian( this.pitch );
    const horizontal = this.distance * Math.cos( pitch );
    this.node.setWorldPosition(
      this._focus.x + horizontal * Math.sin( yaw ),
      this._focus.y - this.distance * Math.sin( pitch ),
      this._focus.z + horizontal * Math.cos( yaw ),
    );
    this.node.lookAt( this._focus );
  }
}
