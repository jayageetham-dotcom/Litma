import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'motion.dart';
import 'tokens.g.dart';

export 'tokens.g.dart';

/// Litma's look in Flutter, from the same tokens as the web (apps/web/src/styles/theme.css).
/// App chrome stays calm: faint lilac canvas, white surfaces, ink-black primary buttons,
/// the violet accent, and tint colours only on small tool icons.
class LitmaColors extends ThemeExtension<LitmaColors> {
  const LitmaColors(this.t);
  final LitmaTokens t;

  @override
  LitmaColors copyWith({LitmaTokens? t}) => LitmaColors(t ?? this.t);

  @override
  LitmaColors lerp(covariant LitmaColors? other, double f) =>
      other == null ? this : LitmaColors(LitmaTokens.lerp(t, other.t, f));
}

extension LitmaContext on BuildContext {
  LitmaTokens get c => Theme.of(this).extension<LitmaColors>()!.t;
  bool get isDark => Theme.of(this).brightness == Brightness.dark;
}

/// Font families bundled in assets/fonts (pubspec.yaml).
abstract final class LitmaFonts {
  static const ui = 'Inter';
  static const display = 'AnekMalayalam';
  static const serif = 'NotoSerifMalayalam';
  static const sans = 'NotoSansMalayalam';

  /// Latin UI text falls back to Anek Malayalam for Malayalam, like the web's --font-ui.
  static const uiFallback = ['AnekMalayalam', 'NotoSansMalayalam'];
  static const displayFallback = ['Inter', 'NotoSansMalayalam'];

  /// A writing type's document font name (settings.font on the web) → bundled family.
  static String document(String? cssName) => switch (cssName) {
        'Noto Sans Malayalam' => sans,
        'Manjari' => 'Manjari',
        'Gayathri' => 'Gayathri',
        'Anek Malayalam' => display,
        _ => serif,
      };
}

ThemeData litmaTheme(Brightness brightness) {
  final t = brightness == Brightness.dark ? LitmaTokens.dark : LitmaTokens.light;
  final scheme = ColorScheme(
    brightness: brightness,
    primary: t.primary,
    onPrimary: t.primaryInk,
    secondary: t.accent,
    onSecondary: t.accentInk,
    tertiary: t.highlight,
    onTertiary: t.surface,
    error: t.danger,
    onError: t.dangerInk,
    surface: t.surface,
    onSurface: t.ink,
    onSurfaceVariant: t.muted,
    surfaceContainerLowest: t.canvas,
    surfaceContainerLow: t.surface,
    surfaceContainer: t.surface,
    surfaceContainerHigh: t.subtle,
    surfaceContainerHighest: t.subtle,
    outline: t.lineStrong,
    outlineVariant: t.line,
    primaryContainer: t.accentSoft,
    onPrimaryContainer: t.optionSelectedInk,
    secondaryContainer: t.optionSelected,
    onSecondaryContainer: t.optionSelectedInk,
    shadow: const Color(0xFF111113),
    scrim: t.scrim,
  );

  TextStyle ui(double size, FontWeight w, {double? height, Color? color, double? spacing}) => TextStyle(
        fontFamily: LitmaFonts.ui,
        fontFamilyFallback: LitmaFonts.uiFallback,
        fontSize: size,
        fontWeight: w,
        height: height,
        color: color ?? t.ink,
        letterSpacing: spacing,
      );
  TextStyle display(double size, FontWeight w, {double? height}) => TextStyle(
        fontFamily: LitmaFonts.display,
        fontFamilyFallback: LitmaFonts.displayFallback,
        fontSize: size,
        fontWeight: w,
        height: height ?? 1.15,
        color: t.ink,
      );

  final text = TextTheme(
    displayLarge: display(44, FontWeight.w800),
    displayMedium: display(36, FontWeight.w800),
    displaySmall: display(30, FontWeight.w700),
    headlineLarge: display(30, FontWeight.w700),
    headlineMedium: display(26, FontWeight.w700),
    headlineSmall: display(22, FontWeight.w700),
    titleLarge: ui(19, FontWeight.w600, height: 1.3),
    titleMedium: ui(16, FontWeight.w600, height: 1.35),
    titleSmall: ui(14, FontWeight.w600, height: 1.35),
    bodyLarge: ui(16, FontWeight.w400, height: 1.5),
    bodyMedium: ui(14.5, FontWeight.w400, height: 1.45),
    bodySmall: ui(12.5, FontWeight.w400, height: 1.4, color: t.muted),
    labelLarge: ui(15, FontWeight.w600, height: 1.2),
    labelMedium: ui(13, FontWeight.w500, height: 1.2),
    labelSmall: ui(11.5, FontWeight.w500, height: 1.2, color: t.muted, spacing: 0.2),
  );

  final shape12 = RoundedRectangleBorder(borderRadius: BorderRadius.circular(LitmaRadius.md));
  final isDark = brightness == Brightness.dark;

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: t.canvas,
    canvasColor: t.canvas,
    textTheme: text,
    fontFamily: LitmaFonts.ui,
    fontFamilyFallback: LitmaFonts.uiFallback,
    extensions: [LitmaColors(t)],
    splashFactory: InkSparkle.splashFactory,
    highlightColor: t.optionHover.withValues(alpha: 0.5),
    dividerTheme: DividerThemeData(color: t.line, thickness: 1, space: 1),
    iconTheme: IconThemeData(color: t.ink, size: 22),
    // Each platform keeps its own page behaviour: iOS swipes back from the edge, Android gets
    // the predictive back gesture. Litma's own transitions (container transform, fade through)
    // are used where a screen grows out of something on the page.
    pageTransitionsTheme: const PageTransitionsTheme(builders: {
      TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
      TargetPlatform.android: PredictiveBackPageTransitionsBuilder(),
    }),
    appBarTheme: AppBarTheme(
      backgroundColor: t.canvas,
      surfaceTintColor: Colors.transparent,
      foregroundColor: t.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: ui(17, FontWeight.w600),
      systemOverlayStyle: isDark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: t.primary,
        foregroundColor: t.primaryInk,
        disabledBackgroundColor: t.disabledBg,
        disabledForegroundColor: t.disabledInk,
        minimumSize: const Size(48, 50),
        padding: const EdgeInsets.symmetric(horizontal: 20),
        textStyle: ui(15.5, FontWeight.w600),
        shape: shape12,
        animationDuration: Motion.fast,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: t.ink,
        minimumSize: const Size(48, 50),
        padding: const EdgeInsets.symmetric(horizontal: 18),
        side: BorderSide(color: t.lineStrong),
        textStyle: ui(15.5, FontWeight.w600),
        shape: shape12,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: t.accent, textStyle: ui(15, FontWeight.w600), shape: shape12),
    ),
    iconButtonTheme: IconButtonThemeData(style: IconButton.styleFrom(foregroundColor: t.ink)),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: t.primary,
      foregroundColor: t.primaryInk,
      elevation: 2,
      focusElevation: 3,
      hoverElevation: 3,
      highlightElevation: 1,
      extendedTextStyle: ui(15.5, FontWeight.w600),
      shape: const StadiumBorder(),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: t.surface,
      isDense: false,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      hintStyle: ui(16, FontWeight.w400, color: t.muted),
      labelStyle: ui(15, FontWeight.w500, color: t.muted),
      floatingLabelStyle: ui(14, FontWeight.w600, color: t.accent),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(LitmaRadius.md), borderSide: BorderSide(color: t.lineStrong)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(LitmaRadius.md), borderSide: BorderSide(color: t.lineStrong)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(LitmaRadius.md), borderSide: BorderSide(color: t.accent, width: 2)),
      errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(LitmaRadius.md), borderSide: BorderSide(color: t.danger)),
    ),
    textSelectionTheme: TextSelectionThemeData(
      cursorColor: t.accent,
      selectionColor: t.accent.withValues(alpha: 0.22),
      selectionHandleColor: t.accent,
    ),
    cupertinoOverrideTheme: CupertinoThemeData(primaryColor: t.accent, brightness: brightness),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: t.dialog,
      modalBackgroundColor: t.dialog,
      surfaceTintColor: Colors.transparent,
      showDragHandle: true,
      dragHandleColor: t.lineStrong,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      modalBarrierColor: t.scrim,
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: t.dialog,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(LitmaRadius.lg)),
      titleTextStyle: ui(18, FontWeight.w700),
      contentTextStyle: ui(15, FontWeight.w400, color: t.muted, height: 1.45),
      barrierColor: t.scrim,
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: t.primary,
      contentTextStyle: ui(14.5, FontWeight.w500, color: t.primaryInk),
      actionTextColor: isDark ? t.accent : const Color(0xFFC9BEFF),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(LitmaRadius.md)),
      insetPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
    ),
    popupMenuTheme: PopupMenuThemeData(
      color: t.dialog,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(LitmaRadius.md), side: BorderSide(color: t.line)),
      textStyle: ui(15, FontWeight.w500),
      elevation: 6,
    ),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: SegmentedButton.styleFrom(
        backgroundColor: t.surface,
        selectedBackgroundColor: t.primary,
        selectedForegroundColor: t.primaryInk,
        foregroundColor: t.ink,
        side: BorderSide(color: t.line),
        textStyle: ui(14, FontWeight.w600),
      ),
    ),
    switchTheme: SwitchThemeData(
      trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? t.accent : t.subtle),
      thumbColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? t.accentInk : t.lineStrong),
      trackOutlineColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? t.accent : t.lineStrong),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(color: t.accent, linearTrackColor: t.accentSoft),
    listTileTheme: ListTileThemeData(
      iconColor: t.muted,
      titleTextStyle: ui(15.5, FontWeight.w500),
      subtitleTextStyle: ui(13, FontWeight.w400, color: t.muted),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16),
    ),
  );
}
