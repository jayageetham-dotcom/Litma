import 'package:animations/animations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/i18n.dart';
import '../core/motion.dart';
import '../core/theme.dart';
import '../features/auth/welcome_screen.dart';
import '../features/desk/desk_screen.dart';
import '../widgets/brand.dart';
import 'providers.dart';

class LitmaApp extends ConsumerWidget {
  const LitmaApp({super.key, this.home});

  /// Start somewhere else (design previews and tests).
  final Widget? home;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(settingsProvider);
    final strings = ref.watch(stringsProvider);
    return MaterialApp(
      title: 'Litma',
      debugShowCheckedModeBanner: false,
      theme: litmaTheme(Brightness.light),
      darkTheme: litmaTheme(Brightness.dark),
      themeMode: settings.themeMode,
      themeAnimationDuration: Motion.slow,
      themeAnimationCurve: Motion.standard,
      builder: (context, child) => I18n(strings: strings, child: child!),
      home: home ?? const AuthGate(),
    );
  }
}

/// Signed out: the welcome screen. Signed in: the desk. Fades through between them.
class AuthGate extends ConsumerWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final writer = ref.watch(writerProvider);
    final Widget page = switch (writer) {
      AsyncData(:final value) => value == null ? const WelcomeScreen(key: ValueKey('welcome')) : const DeskScreen(key: ValueKey('desk')),
      _ => Scaffold(key: const ValueKey('loading'), body: InkLoader(label: context.t('loading.desk'))),
    };
    return PageTransitionSwitcher(
      duration: Motion.of(context, Motion.page),
      transitionBuilder: (child, a, b) => FadeThroughTransition(animation: a, secondaryAnimation: b, fillColor: context.c.canvas, child: child),
      child: page,
    );
  }
}
