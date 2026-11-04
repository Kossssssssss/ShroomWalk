import './NativePolyfills';
import { _decorator, Component, Node, Prefab, Vec3, instantiate } from 'cc';
import { Client, Callbacks, Room } from '@colyseus/sdk';
import { MushroomSpawner } from './MushroomSpawner';
import { gameEvents, GameEvent } from './GameEvents';
import { playerName } from './PlayerName';
import { session } from './Session';
import { serverUrl, wakeServer, clientOptions } from './ServerConfig';
const { ccclass, property } = _decorator;

// хостинг присипляє сервер без запитів; WebSocket-повідомлення гри можуть не рахуватись
const KEEP_AWAKE_INTERVAL = 300;

interface Snapshot
{
  t: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

interface RemotePlayer
{
  node: Node;
  state: any;
  snapshots: Snapshot[];
}

@ccclass( 'NetworkManager' )
export class NetworkManager extends Component
{
  @property( { tooltip: 'Локальний сервер поза браузером (IP ПК). Не потрібна, якщо в ServerConfig задано ONLINE_SERVER' } )
  serverHost = 'localhost';

  @property
  serverPort = 2567;

  @property
  roomName = 'glade';

  @property( { type: Node, tooltip: 'Свій гравець (вузол з PlayerController)' } )
  localPlayer: Node | null = null;

  @property( { type: Node, tooltip: 'Модель свого гравця — з неї беремо поворот' } )
  localModel: Node | null = null;

  @property( { type: Prefab, tooltip: 'Як виглядає інший гравець' } )
  remotePrefab: Prefab | null = null;

  @property( { type: MushroomSpawner, tooltip: 'Спавнер грибів (вузол Mushrooms): у кооперативі гриби бере з сервера' } )
  spawner: MushroomSpawner | null = null;

  @property( { tooltip: 'Скільки разів на секунду надсилати свою позицію' } )
  sendRate = 10;

  @property( { tooltip: 'Наскільки в минулому показуємо інших гравців, с. Більше — плавніше, але з більшою затримкою' } )
  interpolationDelay = 0.15;

  private _room: Room | null = null;
  private _remotes = new Map<string, RemotePlayer>();
  private _time = 0;
  private _sendTimer = 0;
  private _lastSent = new Vec3( NaN, NaN, NaN );
  private _lastYaw = NaN;

  start()
  {
    if ( session.mode !== 'solo' ) this.connect();
  }

  onEnable()
  {
    gameEvents.on( GameEvent.HarvestRequested, this.onHarvestRequested, this );
  }

  onDisable()
  {
    gameEvents.off( GameEvent.HarvestRequested, this.onHarvestRequested, this );
  }

  // Cocos обнуляє поля знищеного компонента, тому спершу відписуємось, а потім виходимо
  onDestroy()
  {
    const room = this._room;
    this._room = null;
    if ( !room ) return;
    room.removeAllListeners();
    room.leave();
  }

  update( dt: number )
  {
    this._time += dt;
    if ( !this._room ) return;

    const renderTime = this._time - this.interpolationDelay;
    this._remotes.forEach( ( remote ) =>
    {
      this.recordSnapshot( remote );
      this.showAt( remote, renderTime );
    } );

    this._sendTimer -= dt;
    if ( this._sendTimer <= 0 )
    {
      this._sendTimer = 1 / this.sendRate;
      this.sendPose();
    }
  }

  private async connect()
  {
    const client = new Client( serverUrl( this.serverHost, this.serverPort ), clientOptions() );
    const options = { ...this.pose(), name: playerName() };
    // сплячий сервер на хостингу прокидається до хвилини — хай гравець знає, що ми не зависли
    gameEvents.emit( GameEvent.Toast, 'Підключаємось до сервера…' );
    try
    {
      const room = session.mode === 'join'
        ? await client.joinById( session.code, options )
        : await client.create( this.roomName, options );
      // поки чекали на сервер, сцену могли вже закрити
      if ( !this.isValid )
      {
        room.leave();
        return;
      }
      this._room = room;
      this.listen( room );
      this.schedule( wakeServer, KEEP_AWAKE_INTERVAL );
      gameEvents.emit( GameEvent.RoomJoined, room.roomId );
      gameEvents.emit( GameEvent.Toast, session.mode === 'join' ? `Ви в кімнаті ${room.roomId}` : `Кімнату створено, код ${room.roomId}` );
    } catch ( error )
    {
      console.warn( '[Network] не вдалося зайти в кімнату', error );
      if ( !this.isValid ) return;
      const text = session.mode === 'join' ? `Кімнату ${session.code} не знайдено — граємо самі` : 'Сервер недоступний — граємо самі';
      gameEvents.emit( GameEvent.Toast, text );
    }
  }

  private listen( room: Room )
  {
    this.spawner?.useRemote();

    const callbacks = Callbacks.get( room );
    callbacks.onAdd( 'players', ( player: any, sessionId: string ) =>
    {
      if ( this.isValid && sessionId !== room.sessionId ) this.spawnRemote( sessionId, player );
    } );
    callbacks.onRemove( 'players', ( _player: any, sessionId: string ) =>
    {
      if ( this.isValid ) this.removeRemote( sessionId );
    } );
    callbacks.onAdd( 'mushrooms', ( m: any, id: string ) =>
    {
      if ( this.isValid ) this.spawner?.spawnRemote( id, m.species, m.x, m.z, m.yaw, m.scale );
    } );
    callbacks.onRemove( 'mushrooms', ( _m: any, id: string ) =>
    {
      if ( this.isValid ) this.spawner?.removeRemote( id );
    } );
    room.onMessage( 'picked', ( message: { species: string } ) =>
    {
      if ( this.isValid ) gameEvents.emit( GameEvent.HarvestConfirmed, message.species );
    } );
    room.onLeave( ( code: number ) =>
    {
      if ( !this.isValid ) return;
      console.warn( `[Network] з'єднання закрито, код ${code}` );
      this._room = null;
      this.unschedule( wakeServer );
      Array.from( this._remotes.keys() ).forEach( ( id ) => this.removeRemote( id, false ) );
      this.spawner?.useLocal();
      gameEvents.emit( GameEvent.RoomLeft );
      gameEvents.emit( GameEvent.Toast, 'Звʼязок із сервером втрачено — граємо самі' );
    } );
  }

  private onHarvestRequested( id: string )
  {
    this._room?.send( 'pick', { id } );
  }

  private recordSnapshot( remote: RemotePlayer )
  {
    const s = remote.state;
    const list = remote.snapshots;
    const last = list[list.length - 1];
    if ( last.x === s.x && last.y === s.y && last.z === s.z && last.yaw === s.yaw ) return;

    // гравець довго стояв: без цього перший крок розтягнувся б на весь час стояння
    if ( this._time - last.t > 2.5 / this.sendRate ) list.push( { ...last, t: this._time - 1 / this.sendRate } );
    list.push( { t: this._time, x: s.x, y: s.y, z: s.z, yaw: s.yaw } );
  }

  private showAt( remote: RemotePlayer, renderTime: number )
  {
    const list = remote.snapshots;
    // старі знімки не потрібні, але один до renderTime лишаємо — від нього інтерполюємо
    while ( list.length > 2 && list[1].t <= renderTime ) list.shift();

    const a = list[0];
    const b = list[1];
    const k = b && renderTime > a.t ? Math.min( 1, ( renderTime - a.t ) / ( b.t - a.t ) ) : 0;
    const to = b ?? a;
    remote.node.setWorldPosition( a.x + ( to.x - a.x ) * k, a.y + ( to.y - a.y ) * k, a.z + ( to.z - a.z ) * k );
    const delta = ( ( to.yaw - a.yaw + 540 ) % 360 ) - 180;
    remote.node.setRotationFromEuler( 0, a.yaw + delta * k, 0 );
  }

  private spawnRemote( sessionId: string, state: any )
  {
    if ( !this.remotePrefab || this._remotes.has( sessionId ) ) return;
    const node = instantiate( this.remotePrefab );
    node.setParent( this.node );
    const first: Snapshot = { t: this._time, x: state.x, y: state.y, z: state.z, yaw: state.yaw };
    this._remotes.set( sessionId, { node, state, snapshots: [first] } );
    this.showAt( this._remotes.get( sessionId )!, this._time );
    gameEvents.emit( GameEvent.RemotePlayerJoined, sessionId, node, state.name, state.color );
    gameEvents.emit( GameEvent.Toast, `${state.name} на галявині` );
  }

  private removeRemote( sessionId: string, announce = true )
  {
    const remote = this._remotes.get( sessionId );
    if ( !remote ) return;
    gameEvents.emit( GameEvent.RemotePlayerLeft, sessionId );
    if ( announce ) gameEvents.emit( GameEvent.Toast, `${remote.state.name} пішов додому` );
    remote.node.destroy();
    this._remotes.delete( sessionId );
  }

  private sendPose()
  {
    if ( !this._room || !this.localPlayer ) return;
    const pose = this.pose();
    if ( Vec3.squaredDistance( this.localPlayer.worldPosition, this._lastSent ) < 0.0001 && Math.abs( pose.yaw - this._lastYaw ) < 1 ) return;
    this._lastSent.set( pose.x, pose.y, pose.z );
    this._lastYaw = pose.yaw;
    this._room.send( 'move', pose );
  }

  private pose()
  {
    const position = this.localPlayer?.worldPosition ?? Vec3.ZERO;
    const yaw = this.localModel?.eulerAngles.y ?? 0;
    return { x: position.x, y: position.y, z: position.z, yaw };
  }
}
