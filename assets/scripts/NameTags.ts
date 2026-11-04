import { _decorator, Component, Node, Label, Camera, Vec3, Color } from 'cc';
import { gameEvents, GameEvent } from './GameEvents';
import { playerColor } from './PlayerName';
const { ccclass, property } = _decorator;

interface Tag
{
  target: Node;
  label: Node;
}

const OUTLINE = new Color( 31, 58, 26 );

/** Імена над іншими гравцями. Вішається на порожній UI-вузол у Canvas. */
@ccclass( 'NameTags' )
export class NameTags extends Component
{
  @property( { type: Camera, tooltip: '3D-камера, якою дивимось на світ (Main Camera)' } )
  worldCamera: Camera | null = null;

  @property( { tooltip: 'На якій висоті над ногами гравця висить імʼя, м' } )
  height = 2.1;

  @property
  fontSize = 28;

  private _tags = new Map<string, Tag>();
  private _world = new Vec3();
  private _ui = new Vec3();
  private _toTarget = new Vec3();

  onEnable()
  {
    gameEvents.on( GameEvent.RemotePlayerJoined, this.onJoined, this );
    gameEvents.on( GameEvent.RemotePlayerLeft, this.onLeft, this );
  }

  onDisable()
  {
    gameEvents.off( GameEvent.RemotePlayerJoined, this.onJoined, this );
    gameEvents.off( GameEvent.RemotePlayerLeft, this.onLeft, this );
  }

  lateUpdate()
  {
    const camera = this.worldCamera;
    if ( !camera ) return;
    this._tags.forEach( ( tag ) =>
    {
      Vec3.copy( this._world, tag.target.worldPosition );
      this._world.y += this.height;
      // за спиною камери convertToUINode дає дзеркальну точку — ховаємо
      Vec3.subtract( this._toTarget, this._world, camera.node.worldPosition );
      const inFront = Vec3.dot( this._toTarget, camera.node.forward ) > 0;
      tag.label.active = inFront;
      if ( !inFront ) return;
      camera.convertToUINode( this._world, this.node, this._ui );
      tag.label.setPosition( this._ui );
    } );
  }

  private onJoined( id: string, target: Node, name: string, color: number )
  {
    this.onLeft( id );
    const node = new Node( `Name ${name}` );
    // вузол, створений кодом, має шар DEFAULT — камера Canvas його не побачить
    node.layer = this.node.layer;
    const label = node.addComponent( Label );
    label.string = name;
    label.fontSize = this.fontSize;
    label.lineHeight = this.fontSize;
    label.color = playerColor( color );
    label.enableOutline = true;
    label.outlineColor = OUTLINE;
    label.outlineWidth = 3;
    node.setParent( this.node );
    this._tags.set( id, { target, label: node } );
  }

  private onLeft( id: string )
  {
    const tag = this._tags.get( id );
    if ( !tag ) return;
    tag.label.destroy();
    this._tags.delete( id );
  }
}
