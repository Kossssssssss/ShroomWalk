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
  private _requested: Node | null = null;

  onEnable()
  {
    input.on( Input.EventType.KEY_DOWN, this.onKeyDown, this );
    gameEvents.on( GameEvent.PickRequested, this.pick, this );
    gameEvents.on( GameEvent.HarvestConfirmed, this.collect, this );
  }

  onDisable()
  {
    input.off( Input.EventType.KEY_DOWN, this.onKeyDown, this );
    gameEvents.off( GameEvent.PickRequested, this.pick, this );
    gameEvents.off( GameEvent.HarvestConfirmed, this.collect, this );
  }

  private onKeyDown( event: EventKeyboard )
  {
    if ( event.keyCode === KeyCode.KEY_E ) this.pick();
  }

  update()
  {
    if ( !this.spawner ) return;
    let nearest = this.spawner.findNearest( this.node.worldPosition, this.pickRadius );
    // поки сервер не відповів, цей гриб ще видно, але кнопку для нього не показуємо
    if ( nearest === this._requested ) nearest = null;
    if ( nearest !== this._target ) this.setTarget( nearest );
  }

  pick()
  {
    if ( !this._target || !this.spawner ) return;
    const mushroom = this._target;
    this.setTarget( null );

    if ( this.spawner.isRemote )
    {
      const id = this.spawner.idOf( mushroom );
      if ( !id ) return;
      this._requested = mushroom;
      this.unschedule( this.forgetRequest );
      this.scheduleOnce( this.forgetRequest, 1 );
      gameEvents.emit( GameEvent.HarvestRequested, id );
      return;
    }

    const species = this.spawner.speciesOf( mushroom );
    this.spawner.harvest( mushroom );
    this.collect( species );
  }

  private collect( species: string )
  {
    const added = basket.add( species );
    gameEvents.emit( GameEvent.MushroomPicked, species, added );
  }

  private forgetRequest()
  {
    this._requested = null;
  }

  private setTarget( target: Node | null )
  {
    this._target = target;
    const species = target && this.spawner ? this.spawner.speciesOf( target ) : '';
    gameEvents.emit( GameEvent.PickTargetChanged, target, species );
  }
}
