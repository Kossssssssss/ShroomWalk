import { EventTarget } from 'cc';

export const gameEvents = new EventTarget();

export const GameEvent = {
  /** (target: Node | null, species: string) */
  PickTargetChanged: 'pick-target-changed',
  PickRequested: 'pick-requested',
  /** (species: string, added: boolean); added = false — гриб неїстівний */
  MushroomPicked: 'mushroom-picked',
  BasketChanged: 'basket-changed',
  /** (x, y) від -1 до 1; (0, 0) — відпустили */
  JoystickMoved: 'joystick-moved',
} as const;
