import 'package:flutter/widgets.dart';

/// Close the keyboard. On phones Flutter keeps a text field focused when the writer taps
/// elsewhere (unlike Safari or native apps), so forms and search fields pass this as
/// `onTapOutside`. Not for the editor's lines: tapping its toolbar must keep the keyboard.
void dismissKeyboard([PointerDownEvent? _]) => FocusManager.instance.primaryFocus?.unfocus();

/// Full screens never take focus with them. Without this, coming back from the editor gave
/// focus back to the desk's search field (Flutter restores a screen's last focused field), so
/// the keyboard opened on the desk for no visible reason. Sheets and dialogs (popup routes) are
/// left alone, so closing a sheet in the editor doesn't touch the writing.
class KeyboardRouteObserver extends NavigatorObserver {
  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    // before the new screen builds, so a field there that asks for autofocus still gets it
    if (route is PageRoute) dismissKeyboard();
  }

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    if (route is! PageRoute) return;
    dismissKeyboard();
    // the screen underneath restores its last focused field during the next frame: undo that
    WidgetsBinding.instance.addPostFrameCallback((_) => dismissKeyboard());
  }
}
