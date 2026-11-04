/** Як гравець зайшов на галявину: живе в модулі, тож переживає перехід з меню в гру. */
export type GameMode = 'solo' | 'create' | 'join';

export const session = {
  mode: 'solo' as GameMode,
  code: '',
};
