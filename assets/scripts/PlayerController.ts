import { _decorator, Component, Node, Vec2, Vec3, CharacterController, math } from 'cc';
import { PlayerInput } from './PlayerInput';
const { ccclass, property, requireComponent } = _decorator;

const UP = new Vec3( 0, 1, 0 );

@ccclass( 'PlayerController' )
@requireComponent( PlayerInput )
export class PlayerController extends Component
{
  @property( { type: Node, tooltip: 'Камера: рух рахується відносно її погляду' } )
  cameraNode: Node | null = null;

  @property( { type: Node, tooltip: 'Модель персонажа (дитина), яку повертаємо в бік руху' } )
  model: Node | null = null;

  @property( { tooltip: 'Швидкість ходьби, м/с' } )
  walkSpeed = 3;

  @property( { tooltip: 'Наскільки швидко модель доповертається до напрямку руху' } )
  turnSharpness = 12;

  @property( { tooltip: 'Прискорення вільного падіння, м/с²' } )
  gravity = -20;

  @property( { tooltip: 'Нижче цієї висоти персонаж вважається таким, що впав, і повертається на старт' } )
  fallLimit = -10;

  @property( { tooltip: 'Швидкість бігу, м/с' } )
  runSpeed = 5.5;

  @property( { tooltip: 'Наскільки швидко розганяється і гальмує між ходьбою та бігом' } )
  speedSharpness = 6;

  @property( { tooltip: 'З якого відхилення (0…1) починається біг', range: [0, 1, 0.05], slide: true } )
  runThreshold = 0.7;

  private _controller: CharacterController | null = null;
  private _input: PlayerInput | null = null;
  private _stick = new Vec2();
  private _velocityY = 0;
  private _yaw = 0;
  private _speed = 0;

  private _forward = new Vec3();
  private _right = new Vec3();
  private _move = new Vec3();
  private _spawn = new Vec3();

  onLoad()
  {
    this._controller = this.getComponent( CharacterController );
    this._input = this.getComponent( PlayerInput );
    if ( this.model ) this._yaw = this.model.eulerAngles.y;
    this._speed = this.walkSpeed;
  }

  start()
  {
    if ( this._controller ) Vec3.copy( this._spawn, this._controller.centerWorldPosition );
  }

  update( dt: number )
  {
    if ( !this._controller ) return;

    if ( this._input )
    {
      this._input.readMove( this._stick );
    } else
    {
      this._stick.set( 0, 0 );
    }
    const strength = this._stick.length();

    if ( this.cameraNode )
    {
      Vec3.copy( this._forward, this.cameraNode.forward );
    } else
    {
      this._forward.set( 0, 0, -1 );
    }
    this._forward.y = 0;
    this._forward.normalize();
    Vec3.cross( this._right, this._forward, UP );

    Vec3.multiplyScalar( this._move, this._forward, this._stick.y );
    Vec3.scaleAndAdd( this._move, this._move, this._right, this._stick.x );
    const moving = strength > 0.001;
    if ( moving )
    {
      this._move.normalize();
      this.turnModel( this._move, dt );
    }
    const targetSpeed = strength >= this.runThreshold ? this.runSpeed : this.walkSpeed;
    this._speed += ( targetSpeed - this._speed ) * ( 1 - Math.exp( -this.speedSharpness * dt ) );
    this._move.multiplyScalar( this._speed * dt );

    if ( this._controller.isGrounded && this._velocityY < 0 ) this._velocityY = -1;
    this._velocityY += this.gravity * dt;
    this._move.y = this._velocityY * dt;

    this._controller.move( this._move );
    if ( this.node.worldPosition.y < this.fallLimit ) this.respawn();
  }

  private turnModel( direction: Vec3, dt: number )
  {
    if ( !this.model ) return;
    // кут, при якому -Z моделі (її «обличчя») дивиться в direction
    const targetYaw = math.toDegree( Math.atan2( -direction.x, -direction.z ) );
    const delta = ( ( targetYaw - this._yaw + 540 ) % 360 ) - 180;
    this._yaw += delta * ( 1 - Math.exp( -this.turnSharpness * dt ) );
    this.model.setRotationFromEuler( 0, this._yaw, 0 );
  }

  private respawn()
  {
    this._controller!.centerWorldPosition = this._spawn;
    this._velocityY = 0;
  }
}
