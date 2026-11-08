import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:timezone/timezone.dart' as tz;

import 'goals.dart';

/// The phone's own notifications for the daily writing reminder and the writing timer. Scheduled on
/// the phone, so they ring with the app closed; nothing goes through a server (free). Times are
/// fixed instants (UTC), so no time zone database is needed.
abstract final class Notifications {
  static final _plugin = FlutterLocalNotificationsPlugin();
  static Future<bool?>? _ready;

  /// Writer allowed reminders on this phone (same key as the web's per-device switch).
  static const deviceKey = 'litma:reminders';

  static Future<bool?> _init() => _ready ??= _plugin.initialize(
        settings: const InitializationSettings(
          android: AndroidInitializationSettings('@mipmap/ic_launcher'),
          iOS: DarwinInitializationSettings(requestAlertPermission: false, requestBadgePermission: false, requestSoundPermission: false),
        ),
      );

  static const _details = NotificationDetails(
    android: AndroidNotificationDetails('litma_writing', 'Writing reminders', channelDescription: 'The daily reminder and the writing timer', importance: Importance.defaultImportance, priority: Priority.defaultPriority),
    iOS: DarwinNotificationDetails(),
  );

  /// Ask the phone for permission to show notifications.
  static Future<bool> ask() async {
    try {
      await _init();
      if (defaultTargetPlatform == TargetPlatform.android) {
        return await _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()?.requestNotificationsPermission() ?? true;
      }
      return await _plugin.resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>()?.requestPermissions(alert: true, badge: false, sound: true) ?? false;
    } catch (_) {
      return false;
    }
  }

  static Future<void> at(int id, DateTime when, String title, String body) async {
    if (!when.isAfter(DateTime.now())) return;
    try {
      await _init();
      await _plugin.zonedSchedule(
        id: id,
        title: title,
        body: body,
        scheduledDate: tz.TZDateTime.from(when.toUtc(), tz.UTC),
        notificationDetails: _details,
        androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      );
    } catch (_) {
      /* notifications not available (tests, or blocked) */
    }
  }

  static Future<void> now(int id, String title, String body) async {
    try {
      await _init();
      await _plugin.show(id: id, title: title, body: body, notificationDetails: _details);
    } catch (_) {
      /* not available */
    }
  }

  static Future<void> cancel(int id) async {
    try {
      await _init();
      await _plugin.cancel(id: id);
    } catch (_) {
      /* not available */
    }
  }

  static const _reminderBase = 1000;
  static const timerId = 2000;

  /// Schedule the reminder for the next seven days (one notification a day it may ring), skipping
  /// today when today's goal is already met. Called when the app opens, after writing and after the
  /// writer changes the reminder.
  static Future<void> scheduleReminders({
    required SharedPreferences prefs,
    required ReminderPrefs reminder,
    required int dailyGoal,
    required int todayWords,
    required String title,
    required String Function(int left) bodyLeft,
    required String body,
  }) async {
    for (var i = 0; i < 7; i++) {
      await cancel(_reminderBase + i);
    }
    if (!reminder.on || prefs.getString(deviceKey) != 'on') return;
    final now = DateTime.now();
    final met = dailyGoal > 0 ? todayWords >= dailyGoal : todayWords > 0;
    for (var i = 0; i < 7; i++) {
      final d = DateTime(now.year, now.month, now.day + i, reminder.hour, reminder.minute);
      if (!reminder.days.contains(d.weekday % 7)) continue;
      if (i == 0 && met) continue;
      final left = i == 0 && dailyGoal > 0 ? dailyGoal - todayWords : dailyGoal;
      await at(_reminderBase + i, d, title, left > 0 ? bodyLeft(left) : body);
    }
  }
}
