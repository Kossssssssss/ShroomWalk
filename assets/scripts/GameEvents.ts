import { EventTarget } from 'cc';

export const gameEvents = new EventTarget();

export const GameEvent = {
  /** (target: Node | null, species: string) */
  PickTargetChanged: 'pick-target-changed',
  PickRequested: 'pick-requested',
  /** (species: string, added: boolean); added = false — гриб неїстівний */
  MushroomPicked: 'mushroom-picked',
  BasketChanged: 'basket-changed',
  /** (id: string) — попросити сервер зібрати гриб */
  HarvestRequested: 'harvest-requested',
  /** (species: string) — сервер підтвердив, що гриб дістався нам */
  HarvestConfirmed: 'harvest-confirmed',
  /** (id: string, node: Node, name: string, color: number) */
  RemotePlayerJoined: 'remote-player-joined',
  /** (id: string) */
  RemotePlayerLeft: 'remote-player-left',
  /** (text: string) — коротке повідомлення на екрані */
  Toast: 'toast',
  /** (code: string) — ми в кімнаті з цим кодом */
  RoomJoined: 'room-joined',
  RoomLeft: 'room-left',
  /** (x, y) від -1 до 1; (0, 0) — відпустили */
  JoystickMoved: 'joystick-moved',
  /** (position: Readonly<Vec3>, species: string) — гриб зник з галявини, бо його зібрали (будь-хто); позицію копіюйте одразу */
  MushroomHarvested: 'mushroom-harvested',
  /** свій гравець ступив на землю */
  Footstep: 'footstep',
  /** (quest: QuestData | null, progress: number, timeLeft: number); null — завдання зараз немає */
  QuestChanged: 'quest-changed',
} as const;
