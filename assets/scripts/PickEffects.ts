import { _decorator, Component, Node, Prefab, Vec3, Color, NodePool, ParticleSystem, instantiate } from 'cc';
import { gameEvents, GameEvent } from './GameEvents';
const { ccclass, property } = _decorator;

const SPORE_COLORS: Record<string, string> = {
  Porcini: '#B98552',
  Chanterelle: '#F2A93B',
  Amanita: '#E04A3A',
};
const DEFAULT_SPORE_COLOR = '#F2E6C8';

/** Хмаринка частинок там, де зник гриб — свій чи зібраний іншим гравцем. */
@ccclass( 'PickEffects' )
export class PickEffects extends Component
{
  @property( { type: Prefab, tooltip: 'Префаб з ParticleSystem (Play On Awake, без Loop)' } )
  burstPrefab: Prefab | null = null;

  @property( { tooltip: 'Через скільки секунд повернути ефект у пул (довше за життя частинок)' } )
  lifetime = 1.5;

  @property( { tooltip: 'Наскільки вище за землю зʼявляються частинки, м' } )
  height = 0.15;

  private _pool = new NodePool();
  private _color = new Color();

  onEnable()
  {
    gameEvents.on( GameEvent.MushroomHarvested, this.onHarvested, this );
  }

  onDisable()
  {
    gameEvents.off( GameEvent.MushroomHarvested, this.onHarvested, this );
  }

  onDestroy()
  {
    // вузли в пулі не в сцені, тож рушій сам їх не знищить
    this._pool.clear();
  }

  private onHarvested( position: Readonly<Vec3>, species: string )
  {
    if ( !this.burstPrefab ) return;
    const burst = this._pool.get() ?? instantiate( this.burstPrefab );
    burst.setParent( this.node );
    burst.setWorldPosition( position.x, position.y + this.height, position.z );

    const particles = burst.getComponent( ParticleSystem );
    if ( particles )
    {
      this._color.fromHEX( SPORE_COLORS[species] ?? DEFAULT_SPORE_COLOR );
      particles.startColor.color.set( this._color );
      // ефект з пулу вже колись відіграв: Play On Awake вдруге не спрацює, тож перезапускаємо самі
      particles.stop();
      particles.play();
    }
    this.scheduleOnce( () => this.recycle( burst ), this.lifetime );
  }

  private recycle( burst: Node )
  {
    if ( burst.isValid ) this._pool.put( burst );
  }
}
