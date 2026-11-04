import { _decorator, Component } from 'cc';
import { CharacterAnimator } from './CharacterAnimator';
import { gameEvents, GameEvent } from './GameEvents';
const { ccclass, property, requireComponent } = _decorator;

/** Лише на своєму гравці: звук кроку щоразу, коли пройдено ще один крок. */
@ccclass( 'Footsteps' )
@requireComponent( CharacterAnimator )
export class Footsteps extends Component
{
  @property( { tooltip: 'Довжина кроку при ходьбі, м (як у кліпі Walk)' } )
  walkStep = 0.5;

  @property( { tooltip: 'Довжина кроку при бігу, м (як у кліпі Run)' } )
  runStep = 0.74;

  private _animator: CharacterAnimator | null = null;
  private _distance = 0;

  onLoad()
  {
    this._animator = this.getComponent( CharacterAnimator );
  }

  update( dt: number )
  {
    const animator = this._animator;
    if ( !animator ) return;
    if ( animator.speed < animator.moveFrom )
    {
      // зупинився — наступний крок прозвучить одразу, щойно рушить
      this._distance = 0;
      return;
    }

    this._distance += animator.speed * dt;
    const step = animator.running ? this.runStep : this.walkStep;
    if ( this._distance >= step )
    {
      this._distance -= step;
      gameEvents.emit( GameEvent.Footstep );
    }
  }
}
