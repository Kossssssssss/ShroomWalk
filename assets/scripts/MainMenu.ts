import { _decorator, Component, Node, Label, Button, EditBox, ProgressBar, JsonAsset, director, resources, screen, sys } from 'cc';
import { gameEvents, GameEvent } from './GameEvents';
import { basket } from './Basket';
import { formatCounts } from './Species';
import { session, GameMode } from './Session';
import { setupScreen } from './ScreenSetup';
import { wakeServer } from './ServerConfig';

const CODE_LENGTH = 4;
// вужча заливка ламає заокруглені кінці 9-slice (відступи 14 + 14 px)
const MIN_FILL_WIDTH = 28;
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

  @property( { type: Node, tooltip: 'Кнопка «Грати самому»' } )
  playButton: Node | null = null;

  @property( { type: Node, tooltip: 'Кнопка «Створити кімнату»' } )
  createButton: Node | null = null;

  @property( { type: Node, tooltip: 'Кнопка «Приєднатися»' } )
  joinButton: Node | null = null;

  @property( { type: EditBox, tooltip: 'Поле для коду кімнати друга' } )
  codeInput: EditBox | null = null;

  @property( { type: Node, tooltip: 'Кнопка «Скинути прогрес»' } )
  resetButton: Node | null = null;

  @property( { type: ProgressBar, tooltip: 'Смужка завантаження сцени гри' } )
  loadingBar: ProgressBar | null = null;

  private _loading = false;

  onLoad()
  {
    setupScreen();
    // поки гравець у меню, сервер на хостингу встигає прокинутись
    wakeServer();
    if ( this.loadingBar ) this.loadingBar.node.active = false;
    this.refreshTotal();
    this.loadTip();
  }

  onEnable()
  {
    this.playButton?.on( Button.EventType.CLICK, this.onPlayClick, this );
    this.createButton?.on( Button.EventType.CLICK, this.onCreateClick, this );
    this.joinButton?.on( Button.EventType.CLICK, this.onJoinClick, this );
    this.resetButton?.on( Button.EventType.CLICK, this.onResetClick, this );
    gameEvents.on( GameEvent.BasketChanged, this.refreshTotal, this );
  }

  onDisable()
  {
    this.playButton?.off( Button.EventType.CLICK, this.onPlayClick, this );
    this.createButton?.off( Button.EventType.CLICK, this.onCreateClick, this );
    this.joinButton?.off( Button.EventType.CLICK, this.onJoinClick, this );
    this.resetButton?.off( Button.EventType.CLICK, this.onResetClick, this );
    gameEvents.off( GameEvent.BasketChanged, this.refreshTotal, this );
  }

  private onPlayClick()
  {
    this.startGame( 'solo' );
  }

  private onCreateClick()
  {
    this.startGame( 'create' );
  }

  private onJoinClick()
  {
    const code = ( this.codeInput?.string ?? '' ).trim().toUpperCase();
    if ( code.length !== CODE_LENGTH )
    {
      if ( this.tipLabel ) this.tipLabel.string = `Введіть код кімнати з ${CODE_LENGTH} символів`;
      return;
    }
    this.startGame( 'join', code );
  }

  private startGame( mode: GameMode, code = '' )
  {
    if ( this._loading ) return;
    if ( sys.isMobile && screen.supportsFullScreen && !screen.fullScreen() )
    {
      // браузер дозволяє повний екран лише у відповідь на дотик — тому саме тут
      screen.requestFullScreen().catch( () => {} );
    }
    session.mode = mode;
    session.code = code;
    this._loading = true;
    this.setButtonsEnabled( false );
    this.showLoading( true );

    director.preloadScene(
      this.gameScene,
      ( completed, total ) =>
      {
        if ( total > 0 ) this.setLoadingProgress( completed / total );
      },
      ( error ) =>
      {
        if ( error )
        {
          console.error( `[MainMenu] не вдалося завантажити сцену «${this.gameScene}»`, error );
          this._loading = false;
          this.setButtonsEnabled( true );
          this.showLoading( false );
          return;
        }
        director.loadScene( this.gameScene );
      },
    );
  }

  // смужка завантаження стоїть на місці кнопки «Скинути прогрес»
  private showLoading( visible: boolean )
  {
    if ( this.resetButton ) this.resetButton.active = !visible;
    if ( !this.loadingBar ) return;
    this.loadingBar.node.active = visible;
    this.setLoadingProgress( 0 );
  }

  private setLoadingProgress( progress: number )
  {
    const bar = this.loadingBar;
    if ( !bar ) return;
    bar.progress = progress;
    if ( bar.barSprite ) bar.barSprite.node.active = progress * bar.totalLength >= MIN_FILL_WIDTH;
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
    for ( const node of [this.playButton, this.createButton, this.joinButton, this.resetButton] )
    {
      const button = node?.getComponent( Button );
      if ( button ) button.interactable = enabled;
    }
  }
}
