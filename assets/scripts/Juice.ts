import { Node, Vec3, Tween, tween } from 'cc';

/** Короткий «стук» масштабом: вузол на мить збільшується й пружно повертається до 1. */
export function punch( node: Node, amount = 0.2, duration = 0.25 )
{
  // новий стук перебиває попередній, інакше масштаб «поповзе»
  Tween.stopAllByTarget( node );
  node.setScale( 1, 1, 1 );
  tween( node )
    .to( duration * 0.3, { scale: new Vec3( 1 + amount, 1 + amount, 1 ) }, { easing: 'quadOut' } )
    .to( duration * 0.7, { scale: new Vec3( 1, 1, 1 ) }, { easing: 'backOut' } )
    .start();
}
