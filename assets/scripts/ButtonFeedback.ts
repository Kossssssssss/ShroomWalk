import { _decorator, Component, Button, AudioClip, AudioSource } from 'cc';
const { ccclass, property } = _decorator;

/** На Canvas: усі кнопки під ним «втискаються» під пальцем і клацають. */
@ccclass( 'ButtonFeedback' )
export class ButtonFeedback extends Component
{
  @property( { type: AudioClip } )
  clickClip: AudioClip | null = null;

  @property( { range: [0, 1, 0.05], slide: true } )
  volume = 0.6;

  @property( { tooltip: 'Масштаб натиснутої кнопки: менше 1 — втискається' } )
  zoomScale = 0.9;

  @property( { tooltip: 'Тривалість втискання, с' } )
  pressDuration = 0.1;

  private _source: AudioSource | null = null;
  private _buttons: Button[] = [];

  onLoad()
  {
    this._source = this.getComponent( AudioSource ) ?? this.addComponent( AudioSource );
    this._source.playOnAwake = false;
    // знаходить і приховані зараз кнопки (наприклад, «Зібрати»)
    this._buttons = this.node.getComponentsInChildren( Button );
    for ( const button of this._buttons )
    {
      button.transition = Button.Transition.SCALE;
      button.zoomScale = this.zoomScale;
      button.duration = this.pressDuration;
    }
  }

  onEnable()
  {
    for ( const button of this._buttons ) button.node.on( Button.EventType.CLICK, this.onClick, this );
  }

  onDisable()
  {
    for ( const button of this._buttons )
    {
      if ( button.isValid ) button.node.off( Button.EventType.CLICK, this.onClick, this );
    }
  }

  private onClick()
  {
    if ( this.clickClip && this._source ) this._source.playOneShot( this.clickClip, this.volume );
  }
}
