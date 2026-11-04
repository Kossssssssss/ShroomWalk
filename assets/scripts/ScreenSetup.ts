import { view, macro, sys } from 'cc';
import { PREVIEW } from 'cc/env';

const PREVIEW_FIX_ID = 'landscape-preview-fix';

/** Гра лише горизонтальна: якщо браузер вертикальний, Cocos сам повертає кадр на 90° (і дотики теж). */
export function setupScreen()
{
  // у збірці під телефон орієнтацію задають налаштування збірки, а рушій лише попереджає «not supported»
  if ( sys.isBrowser ) view.setOrientation( macro.ORIENTATION_LANDSCAPE );

  // сторінка превʼю центрує кадр через flex, і повернутий кадр з'їжджає за край; у збірці такої обгортки немає
  if ( PREVIEW && sys.isMobile && !document.getElementById( PREVIEW_FIX_ID ) )
  {
    const style = document.createElement( 'style' );
    style.id = PREVIEW_FIX_ID;
    style.textContent = '#GameDiv { position: fixed !important; left: 0 !important; top: 0 !important; }';
    document.head.appendChild( style );
  }
}
