// Будує UI уроку 8 прямо у файлах сцен: кнопки кімнат і поле коду в Menu, напис коду в Main.
// Запуск (сцени в Cocos не мають бути відкриті з незбереженими змінами): node art/lesson08_ui.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSETS = join( dirname( fileURLToPath( import.meta.url ) ), '..', 'assets' );
const EDITBOX_BG = 'bd1bcaba-bd7d-4a71-b143-997c882383e4@f9941';
const MAIN_MENU = '4bac6kNpvNId4u7dZ2vh625';
const HUD = 'd2a1bKdYRhAx7TVJuqQ9BXx';
const NETWORK = '7f526aDTphFmr32vahvHbr9';

// вирівнювання Widget: TOP 1, MID 2, BOT 4, LEFT 8, CENTER 16, RIGHT 32
const ALIGN = { TOP: 1, MID: 2, BOT: 4, LEFT: 8, CENTER: 16, RIGHT: 32 };
const CANVAS = { w: 1280, h: 720 };

const newId = () => randomBytes( 16 ).toString( 'base64' ).replace( /=+$/, '' ).slice( 0, 22 );
const ref = ( i ) => ( { __id__: i } );

class Scene
{
  constructor( file )
  {
    this.file = join( ASSETS, file );
    this.j = JSON.parse( readFileSync( this.file, 'utf8' ) );
  }

  node( name, parentName )
  {
    const i = this.j.findIndex( ( o ) => o.__type__ === 'cc.Node' && o._name === name
      && ( !parentName || this.j[o._parent?.__id__]?._name === parentName ) );
    if ( i < 0 ) throw new Error( `${this.file}: немає вузла ${name}` );
    return i;
  }

  hasNode( name )
  {
    return this.j.some( ( o ) => o.__type__ === 'cc.Node' && o._name === name );
  }

  comp( nodeIndex, type )
  {
    const c = this.j[nodeIndex]._components.map( ( r ) => r.__id__ ).find( ( i ) => this.j[i].__type__ === type );
    if ( c === undefined ) throw new Error( `${this.j[nodeIndex]._name}: немає ${type}` );
    return c;
  }

  child( nodeIndex, name )
  {
    return this.j[nodeIndex]._children.map( ( r ) => r.__id__ ).find( ( i ) => this.j[i]._name === name );
  }

  /** Глибока копія вузла з дітьми й компонентами; посилання всередині піддерева переписуються. */
  cloneTree( rootIndex, newName )
  {
    const indices = [];
    const collect = ( i ) =>
    {
      indices.push( i, ...this.j[i]._components.map( ( r ) => r.__id__ ) );
      for ( const c of this.j[i]._children ) collect( c.__id__ );
    };
    collect( rootIndex );
    const map = new Map( indices.map( ( old, k ) => [old, this.j.length + k] ) );
    const remap = ( v ) =>
    {
      if ( Array.isArray( v ) ) return v.map( remap );
      if ( v && typeof v === 'object' )
      {
        if ( '__id__' in v && Object.keys( v ).length === 1 ) return map.has( v.__id__ ) ? ref( map.get( v.__id__ ) ) : v;
        const out = {};
        for ( const [k, x] of Object.entries( v ) ) out[k] = k === '_id' ? newId() : remap( x );
        return out;
      }
      return v;
    };
    for ( const old of indices ) this.j.push( remap( this.j[old] ) );
    const root = map.get( rootIndex );
    this.j[root]._name = newName;
    return root;
  }

  push( obj )
  {
    this.j.push( obj );
    return this.j.length - 1;
  }

  insertChild( parentIndex, childIndex, afterIndex )
  {
    const kids = this.j[parentIndex]._children;
    const at = afterIndex === undefined ? kids.length : kids.findIndex( ( r ) => r.__id__ === afterIndex ) + 1;
    kids.splice( at, 0, ref( childIndex ) );
    this.j[childIndex]._parent = ref( parentIndex );
  }

  setSize( nodeIndex, w, h )
  {
    const t = this.j[this.comp( nodeIndex, 'cc.UITransform' )];
    t._contentSize.width = w;
    t._contentSize.height = h;
  }

  setLabel( nodeIndex, text, fontSize, lineHeight = fontSize )
  {
    const l = this.j[this.comp( nodeIndex, 'cc.Label' )];
    l._string = text;
    l._fontSize = l._actualFontSize = fontSize;
    l._lineHeight = lineHeight;
  }

  /** Widget + позиція в редакторі (у грі Widget однаково перерахує). */
  align( nodeIndex, { top, bottom, left, right, hc, vc } )
  {
    const w = this.j[this.comp( nodeIndex, 'cc.Widget' )];
    let flags = 0;
    const set = ( flag, field, value ) =>
    {
      if ( value === undefined ) return;
      flags |= flag;
      w[field] = value;
    };
    set( ALIGN.TOP, '_top', top );
    set( ALIGN.BOT, '_bottom', bottom );
    set( ALIGN.LEFT, '_left', left );
    set( ALIGN.RIGHT, '_right', right );
    set( ALIGN.CENTER, '_horizontalCenter', hc );
    set( ALIGN.MID, '_verticalCenter', vc );
    w._alignFlags = flags;

    const t = this.j[this.comp( nodeIndex, 'cc.UITransform' )];
    const { width, height } = t._contentSize;
    const { x: ax, y: ay } = t._anchorPoint;
    const pos = this.j[nodeIndex]._lpos;
    if ( hc !== undefined ) pos.x = hc + ( ax - 0.5 ) * width;
    if ( left !== undefined ) pos.x = -CANVAS.w / 2 + left + ax * width;
    if ( right !== undefined ) pos.x = CANVAS.w / 2 - right - ( 1 - ax ) * width;
    if ( vc !== undefined ) pos.y = vc + ( ay - 0.5 ) * height;
    if ( top !== undefined ) pos.y = CANVAS.h / 2 - top - ( 1 - ay ) * height;
    if ( bottom !== undefined ) pos.y = -CANVAS.h / 2 + bottom + ay * height;
  }

  save()
  {
    writeFileSync( this.file, JSON.stringify( this.j, null, 2 ) );
  }
}

function labelNode( scene, parent, name, labelTemplate, { text, fontSize, color, width, height } )
{
  const node = scene.push( {
    __type__: 'cc.Node', _name: name, _objFlags: 0, __editorExtras__: {}, _parent: ref( parent ), _children: [],
    _active: true, _components: [], _prefab: null,
    _lpos: { __type__: 'cc.Vec3', x: -width / 2, y: height / 2, z: 0 },
    _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 }, _lscale: { __type__: 'cc.Vec3', x: 1, y: 1, z: 1 },
    _mobility: 0, _layer: scene.j[parent]._layer, _euler: { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 }, _id: newId(),
  } );
  const transform = scene.push( {
    __type__: 'cc.UITransform', _name: '', _objFlags: 0, __editorExtras__: {}, node: ref( node ), _enabled: true, __prefab: null,
    _contentSize: { __type__: 'cc.Size', width, height }, _anchorPoint: { __type__: 'cc.Vec2', x: 0, y: 1 }, _id: newId(),
  } );
  const label = scene.push( {
    ...structuredClone( labelTemplate ), node: ref( node ), _id: newId(),
    _string: text, _fontSize: fontSize, _actualFontSize: fontSize, _lineHeight: height,
    _color: { __type__: 'cc.Color', ...color, a: 255 }, _horizontalAlign: 1, _verticalAlign: 1,
    _overflow: 1, _enableWrapText: false, _enableOutline: false,
  } );
  scene.j[node]._components.push( ref( transform ), ref( label ) );
  scene.insertChild( parent, node );
  return label;
}

function buildMenu()
{
  const s = new Scene( 'Menu.scene' );
  if ( s.hasNode( 'CreateButton' ) ) return console.log( 'Menu: вже зроблено, пропускаю' );
  const canvas = s.node( 'Canvas' );
  const play = s.node( 'PlayButton' );
  const playLabel = s.child( play, 'Label' );

  s.setLabel( playLabel, 'Грати самому', 40, 50 );
  s.align( play, { hc: -250, vc: 0 } );

  const create = s.cloneTree( play, 'CreateButton' );
  s.setSize( create, 360, 90 );
  s.setLabel( s.child( create, 'Label' ), 'Створити кімнату', 34, 40 );
  s.align( create, { hc: 250, vc: 20 } );
  s.insertChild( canvas, create, play );

  const join = s.cloneTree( play, 'JoinButton' );
  s.setSize( join, 360, 80 );
  s.setLabel( s.child( join, 'Label' ), 'Приєднатися', 34, 40 );
  s.align( join, { hc: 250, vc: -170 } );

  // поле коду: фон EditBox + два Label (текст і підказка)
  const widgetTemplate = s.j[s.comp( play, 'cc.Widget' )];
  const spriteTemplate = s.j[s.comp( play, 'cc.Sprite' )];
  const labelTemplate = s.j[s.comp( playLabel, 'cc.Label' )];
  const input = s.push( {
    ...structuredClone( s.j[play] ), _name: 'CodeInput', _children: [], _components: [], _id: newId(),
  } );
  const t = s.push( { ...structuredClone( s.j[s.comp( play, 'cc.UITransform' )] ), node: ref( input ), _id: newId() } );
  const sprite = s.push( {
    ...structuredClone( spriteTemplate ), node: ref( input ), _id: newId(),
    _spriteFrame: { __uuid__: EDITBOX_BG, __expectedType__: 'cc.SpriteFrame' }, _type: 1, _sizeMode: 0,
  } );
  const editBox = s.push( {
    __type__: 'cc.EditBox', _name: '', _objFlags: 0, __editorExtras__: {}, node: ref( input ), _enabled: true, __prefab: null,
    editingDidBegan: [], textChanged: [], editingDidEnded: [], editingReturn: [],
    _textLabel: null, _placeholderLabel: null, _returnType: 0, _string: '', _tabIndex: 0,
    _backgroundImage: { __uuid__: EDITBOX_BG, __expectedType__: 'cc.SpriteFrame' },
    _inputFlag: 4, _inputMode: 6, _maxLength: 4, _id: newId(),
  } );
  const widget = s.push( { ...structuredClone( widgetTemplate ), node: ref( input ), _id: newId() } );
  s.j[input]._components = [ref( t ), ref( sprite ), ref( editBox ), ref( widget )];
  s.setSize( input, 360, 70 );
  s.align( input, { hc: 250, vc: -80 } );
  s.insertChild( canvas, input, create );
  s.insertChild( canvas, join, input );

  const size = { width: 360, height: 70 };
  s.j[editBox]._textLabel = ref( labelNode( s, input, 'TEXT_LABEL', labelTemplate, { ...size, text: '', fontSize: 36, color: { r: 40, g: 40, b: 40 } } ) );
  s.j[editBox]._placeholderLabel = ref( labelNode( s, input, 'PLACEHOLDER_LABEL', labelTemplate, { ...size, text: 'КОД ДРУГА', fontSize: 30, color: { r: 150, g: 150, b: 150 } } ) );

  const reset = s.node( 'ResetButton' );
  s.setSize( reset, 240, 60 );
  s.setLabel( s.child( reset, 'Label' ), 'Скинути прогрес', 24, 30 );
  s.align( reset, { top: 40, right: 40 } );

  const total = s.node( 'TotalLabel' );
  s.align( total, { top: 230, hc: 0 } );

  const menu = s.j.find( ( o ) => o.__type__ === MAIN_MENU );
  menu.createButton = ref( create );
  menu.joinButton = ref( join );
  menu.codeInput = ref( editBox );

  s.save();
  console.log( 'Menu: готово' );
}

function buildMain()
{
  const s = new Scene( 'Main.scene' );
  const hud = s.j.find( ( o ) => o.__type__ === HUD );
  const net = s.j.find( ( o ) => o.__type__ === NETWORK );
  delete net.followSharpness;
  net.interpolationDelay ??= 0.15;

  if ( s.hasNode( 'RoomLabel' ) )
  {
    s.save();
    return console.log( 'Main: RoomLabel вже є, оновив лише NetworkManager' );
  }
  const canvas = s.node( 'Canvas' );
  const basket = s.node( 'BasketLabel' );
  const room = s.cloneTree( basket, 'RoomLabel' );
  s.j[s.comp( room, 'cc.UITransform' )]._anchorPoint = { __type__: 'cc.Vec2', x: 0.5, y: 1 };
  s.setLabel( room, 'Кімната ABCD', 32, 40 );
  s.setSize( room, 220, 40 );
  s.align( room, { top: 40, hc: 0 } );
  s.insertChild( canvas, room, basket );
  hud.roomLabel = ref( s.comp( room, 'cc.Label' ) );

  s.save();
  console.log( 'Main: готово' );
}

buildMenu();
buildMain();
