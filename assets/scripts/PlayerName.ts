import { Color } from 'cc';

// кольори гравців за номером, який видає сервер
export const PLAYER_COLORS = [
  new Color( 255, 196, 92 ),
  new Color( 120, 200, 255 ),
  new Color( 170, 230, 120 ),
  new Color( 255, 150, 210 ),
];

let name = '';

/** Імʼя на цей запуск гри. Поки випадкове — свій вибір імені буде в меню. */
export function playerName(): string
{
  if ( !name ) name = `Грибник ${10 + Math.floor( Math.random() * 90 )}`;
  return name;
}

export function playerColor( index: number ): Color
{
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}
