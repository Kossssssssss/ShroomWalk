import { _decorator, Component, AudioClip, AudioSource } from 'cc';
import { gameEvents, GameEvent } from './GameEvents';
const { ccclass, property, requireComponent } = _decorator;

/** Короткі звуки на події гри. Фон лісу — окремий AudioSource без коду. */
@ccclass( 'Sfx' )
@requireComponent( AudioSource )
export class Sfx extends Component
{
  @property( { type: AudioClip } )
  pickClip: AudioClip | null = null;

  @property( { type: AudioClip } )
  inedibleClip: AudioClip | null = null;

  @property( { type: [AudioClip], tooltip: 'Кілька варіантів кроку: однаковий звук щоразу швидко набридає' } )
  stepClips: AudioClip[] = [];

  @property( { range: [0, 1, 0.05], slide: true } )
  pickVolume = 0.8;

  @property( { range: [0, 1, 0.05], slide: true } )
  stepVolume = 0.35;

  private _source: AudioSource | null = null;
  private _lastStep = -1;

  onLoad()
  {
    this._source = this.getComponent( AudioSource );
  }

  onEnable()
  {
    gameEvents.on( GameEvent.MushroomPicked, this.onMushroomPicked, this );
    gameEvents.on( GameEvent.Footstep, this.onFootstep, this );
  }

  onDisable()
  {
    gameEvents.off( GameEvent.MushroomPicked, this.onMushroomPicked, this );
    gameEvents.off( GameEvent.Footstep, this.onFootstep, this );
  }

  private onMushroomPicked( species: string, added: boolean )
  {
    this.play( added ? this.pickClip : this.inedibleClip, this.pickVolume );
  }

  private onFootstep()
  {
    const count = this.stepClips.length;
    if ( count === 0 ) return;
    // будь-який, крім щойно зіграного
    let index = Math.floor( Math.random() * count );
    if ( count > 1 && index === this._lastStep ) index = ( index + 1 ) % count;
    this._lastStep = index;
    this.play( this.stepClips[index], this.stepVolume * ( 0.8 + Math.random() * 0.2 ) );
  }

  private play( clip: AudioClip | null, volume: number )
  {
    // playOneShot не перериває інших звуків цього ж AudioSource
    if ( clip && this._source ) this._source.playOneShot( clip, volume );
  }
}
