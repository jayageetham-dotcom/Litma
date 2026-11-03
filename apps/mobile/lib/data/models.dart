import 'forms.dart';

export 'forms.dart' show DocKind, Json;

/// A work, exactly as stored in Supabase `documents` (and in the web app's LitmaDoc).
/// `content` is Tiptap JSON and `settings` is kept as raw JSON, so fields this app doesn't know
/// yet travel through untouched.
class LitmaDoc {
  LitmaDoc({
    required this.id,
    required this.title,
    required this.kind,
    required this.content,
    required this.settings,
    this.wordCount = 0,
    this.archived = false,
    this.isPublic = false,
    this.shareId,
    this.plainText,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String title;
  final DocKind kind;
  final Json content;
  final Json settings;
  final int wordCount;
  final bool archived;
  final bool isPublic;
  final String? shareId;
  final String? plainText;
  final DateTime createdAt;
  final DateTime updatedAt;

  bool get pristine => settings['pristine'] == true;
  bool get hasContent => (content['content'] as List?)?.isNotEmpty ?? false;

  String get excerpt {
    final src = plainText ?? (hasContent ? plainTextOf(content) : '');
    final s = src.replaceAll(RegExp(r'\s+'), ' ').trim();
    return s.length > 220 ? s.substring(0, 220) : s;
  }

  static LitmaDoc fromRow(Json r) => LitmaDoc(
        id: r['id'] as String,
        title: (r['title'] as String?) ?? '',
        kind: kindFrom(r['kind'] as String?),
        content: (r['content'] as Map?)?.cast<String, dynamic>() ?? const {'type': 'doc'},
        settings: (r['settings'] as Map?)?.cast<String, dynamic>() ?? const {},
        wordCount: (r['word_count'] as num?)?.toInt() ?? 0,
        archived: r['archived'] == true,
        isPublic: r['is_public'] == true,
        shareId: r['share_id'] as String?,
        plainText: r['plain_text'] as String?,
        createdAt: DateTime.tryParse('${r['created_at']}') ?? DateTime.now(),
        updatedAt: DateTime.tryParse('${r['updated_at']}') ?? DateTime.now(),
      );

  Json toRow() => {
        'id': id,
        'title': title,
        'kind': kind.name,
        'content': content,
        'settings': settings,
        'word_count': wordCount,
        'archived': archived,
        'is_public': isPublic,
        'share_id': shareId,
        'plain_text': plainText,
        'created_at': createdAt.toUtc().toIso8601String(),
        'updated_at': updatedAt.toUtc().toIso8601String(),
      };

  LitmaDoc copyWith({String? title, Json? content, Json? settings, int? wordCount, bool? archived, DateTime? updatedAt, String? plainText}) => LitmaDoc(
        id: id,
        title: title ?? this.title,
        kind: kind,
        content: content ?? this.content,
        settings: settings ?? this.settings,
        wordCount: wordCount ?? this.wordCount,
        archived: archived ?? this.archived,
        isPublic: isPublic,
        shareId: shareId,
        plainText: plainText ?? this.plainText,
        createdAt: createdAt,
        updatedAt: updatedAt ?? this.updatedAt,
      );
}

/// Plain text of Tiptap JSON (same rules as the web's plainText(): blocks on their own lines).
String plainTextOf(Json node) {
  final type = node['type'];
  if (type == 'text') return (node['text'] as String?) ?? '';
  if (type == 'hardBreak') return '\n';
  final kids = (node['content'] as List?)?.cast<Json>() ?? const [];
  final sep = (type == 'doc' || type == 'dialogue') ? '\n' : '';
  return kids.map(plainTextOf).join(sep);
}

/// The writer's profile (Supabase `profiles`), with the fields the app uses.
class Profile {
  Profile({required this.id, this.displayName, this.penName, this.email, this.preferences = const {}, this.dailyGoal = 500});
  final String id;
  final String? displayName;
  final String? penName;
  final String? email;
  final Json preferences;
  final int dailyGoal;

  String get name => (penName?.trim().isNotEmpty ?? false) ? penName!.trim() : ((displayName?.trim().isNotEmpty ?? false) ? displayName!.trim() : (email?.split('@').first ?? ''));

  static Profile fromRow(Json r, {String? email}) => Profile(
        id: r['id'] as String,
        displayName: r['display_name'] as String?,
        penName: r['pen_name'] as String?,
        email: email,
        preferences: (r['preferences'] as Map?)?.cast<String, dynamic>() ?? const {},
        dailyGoal: (r['daily_goal'] as num?)?.toInt() ?? 500,
      );
}
