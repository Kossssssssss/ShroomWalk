import { _decorator, Component, Node, Prefab, NodePool, Vec3, instantiate, geometry, PhysicsSystem, math, input, Input, EventKeyboard, KeyCode, CCFloat } from 'cc';
const { ccclass, property } = _decorator;

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

  @property
  minScale = 1.3;

  @property
  maxScale = 1.7;

  private _pools = new Map<Prefab, NodePool>();
  private _prefabOf = new Map<Node, Prefab>();
  private _alive: Node[] = [];
  private _created = 0;

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

  spawnAll()
  {
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
    this.despawn( mushroom );
    this.scheduleOnce( () => this.spawnAll(), this.respawnDelay );
  }

  despawn( mushroom: Node )
  {
    const index = this._alive.indexOf( mushroom );
    if ( index < 0 ) return;
    this._alive.splice( index, 1 );
    this.poolFor( this._prefabOf.get( mushroom )! ).put( mushroom );
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
    mushroom.setScale( scale, scale, scale );
    this._alive.push( mushroom );
    return mushroom;
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
