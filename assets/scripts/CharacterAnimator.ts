import { _decorator, Component, Vec3, SkeletalAnimation, AnimationClip } from 'cc';
const { ccclass, property, requireComponent } = _decorator;

const RUN_HYSTERESIS = 0.3;
const TELEPORT_SPEED = 20;

/** Сам дивиться, як швидко рухається його вузол, і вмикає Idle / Walk / Run. Тому однаково працює і для свого гравця, і для чужого. */
@ccclass( 'CharacterAnimator' )
@requireComponent( SkeletalAnimation )
export class CharacterAnimator extends Component
{
  @property
  idleClip = 'Idle';

  @property
  walkClip = 'Walk';

  @property
  runClip = 'Run';

  @property( { tooltip: 'Швидкість, з якої персонаж уже йде, а не стоїть, м/с' } )
  moveFrom = 0.3;

  @property( { tooltip: 'Швидкість, з якої персонаж біжить, м/с' } )
  runFrom = 4.2;

  @property( { tooltip: 'За якої швидкості Walk грає зі швидкістю 1 (ноги не ковзають), м/с' } )
  walkClipSpeed = 1.9;

  @property( { tooltip: 'За якої швидкості Run грає зі швидкістю 1, м/с' } )
  runClipSpeed = 3.7;

  @property( { tooltip: 'Тривалість плавного переходу між кліпами, с' } )
  fadeTime = 0.2;

  @property( { tooltip: 'Наскільки швидко згладжується виміряна швидкість' } )
  speedSharpness = 10;

  private _anim: SkeletalAnimation | null = null;
  private _last = new Vec3();
  private _speed = 0;
  private _current = '';

  get speed()
  {
    return this._speed;
  }

  get running()
  {
    return this._current === this.runClip;
  }

  onLoad()
  {
    this._anim = this.getComponent( SkeletalAnimation );
    if ( !this._anim ) return;
    // запечені анімації не вміють змішуватись: crossFade став би різким перемиканням
    this._anim.useBakedAnimation = false;
  }

  start()
  {
    // стани кліпів SkeletalAnimation створює у своєму onLoad, тож шукаємо їх тут, коли всі onLoad уже відпрацювали
    for ( const name of [this.idleClip, this.walkClip, this.runClip] )
    {
      const state = this._anim?.getState( name );
      if ( state ) state.wrapMode = AnimationClip.WrapMode.Loop;
      else console.warn( `[CharacterAnimator] немає кліпа «${name}»` );
    }
    Vec3.copy( this._last, this.node.worldPosition );
    this.play( this.idleClip, 1 );
  }

  update( dt: number )
  {
    if ( !this._anim || dt <= 0 ) return;

    const position = this.node.worldPosition;
    const dx = position.x - this._last.x;
    const dz = position.z - this._last.z;
    Vec3.copy( this._last, position );
    const measured = Math.sqrt( dx * dx + dz * dz ) / dt;
    // респавн чи перший знімок з мережі — це стрибок, а не біг
    if ( measured < TELEPORT_SPEED )
    {
      this._speed += ( measured - this._speed ) * ( 1 - Math.exp( -this.speedSharpness * dt ) );
    }

    // поріг з запасом: на межі ходьби й бігу кліпи не мерехтять
    const runFrom = this.running ? this.runFrom - RUN_HYSTERESIS : this.runFrom;
    if ( this._speed < this.moveFrom ) this.play( this.idleClip, 1 );
    else if ( this._speed < runFrom ) this.play( this.walkClip, this._speed / this.walkClipSpeed );
    else this.play( this.runClip, this._speed / this.runClipSpeed );
  }

  private play( clip: string, speed: number )
  {
    if ( !this._anim ) return;
    if ( clip !== this._current )
    {
      this._current = clip;
      this._anim.crossFade( clip, this.fadeTime );
    }
    const state = this._anim.getState( clip );
    if ( state ) state.speed = speed;
  }
}
