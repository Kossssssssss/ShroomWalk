// Одягає меню й HUD у набір з art/generated/ui (див. UI_STYLE.md і макет ui_sheet.png):
// пише .meta текстур із 9-slice і перебудовує вузли Menu.scene та Main.scene.
// Запуск (сцени в Cocos не мають бути відкриті з незбереженими змінами): node art/ui_skin.mjs
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { PNG } = createRequire( 'D:/personal-projects/image-mcp/package.json' )( 'pngjs' );

const ROOT = join( dirname( fileURLToPath( import.meta.url ) ), '..' );
const ASSETS = join( ROOT, 'assets' );
const UI_TEX = join( ASSETS, 'textures', 'ui' );
const GENERATED = join( ROOT, '..', 'art', 'generated', 'ui' );

const ALIGN = { TOP: 1, MID: 2, BOT: 4, LEFT: 8, CENTER: 16, RIGHT: 32 };
const CANVAS = { w: 1280, h: 720 };
const SPRITE = { SIMPLE: 0, SLICED: 1 };
const OVERFLOW = { NONE: 0, SHRINK: 2 };

const COLOR = {
  white: 'F4F1EA', barkDark: '46322A', bark: '5E4331',
  porciniCap: '8A5532', porciniCapDark: '6E4127', pine: '2F6B45',
};

const newId = () => randomBytes( 16 ).toString( 'base64' ).replace( /[=+/]/g, '' ).slice( 0, 22 );
const ref = ( i ) => ( { __id__: i } );
const color = ( hex, a = 255 ) => ( {
  __type__: 'cc.Color', r: parseInt( hex.slice( 0, 2 ), 16 ), g: parseInt( hex.slice( 2, 4 ), 16 ), b: parseInt( hex.slice( 4, 6 ), 16 ), a,
} );

// ---------- текстури ----------

// 9-slice: L / R / T / B з таблиці UI_STYLE.md, розділ 5
const SLICED = {
  btn_primary: [24, 24, 24, 28], btn_secondary: [24, 24, 24, 28], btn_danger: [24, 24, 24, 28],
  panel: [32, 32, 32, 32], input_field: [24, 24, 24, 24], input_field_focus: [24, 24, 24, 24],
  progress_frame: [22, 22, 0, 0], progress_fill: [14, 14, 0, 0], toast_plate: [36, 36, 0, 0],
};
// прозорі поля обрізає Cocos (Trim Type: Auto), тож розміри вузлів рахуємо за вмістом
const TRIMMED = ['icon_basket', 'icon_coop', 'icon_quest', 'glyph_play', 'glyph_home', 'glyph_reset', 'logo'];
const WHOLE = ['btn_round', 'btn_round_secondary'];

function alphaBox( png )
{
  let minX = png.width, minY = png.height, maxX = -1, maxY = -1;
  for ( let y = 0; y < png.height; y++ )
  {
    for ( let x = 0; x < png.width; x++ )
    {
      if ( png.data[( y * png.width + x ) * 4 + 3] < 1 ) continue;
      minX = Math.min( minX, x );
      minY = Math.min( minY, y );
      maxX = Math.max( maxX, x );
      maxY = Math.max( maxY, y );
    }
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function spriteFrameUserData( uuid, raw, trim, border, trimType )
{
  const { x, y, w, h } = trim;
  const hw = w / 2, hh = h / 2;
  const uv = [x, y + h, x + w, y + h, x, y, x + w, y];
  return {
    trimThreshold: 1, rotated: false,
    offsetX: x + hw - raw.w / 2, offsetY: raw.h / 2 - ( y + hh ),
    trimX: x, trimY: y, width: w, height: h, rawWidth: raw.w, rawHeight: raw.h,
    borderTop: border[2], borderBottom: border[3], borderLeft: border[0], borderRight: border[1],
    packable: true, pixelsToUnit: 100, pivotX: 0.5, pivotY: 0.5, meshType: 0,
    vertices: {
      rawPosition: [-hw, -hh, 0, hw, -hh, 0, -hw, hh, 0, hw, hh, 0],
      indexes: [0, 1, 2, 2, 1, 3],
      uv,
      nuv: uv.map( ( v, i ) => i % 2 === 0 ? v / raw.w : 1 - v / raw.h ),
      minPos: [-hw, -hh, 0], maxPos: [hw, hh, 0],
    },
    isUuid: true, imageUuidOrDatabaseUri: `${uuid}@6c48a`, atlasUuid: '', trimType,
  };
}

/** Пише .meta зображення як sprite-frame; uuid наявного .meta зберігається. Повертає uuid кадру. */
function writeSpriteMeta( file, { raw, trim, border = [0, 0, 0, 0], trimType = 'none', hasAlpha = true } )
{
  const metaFile = `${file}.meta`;
  const old = existsSync( metaFile ) ? JSON.parse( readFileSync( metaFile, 'utf8' ) ) : null;
  const uuid = old?.uuid ?? randomUUID();
  const name = file.replace( /^.*[\\/]/, '' ).replace( /\.[^.]+$/, '' );
  const ext = file.slice( file.lastIndexOf( '.' ) );
  const meta = {
    ver: '1.0.27', importer: 'image', imported: true, uuid, files: ['.json', ext],
    subMetas: {
      '6c48a': {
        importer: 'texture', uuid: `${uuid}@6c48a`, displayName: name, id: '6c48a', name: 'texture',
        userData: {
          wrapModeS: 'clamp-to-edge', wrapModeT: 'clamp-to-edge', minfilter: 'linear', magfilter: 'linear',
          mipfilter: 'none', anisotropy: 0, isUuid: true, imageUuidOrDatabaseUri: uuid, visible: false,
        },
        ver: '1.0.22', imported: true, files: ['.json'], subMetas: {},
      },
      f9941: {
        importer: 'sprite-frame', uuid: `${uuid}@f9941`, displayName: name, id: 'f9941', name: 'spriteFrame',
        userData: spriteFrameUserData( uuid, raw, trim ?? { x: 0, y: 0, w: raw.w, h: raw.h }, border, trimType ),
        ver: '1.0.12', imported: true, files: ['.json'], subMetas: {},
      },
    },
    userData: { type: 'sprite-frame', fixAlphaTransparencyArtifacts: false, hasAlpha, redirect: `${uuid}@6c48a` },
  };
  writeFileSync( metaFile, JSON.stringify( meta, null, 2 ) );
  return { frame: `${uuid}@f9941`, w: trim?.w ?? raw.w, h: trim?.h ?? raw.h };
}

function importTextures()
{
  const frames = {};
  const png = ( name ) => PNG.sync.read( readFileSync( join( UI_TEX, `${name}.png` ) ) );
  for ( const [name, border] of Object.entries( SLICED ) )
  {
    const image = png( name );
    frames[name] = writeSpriteMeta( join( UI_TEX, `${name}.png` ), { raw: { w: image.width, h: image.height }, border } );
  }
  for ( const name of WHOLE )
  {
    const image = png( name );
    frames[name] = writeSpriteMeta( join( UI_TEX, `${name}.png` ), { raw: { w: image.width, h: image.height } } );
  }
  for ( const name of TRIMMED )
  {
    const image = png( name );
    const raw = { w: image.width, h: image.height };
    frames[name] = writeSpriteMeta( join( UI_TEX, `${name}.png` ), { raw, trim: alphaBox( image ), trimType: 'auto' } );
  }
  // фон меню: досі була лише текстура, без кадру для Sprite
  frames.loading_screen = writeSpriteMeta( join( UI_TEX, 'loading_screen.jpg' ), { raw: { w: 1920, h: 864 }, hasAlpha: false } );
  return frames;
}

// ---------- сцени ----------

class Scene
{
  constructor( file )
  {
    this.file = join( ASSETS, file );
    this.j = JSON.parse( readFileSync( this.file, 'utf8' ) );
  }

  node( name )
  {
    const i = this.j.findIndex( ( o ) => o.__type__ === 'cc.Node' && o._name === name );
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

  push( obj )
  {
    this.j.push( obj );
    return this.j.length - 1;
  }

  /** before — індекс вузла-сусіда, перед яким вставити (інакше в кінець). */
  attach( parentIndex, childIndex, before )
  {
    const old = this.j[childIndex]._parent?.__id__;
    if ( old !== undefined && old !== null && this.j[old] )
    {
      this.j[old]._children = this.j[old]._children.filter( ( r ) => r.__id__ !== childIndex );
    }
    const kids = this.j[parentIndex]._children;
    const at = before === undefined ? kids.length : kids.findIndex( ( r ) => r.__id__ === before );
    kids.splice( at < 0 ? kids.length : at, 0, ref( childIndex ) );
    this.j[childIndex]._parent = ref( parentIndex );
  }

  newNode( parentIndex, name, { w, h, x = 0, y = 0, anchorX = 0.5, anchorY = 0.5 }, before )
  {
    const node = this.push( {
      __type__: 'cc.Node', _name: name, _objFlags: 0, __editorExtras__: {}, _parent: null, _children: [],
      _active: true, _components: [], _prefab: null,
      _lpos: { __type__: 'cc.Vec3', x, y, z: 0 },
      _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 }, _lscale: { __type__: 'cc.Vec3', x: 1, y: 1, z: 1 },
      _mobility: 0, _layer: this.j[parentIndex]._layer, _euler: { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 }, _id: newId(),
    } );
    this.addComp( node, {
      __type__: 'cc.UITransform', _name: '', _objFlags: 0, __editorExtras__: {}, _enabled: true, __prefab: null,
      _contentSize: { __type__: 'cc.Size', width: w, height: h }, _anchorPoint: { __type__: 'cc.Vec2', x: anchorX, y: anchorY },
    } );
    this.attach( parentIndex, node, before );
    return node;
  }

  addComp( nodeIndex, data )
  {
    const c = this.push( { ...data, node: ref( nodeIndex ), _id: newId() } );
    this.j[nodeIndex]._components.push( ref( c ) );
    return c;
  }

  /** Копія наявного компонента-зразка на інший вузол. */
  cloneComp( nodeIndex, templateIndex, changes = {} )
  {
    const data = structuredClone( this.j[templateIndex] );
    delete data._id;
    return this.addComp( nodeIndex, { ...data, ...changes } );
  }

  size( nodeIndex, w, h )
  {
    const t = this.j[this.comp( nodeIndex, 'cc.UITransform' )];
    t._contentSize.width = w;
    t._contentSize.height = h;
  }

  anchor( nodeIndex, x, y )
  {
    const t = this.j[this.comp( nodeIndex, 'cc.UITransform' )];
    t._anchorPoint.x = x;
    t._anchorPoint.y = y;
  }

  pos( nodeIndex, x, y )
  {
    Object.assign( this.j[nodeIndex]._lpos, { x, y } );
  }

  sprite( nodeIndex, frame, type, tint = 'FFFFFF', alpha = 255 )
  {
    const s = this.j[this.comp( nodeIndex, 'cc.Sprite' )];
    s._spriteFrame = { __uuid__: frame, __expectedType__: 'cc.SpriteFrame' };
    s._type = type;
    s._sizeMode = 0;
    s._color = color( tint, alpha );
  }

  label( nodeIndex, { text, size, lineHeight = size + 8, hex, bold = false, outline = null, outlineWidth = 3, overflow = OVERFLOW.NONE } )
  {
    const l = this.j[this.comp( nodeIndex, 'cc.Label' )];
    if ( text !== undefined ) l._string = text;
    l._fontSize = l._actualFontSize = size;
    l._lineHeight = lineHeight;
    l._color = color( hex );
    l._isBold = bold;
    l._overflow = overflow;
    l._enableWrapText = false;
    l._horizontalAlign = 1;
    l._verticalAlign = 1;
    l._enableOutline = !!outline;
    if ( outline )
    {
      l._outlineColor = color( outline );
      l._outlineWidth = outlineWidth;
    }
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
    w._enabled = true;

    const t = this.j[this.comp( nodeIndex, 'cc.UITransform' )];
    const { width, height } = t._contentSize;
    const { x: ax, y: ay } = t._anchorPoint;
    const p = this.j[nodeIndex]._lpos;
    if ( hc !== undefined ) p.x = hc + ( ax - 0.5 ) * width;
    if ( left !== undefined ) p.x = -CANVAS.w / 2 + left + ax * width;
    if ( right !== undefined ) p.x = CANVAS.w / 2 - right - ( 1 - ax ) * width;
    if ( vc !== undefined ) p.y = vc + ( ay - 0.5 ) * height;
    if ( top !== undefined ) p.y = CANVAS.h / 2 - top - ( 1 - ay ) * height;
    if ( bottom !== undefined ) p.y = -CANVAS.h / 2 + bottom + ay * height;
  }

  save()
  {
    writeFileSync( this.file, JSON.stringify( this.j, null, 2 ) );
  }
}

const fit = ( frame, box ) =>
{
  const k = box / Math.max( frame.w, frame.h );
  return { w: Math.round( frame.w * k ), h: Math.round( frame.h * k ) };
};

function layoutComp( paddingX = 0, spacingX = 12 )
{
  return {
    __type__: 'cc.Layout', _name: '', _objFlags: 0, __editorExtras__: {}, _enabled: true, __prefab: null,
    _resizeMode: 1, _layoutType: 1, _cellSize: { __type__: 'cc.Size', width: 40, height: 40 }, _startAxis: 0,
    _paddingLeft: paddingX, _paddingRight: paddingX, _paddingTop: 0, _paddingBottom: 0,
    _spacingX: spacingX, _spacingY: 0, _verticalDirection: 1, _horizontalDirection: 0,
    _constraint: 0, _constraintNum: 2, _affectedByScale: false, _isAlign: false,
  };
}

/**
 * Прямокутна кнопка: 9-slice основа і рядок «значок + напис» по центру.
 * Видима середина кнопки на 4 px вища за центр вузла (губа знизу), тому й рядок піднято на 4 px.
 */
function skinButton( s, frames, name, { kind, x, y, w, h, text, size, outline, icon, iconBox } )
{
  const button = s.node( name );
  s.size( button, w, h );
  s.sprite( button, frames[kind].frame, SPRITE.SLICED );
  s.align( button, { hc: x + w / 2 - CANVAS.w / 2, vc: CANVAS.h / 2 - ( y + h / 2 ) } );

  const label = s.child( button, 'Label' );
  s.label( label, { text, size, hex: COLOR.white, bold: true, outline } );
  s.size( label, 10, size + 8 );
  if ( !icon )
  {
    s.pos( label, 0, 4 );
    return;
  }
  const row = s.newNode( button, 'Content', { w: 10, h: h, y: 4 } );
  s.addComp( row, layoutComp() );
  const box = fit( frames[icon], iconBox );
  const iconNode = s.newNode( row, 'Icon', box );
  s.cloneComp( iconNode, s.comp( button, 'cc.Sprite' ) );
  s.sprite( iconNode, frames[icon].frame, SPRITE.SIMPLE );
  s.attach( row, label );
  s.pos( label, 0, 0 );
}

/** Кругла кнопка з картинкою по центру і підписом під нею. */
function skinRoundButton( s, frames, name, { kind, size, align, icon, iconBox, iconY, labelY, labelSize, text } )
{
  const button = s.node( name );
  s.size( button, size, size );
  s.sprite( button, frames[kind].frame, SPRITE.SIMPLE );
  s.align( button, align );

  const label = s.child( button, 'Label' );
  const box = fit( frames[icon], iconBox );
  const iconNode = s.newNode( button, 'Icon', { ...box, y: iconY }, label );
  s.cloneComp( iconNode, s.comp( button, 'cc.Sprite' ) );
  s.sprite( iconNode, frames[icon].frame, SPRITE.SIMPLE );

  s.label( label, { text, size: labelSize, hex: COLOR.white, bold: true, outline: COLOR.barkDark } );
  s.size( label, 10, labelSize + 8 );
  s.pos( label, 0, labelY );
}

function buildMenu( frames )
{
  const s = new Scene( 'Menu.scene' );
  if ( s.hasNode( 'Panel' ) ) return console.log( 'Menu: вже зроблено, пропускаю' );
  const canvas = s.node( 'Canvas' );
  const title = s.node( 'Title' );
  const total = s.node( 'TotalLabel' );
  const spriteTemplate = s.comp( s.node( 'PlayButton' ), 'cc.Sprite' );

  // фон: та сама картинка, що й на заставці; запас 1680×756 накриває екрани до 21:9
  const background = s.newNode( canvas, 'Background', { w: 1680, h: 756 }, title );
  s.cloneComp( background, spriteTemplate );
  s.sprite( background, frames.loading_screen.frame, SPRITE.SIMPLE );

  // логотип замість текстового заголовка: Label підміняємо на Sprite на тому ж місці масиву
  const titleLabel = s.comp( title, 'cc.Label' );
  s.j[titleLabel] = { ...structuredClone( s.j[spriteTemplate] ), node: ref( title ), _id: s.j[titleLabel]._id };
  s.sprite( title, frames.logo.frame, SPRITE.SIMPLE );
  s.j[title]._name = 'Logo';
  // висота 196: між логотипом (верх 4) і панеллю (верх 232) має влізти рядок поради
  const logoHeight = 196;
  s.size( title, Math.round( frames.logo.w * logoHeight / frames.logo.h ), logoHeight );
  s.align( title, { top: 4, hc: 0 } );

  // порада — між логотипом і панеллю, поверх лісу, тому з обведенням
  const tip = s.node( 'TipLabel' );
  s.attach( canvas, tip, total );
  s.size( tip, 900, 30 );
  s.label( tip, { size: 24, lineHeight: 30, hex: COLOR.white, outline: COLOR.barkDark, overflow: OVERFLOW.SHRINK } );
  s.align( tip, { top: 202, hc: 0 } );

  const panel = s.newNode( canvas, 'Panel', { w: 560, h: 470 }, total );
  s.cloneComp( panel, spriteTemplate );
  s.sprite( panel, frames.panel.frame, SPRITE.SLICED );
  s.cloneComp( panel, s.comp( total, 'cc.Widget' ) );
  s.align( panel, { hc: 0, vc: CANVAS.h / 2 - ( 232 + 235 ) } );

  s.size( total, 520, 34 );
  s.label( total, { size: 26, lineHeight: 34, hex: COLOR.barkDark, overflow: OVERFLOW.SHRINK } );
  s.align( total, { top: 255, hc: 0 } );

  skinButton( s, frames, 'PlayButton', {
    kind: 'btn_primary', x: 400, y: 294, w: 480, h: 88, text: 'Грати самому', size: 34,
    outline: COLOR.porciniCap, icon: 'glyph_play', iconBox: 48,
  } );
  skinButton( s, frames, 'CreateButton', {
    kind: 'btn_secondary', x: 400, y: 392, w: 480, h: 88, text: 'Створити кімнату', size: 34,
    outline: COLOR.pine, icon: 'icon_coop', iconBox: 72,
  } );
  skinButton( s, frames, 'JoinButton', {
    kind: 'btn_secondary', x: 640, y: 492, w: 240, h: 84, text: 'Приєднатися', size: 30, outline: COLOR.pine,
  } );
  skinButton( s, frames, 'ResetButton', {
    kind: 'btn_danger', x: 470, y: 600, w: 340, h: 76, text: 'Скинути прогрес', size: 28,
    outline: COLOR.porciniCapDark, icon: 'glyph_reset', iconBox: 40,
  } );

  const input = s.node( 'CodeInput' );
  s.size( input, 228, 80 );
  s.sprite( input, frames.input_field.frame, SPRITE.SLICED );
  s.j[s.comp( input, 'cc.EditBox' )]._backgroundImage = { __uuid__: frames.input_field.frame, __expectedType__: 'cc.SpriteFrame' };
  s.align( input, { hc: 400 + 114 - CANVAS.w / 2, vc: CANVAS.h / 2 - ( 494 + 40 ) } );
  for ( const [name, size, hex] of [['TEXT_LABEL', 32, COLOR.barkDark], ['PLACEHOLDER_LABEL', 26, COLOR.bark]] )
  {
    const l = s.child( input, name );
    s.size( l, 228, 80 );
    s.pos( l, -114, 40 );
    s.label( l, { size, lineHeight: 80, hex, overflow: 1 } );
  }

  // смужка завантаження з'являється на місці «Скинути прогрес» (MainMenu.showLoading)
  const bar = s.node( 'LoadingBar' );
  s.size( bar, 400, 44 );
  s.sprite( bar, frames.progress_frame.frame, SPRITE.SLICED );
  s.j[s.comp( bar, 'cc.ProgressBar' )]._totalLength = 384;
  s.align( bar, { hc: 0, vc: CANVAS.h / 2 - 638 } );
  const fill = s.child( bar, 'Bar' );
  s.size( fill, 192, 28 );
  s.pos( fill, -192, 0 );
  s.sprite( fill, frames.progress_fill.frame, SPRITE.SLICED );

  s.save();
  console.log( 'Menu: готово' );
}

function buildMain( frames )
{
  const s = new Scene( 'Main.scene' );
  if ( s.hasNode( 'MessageBox' ) ) return console.log( 'Main: вже зроблено, пропускаю' );
  const canvas = s.node( 'Canvas' );
  const basketLabel = s.node( 'BasketLabel' );
  const spriteTemplate = s.comp( s.node( 'PickButton' ), 'cc.Sprite' );
  const widgetTemplate = s.comp( basketLabel, 'cc.Widget' );

  // кошик: значок 76 px і лічильник праворуч від нього
  const basketBox = fit( frames.icon_basket, 76 );
  const basketIcon = s.newNode( canvas, 'BasketIcon', basketBox, basketLabel );
  s.cloneComp( basketIcon, spriteTemplate );
  s.sprite( basketIcon, frames.icon_basket.frame, SPRITE.SIMPLE );
  s.cloneComp( basketIcon, widgetTemplate );
  s.align( basketIcon, { left: 24 + ( 76 - basketBox.w ) / 2, top: 14 + ( 76 - basketBox.h ) / 2 } );

  s.label( basketLabel, { size: 40, lineHeight: 48, hex: COLOR.white, bold: true, outline: COLOR.barkDark, outlineWidth: 4 } );
  s.size( basketLabel, 10, 48 );
  s.align( basketLabel, { left: 110, top: 28 } );

  // код кімнати під кошиком: верх по центру тепер займає плашка повідомлень
  const room = s.node( 'RoomLabel' );
  s.anchor( room, 0, 1 );
  s.size( room, 10, 36 );
  s.label( room, { size: 28, lineHeight: 36, hex: COLOR.white, bold: true, outline: COLOR.barkDark } );
  s.align( room, { left: 24, top: 100 } );

  // плашка повідомлень: ширина підлаштовується під текст (Layout), напівпрозорість — альфою кольору спрайта
  const message = s.node( 'MessageLabel' );
  const box = s.newNode( canvas, 'MessageBox', { w: 440, h: 72 }, message );
  s.cloneComp( box, spriteTemplate );
  s.sprite( box, frames.toast_plate.frame, SPRITE.SLICED, 'FFFFFF', Math.round( 255 * 0.88 ) );
  s.addComp( box, layoutComp( 36, 0 ) );
  s.cloneComp( box, widgetTemplate );
  s.align( box, { top: 20, hc: 0 } );
  s.attach( box, message );
  s.j[s.comp( message, 'cc.Widget' )]._enabled = false;
  s.size( message, 10, 36 );
  s.pos( message, 0, 0 );
  s.label( message, { text: '', size: 28, lineHeight: 36, hex: COLOR.white, bold: true } );
  const hud = s.j[canvas]._components.map( ( r ) => r.__id__ ).find( ( i ) => 'messageLabel' in s.j[i] );
  s.j[hud].messageBox = ref( box );

  skinRoundButton( s, frames, 'MenuButton', {
    kind: 'btn_round_secondary', size: 112, align: { right: 24, top: 14 },
    icon: 'glyph_home', iconBox: 56, iconY: 3, labelY: -78, labelSize: 26, text: 'Меню',
  } );
  skinRoundButton( s, frames, 'PickButton', {
    kind: 'btn_round', size: 160, align: { right: 48, bottom: 90 },
    // 28, а не 32: «Зібрати мухомор» інакше вилазить за правий край екрана
    icon: 'icon_basket', iconBox: 96, iconY: 4, labelY: -102, labelSize: 28, text: 'Зібрати',
  } );

  // нова ручка вже має свої кольори — прибираємо старий кремовий відтінок
  s.j[s.comp( s.node( 'Knob' ), 'cc.Sprite' )]._color = color( 'FFFFFF' );

  s.save();
  console.log( 'Main: готово' );
}

// заставка: та сама картинка, але з логотипом (Logo: None, фон — project://settings/loading_screen.jpg)
copyFileSync( join( GENERATED, '..', 'loading_screen_logo.jpg' ), join( ROOT, 'settings', 'loading_screen.jpg' ) );

const frames = importTextures();
buildMenu( frames );
buildMain( frames );
