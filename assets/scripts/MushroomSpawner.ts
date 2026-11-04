import { _decorator, Component, Node, Prefab, NodePool, Vec3, instantiate, geometry, PhysicsSystem, math, input, Input, EventKeyboard, KeyCode, CCFloat, Tween, tween } from 'cc';
import { gameEvents, GameEvent } from './GameEvents';
const { ccclass, property } = _decorator;

// не 0: нульовий масштаб ламає фізику й нормалі
const TINY = 0.01;

@ccclass( 'MushroomSpawner' )
export class MushroomSpawner extends Component
{
  @property( { type: [Prefab], tooltip: 'Які гриби можуть вирости' } )
  prefabs: Prefab[] = [];

  @property( { type: [CCFloat], tooltip: 'Шанс кожного виду, у тому ж порядку, що Prefabs. Порожньо = порівну' } )
  weights: number[] = [];

  @property( { type: Node, tooltip: 'Земля: гриб росте тільки там, де промінь згори влучив саме в неї' } )
  ground: Node | null = null;

  @property( { tooltip: 'Скільки грибів на галявині одночасно' } )
  count = 20;

  @property( { tooltip: 'Радіус зони спавну навколо цього вузла, м' } )
  radius = 9;

  @property( { tooltip: 'Мінімальна відстань від нової сімʼї до будь-якого гриба, м' } )
  minDistance = 0.8;

  @property( { tooltip: 'Скільки ще грибів того ж виду може вирости поруч (0 = без сімей)' } )
  familyMaxExtra = 3;

  @property( { tooltip: 'Радіус сімʼї навколо першого гриба, м' } )
  familyRadius = 0.8;

  @property( { tooltip: 'Мінімальна відстань між грибами всередині сімʼї, м' } )
  familyMinDistance = 0.3;

  @property( { tooltip: 'Через скільки секунд після збору на галявині виростає новий гриб' } )
  respawnDelay = 10;

  @property( { tooltip: 'Скільки триває «виростання» нового гриба, с' } )
  growTime = 0.4;

  @property
  minScale = 1.3;

  @property
  maxScale = 1.7;

  private _pools = new Map<Prefab, NodePool>();
  private _prefabOf = new Map<Node, Prefab>();
  private _alive: Node[] = [];
  private _created = 0;
  private _remote = false;
  private _byId = new Map<string, Node>();
  private _idOf = new Map<Node, string>();

  private _ray = new geometry.Ray();
  private _point = new Vec3();
  private _familyCenter = new Vec3();

  start()
  {
    // колайдери потрапляють у фізичний світ лише на першому кроці фізики
    this.scheduleOnce( () => this.spawnAll(), 0 );
  }

  onEnable()
  {
    input.on( Input.EventType.KEY_DOWN, this.onKeyDown, this );
  }

  onDisable()
  {
    input.off( Input.EventType.KEY_DOWN, this.onKeyDown, this );
  }

  private onKeyDown( event: EventKeyboard )
  {
    if ( event.keyCode === KeyCode.KEY_R ) this.reseed();
  }

  get isRemote()
  {
    return this._remote;
  }

  /** Гриби тепер вирощує сервер: свої прибираємо й самі більше не садимо. */
  useRemote()
  {
    this._remote = true;
    this.unscheduleAllCallbacks();
    for ( const mushroom of [...this._alive] ) this.despawn( mushroom );
  }

  /** Зʼєднання з сервером втрачено — знову вирощуємо самі. */
  useLocal()
  {
    if ( !this._remote ) return;
    this._remote = false;
    for ( const mushroom of [...this._alive] ) this.despawn( mushroom );
    this.spawnAll();
  }

  spawnRemote( id: string, species: string, x: number, z: number, yaw: number, scale: number )
  {
    const prefab = this.prefabs.find( ( p ) => p.name === species );
    if ( !prefab || this._byId.has( id ) ) return;
    this._point.set( x, 0, z );
    const mushroom = this.place( prefab, this._point );
    mushroom.setRotationFromEuler( 0, yaw, 0 );
    this.grow( mushroom, scale );
    this._byId.set( id, mushroom );
    this._idOf.set( mushroom, id );
  }

  removeRemote( id: string )
  {
    const mushroom = this._byId.get( id );
    if ( !mushroom ) return;
    this.despawn( mushroom, true );
  }

  idOf( mushroom: Node ): string | null
  {
    return this._idOf.get( mushroom ) ?? null;
  }

  spawnAll()
  {
    if ( this._remote ) return;
    while ( this._alive.length < this.count )
    {
      if ( !this.spawnOne() ) break;
    }
  }

  spawnOne(): Node | null
  {
    if ( this.prefabs.length === 0 ) return null;
    const center = this.node.worldPosition;
    for ( let attempt = 0; attempt < 30; attempt++ )
    {
      if ( !this.randomGroundPoint( this._point, center.x, center.z, this.radius ) ) continue;
      if ( !this.isFarFromOthers( this._point, this.minDistance ) ) continue;
      const prefab = this.pickPrefab();
      const first = this.place( prefab, this._point );
      this.spawnFamily( prefab, first.worldPosition );
      return first;
    }
    return null;
  }

  reseed()
  {
    if ( this._remote ) return;
    for ( const mushroom of [...this._alive] ) this.despawn( mushroom );
    this.spawnAll();
    const pooled = [...this._pools.values()].map( ( pool ) => pool.size() );
    console.log( `[MushroomSpawner] alive ${this._alive.length}, created ${this._created}, in pools ${pooled.join( '/' )}` );
  }

  findNearest( position: Readonly<Vec3>, maxDistance: number ): Node | null
  {
    let nearest: Node | null = null;
    let bestSqr = maxDistance * maxDistance;
    for ( const mushroom of this._alive )
    {
      const p = mushroom.worldPosition;
      const dx = p.x - position.x;
      const dz = p.z - position.z;
      const sqr = dx * dx + dz * dz;
      if ( sqr < bestSqr )
      {
        bestSqr = sqr;
        nearest = mushroom;
      }
    }
    return nearest;
  }

  speciesOf( mushroom: Node ): string
  {
    return this._prefabOf.get( mushroom )?.name ?? '';
  }

  harvest( mushroom: Node )
  {
    this.despawn( mushroom, true );
    this.scheduleOnce( () => this.spawnAll(), this.respawnDelay );
  }

  /** animated — гриб зібрали: підстрибне й зникне, а на його місці спрацюють ефекти. */
  despawn( mushroom: Node, animated = false )
  {
    const index = this._alive.indexOf( mushroom );
    if ( index < 0 ) return;
    this._alive.splice( index, 1 );
    const id = this._idOf.get( mushroom );
    if ( id !== undefined )
    {
      this._idOf.delete( mushroom );
      this._byId.delete( id );
    }
    const pool = this.poolFor( this._prefabOf.get( mushroom )! );
    Tween.stopAllByTarget( mushroom );
    if ( !animated )
    {
      pool.put( mushroom );
      return;
    }

    gameEvents.emit( GameEvent.MushroomHarvested, mushroom.worldPosition, this.speciesOf( mushroom ) );
    const up = mushroom.scale.x * 1.3;
    // у пул — лише коли анімація скінчилась; зі списку живих гриб уже прибрано, тож його не зберуть двічі
    tween( mushroom )
      .to( 0.08, { scale: new Vec3( up, up, up ) }, { easing: 'quadOut' } )
      .to( 0.15, { scale: new Vec3( TINY, TINY, TINY ) }, { easing: 'backIn' } )
      .call( () => pool.put( mushroom ) )
      .start();
  }

  private spawnFamily( prefab: Prefab, around: Readonly<Vec3> )
  {
    // копія: _point перезаписується під час пошуку місць для сусідів
    Vec3.copy( this._familyCenter, around );
    const extra = math.randomRangeInt( 0, this.familyMaxExtra + 1 );
    for ( let i = 0; i < extra && this._alive.length < this.count; i++ )
    {
      for ( let attempt = 0; attempt < 8; attempt++ )
      {
        if ( !this.randomGroundPoint( this._point, this._familyCenter.x, this._familyCenter.z, this.familyRadius ) ) continue;
        if ( !this.isFarFromOthers( this._point, this.familyMinDistance ) ) continue;
        this.place( prefab, this._point );
        break;
      }
    }
  }

  private pickPrefab(): Prefab
  {
    if ( this.weights.length !== this.prefabs.length )
    {
      return this.prefabs[math.randomRangeInt( 0, this.prefabs.length )];
    }
    let total = 0;
    for ( const w of this.weights ) total += Math.max( 0, w );
    if ( total <= 0 ) return this.prefabs[math.randomRangeInt( 0, this.prefabs.length )];

    let r = Math.random() * total;
    for ( let i = 0; i < this.prefabs.length; i++ )
    {
      r -= Math.max( 0, this.weights[i] );
      if ( r <= 0 ) return this.prefabs[i];
    }
    return this.prefabs[this.prefabs.length - 1];
  }

  private place( prefab: Prefab, position: Vec3 ): Node
  {
    let mushroom = this.poolFor( prefab ).get();
    if ( !mushroom )
    {
      mushroom = instantiate( prefab );
      this._created++;
    }
    this._prefabOf.set( mushroom, prefab );
    mushroom.setParent( this.node );
    mushroom.setWorldPosition( position );
    mushroom.setRotationFromEuler( 0, math.randomRange( 0, 360 ), 0 );
    const scale = math.randomRange( this.minScale, this.maxScale );
    this.grow( mushroom, scale );
    this._alive.push( mushroom );
    return mushroom;
  }

  private grow( mushroom: Node, scale: number )
  {
    Tween.stopAllByTarget( mushroom );
    mushroom.setScale( TINY, TINY, TINY );
    tween( mushroom ).to( this.growTime, { scale: new Vec3( scale, scale, scale ) }, { easing: 'backOut' } ).start();
  }

  private randomGroundPoint( out: Vec3, centerX: number, centerZ: number, radius: number ): boolean
  {
    // рівномірно по кругу: без sqrt точки збиралися б у центрі
    const angle = math.randomRange( 0, Math.PI * 2 );
    const distance = radius * Math.sqrt( Math.random() );
    const x = centerX + Math.cos( angle ) * distance;
    const z = centerZ + Math.sin( angle ) * distance;

    geometry.Ray.set( this._ray, x, 20, z, 0, -1, 0 );
    const physics = PhysicsSystem.instance;
    if ( !physics.raycastClosest( this._ray, 0xffffffff, 40 ) ) return false;
    const hit = physics.raycastClosestResult;
    if ( hit.collider.node !== this.ground ) return false;
    Vec3.copy( out, hit.hitPoint );
    return true;
  }

  private isFarFromOthers( point: Vec3, minDistance: number ): boolean
  {
    const minSqr = minDistance * minDistance;
    for ( const other of this._alive )
    {
      if ( Vec3.squaredDistance( other.worldPosition, point ) < minSqr ) return false;
    }
    return true;
  }

  private poolFor( prefab: Prefab ): NodePool
  {
    let pool = this._pools.get( prefab );
    if ( !pool )
    {
      pool = new NodePool();
      this._pools.set( prefab, pool );
    }
    return pool;
  }
}
