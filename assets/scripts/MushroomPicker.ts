import { _decorator, Component, Node, input, Input, EventKeyboard, KeyCode } from 'cc';
import { MushroomSpawner } from './MushroomSpawner';
import { gameEvents, GameEvent } from './GameEvents';
import { basket } from './Basket';
const { ccclass, property } = _decorator;

@ccclass( 'MushroomPicker' )
export class MushroomPicker extends Component
{
  @property( { type: MushroomSpawner, tooltip: 'Звідки брати гриби (вузол Mushrooms)' } )
  spawner: MushroomSpawner | null = null;

  @property( { tooltip: 'З якої відстані можна зібрати гриб, м' } )
  pickRadius = 1.2;

  private _target: Node | null = null;

  onEnable()
  {
    input.on( Input.EventType.KEY_DOWN, this.onKeyDown, this );
    gameEvents.on( GameEvent.PickRequested, this.pick, this );
  }

  onDisable()
  {
    input.off( Input.EventType.KEY_DOWN, this.onKeyDown, this );
    gameEvents.off( GameEvent.PickRequested, this.pick, this );
  }

  private onKeyDown( event: EventKeyboard )
  {
    if ( event.keyCode === KeyCode.KEY_E ) this.pick();
  }

  update()
  {
    if ( !this.spawner ) return;
    const nearest = this.spawner.findNearest( this.node.worldPosition, this.pickRadius );
    if ( nearest !== this._target ) this.setTarget( nearest );
  }

  pick()
  {
    if ( !this._target || !this.spawner ) return;
    const mushroom = this._target;
    const species = this.spawner.speciesOf( mushroom );
    this.setTarget( null );
    this.spawner.harvest( mushroom );
    const added = basket.add( species );
    gameEvents.emit( GameEvent.MushroomPicked, species, added );
  }

  private setTarget( target: Node | null )
  {
    this._target = target;
    const species = target && this.spawner ? this.spawner.speciesOf( target ) : '';
    gameEvents.emit( GameEvent.PickTargetChanged, target, species );
  }
}
