import { _decorator, Component, Node, Label, Button, ProgressBar, JsonAsset, director, resources } from 'cc';
import { gameEvents, GameEvent } from './GameEvents';
import { basket } from './Basket';
import { formatCounts } from './Species';
const { ccclass, property } = _decorator;

@ccclass( 'MainMenu' )
export class MainMenu extends Component
{
  @property( { tooltip: 'Назва сцени з галявиною' } )
  gameScene = 'Main';

  @property( { type: Label, tooltip: 'Скільки грибів зібрано за весь час' } )
  totalLabel: Label | null = null;

  @property( { type: Label, tooltip: 'Випадкова порада з resources/tips.json' } )
  tipLabel: Label | null = null;

  @property( { type: Node, tooltip: 'Кнопка «Грати»' } )
  playButton: Node | null = null;

  @property( { type: Node, tooltip: 'Кнопка «Скинути прогрес»' } )
  resetButton: Node | null = null;

  @property( { type: ProgressBar, tooltip: 'Смужка завантаження сцени гри' } )
  loadingBar: ProgressBar | null = null;

  private _loading = false;

  onLoad()
  {
    if ( this.loadingBar ) this.loadingBar.node.active = false;
    this.refreshTotal();
    this.loadTip();
  }

  onEnable()
  {
    this.playButton?.on( Button.EventType.CLICK, this.onPlayClick, this );
    this.resetButton?.on( Button.EventType.CLICK, this.onResetClick, this );
    gameEvents.on( GameEvent.BasketChanged, this.refreshTotal, this );
  }

  onDisable()
  {
    this.playButton?.off( Button.EventType.CLICK, this.onPlayClick, this );
    this.resetButton?.off( Button.EventType.CLICK, this.onResetClick, this );
    gameEvents.off( GameEvent.BasketChanged, this.refreshTotal, this );
  }

  private onPlayClick()
  {
    if ( this._loading ) return;
    this._loading = true;
    this.setButtonsEnabled( false );
    if ( this.loadingBar )
    {
      this.loadingBar.progress = 0;
      this.loadingBar.node.active = true;
    }

    director.preloadScene(
      this.gameScene,
      ( completed, total ) =>
      {
        if ( this.loadingBar && total > 0 ) this.loadingBar.progress = completed / total;
      },
      ( error ) =>
      {
        if ( error )
        {
          console.error( `[MainMenu] не вдалося завантажити сцену «${this.gameScene}»`, error );
          this._loading = false;
          this.setButtonsEnabled( true );
          if ( this.loadingBar ) this.loadingBar.node.active = false;
          return;
        }
        director.loadScene( this.gameScene );
      },
    );
  }

  private onResetClick()
  {
    basket.reset();
  }

  private refreshTotal()
  {
    if ( !this.totalLabel ) return;
    const text = formatCounts( basket.counts );
    this.totalLabel.string = text ? `Зібрано за весь час: ${text}` : 'Ще нічого не зібрано';
  }

  private loadTip()
  {
    resources.load( 'tips', JsonAsset, ( error, asset ) =>
    {
      // колбек асинхронний: меню могли вже закрити
      if ( error || !this.isValid || !this.tipLabel ) return;
      const tips: string[] = asset.json?.tips ?? [];
      if ( tips.length > 0 ) this.tipLabel.string = tips[Math.floor( Math.random() * tips.length )];
    } );
  }

  private setButtonsEnabled( enabled: boolean )
  {
    const play = this.playButton?.getComponent( Button );
    const reset = this.resetButton?.getComponent( Button );
    if ( play ) play.interactable = enabled;
    if ( reset ) reset.interactable = enabled;
  }
}
