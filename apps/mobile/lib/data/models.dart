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

/// The writer's profile (Supabase `profiles`, the web's Profile type).
class Profile {
  Profile({
    required this.id,
    this.displayName,
    this.penName,
    this.username,
    this.bio,
    this.location,
    this.website,
    this.avatarUrl,
    this.email,
    this.preferences = const {},
    this.dailyGoal = 500,
  });
  final String id;
  final String? displayName;
  final String? penName;
  final String? username;
  final String? bio;
  final String? location;
  final String? website;

  /// A photo uploaded earlier (uploads are paused; still shown until removed).
  final String? avatarUrl;
  final String? email;
  final Json preferences;
  final int dailyGoal;

  /// Pen name, else name, else the start of the email (what the app calls the writer).
  String get name => (penName?.trim().isNotEmpty ?? false) ? penName!.trim() : ((displayName?.trim().isNotEmpty ?? false) ? displayName!.trim() : (email?.split('@').first ?? ''));

  /// The name avatars and covers use (the web's profileAvatar: pen name, else name).
  String get avatarName => (penName?.trim().isNotEmpty ?? false) ? penName!.trim() : (displayName?.trim() ?? '');

  static Profile fromRow(Json r, {String? email}) => Profile(
        id: r['id'] as String,
        displayName: r['display_name'] as String?,
        penName: r['pen_name'] as String?,
        username: r['username'] as String?,
        bio: r['bio'] as String?,
        location: r['location'] as String?,
        website: r['website'] as String?,
        avatarUrl: r['avatar_url'] as String?,
        email: email,
        preferences: (r['preferences'] as Map?)?.cast<String, dynamic>() ?? const {},
        dailyGoal: (r['daily_goal'] as num?)?.toInt() ?? 500,
      );
}

/// What a book is made of, in order (the web's BookItem). Unknown fields are kept.
const bookItemLabels = <String, ({String en, String ml})>{
  'cover': (en: 'Front cover', ml: 'മുഖചിത്രം'),
  'half-title': (en: 'Half-title page', ml: 'അർദ്ധശീർഷകം'),
  'title': (en: 'Title page', ml: 'ശീർഷക താൾ'),
  'copyright': (en: 'Copyright page', ml: 'പകർപ്പവകാശം'),
  'dedication': (en: 'Dedication', ml: 'സമർപ്പണം'),
  'epigraph': (en: 'Epigraph', ml: 'മേൽക്കുറിപ്പ്'),
  'toc': (en: 'Contents', ml: 'ഉള്ളടക്കം'),
  'text': (en: 'Text page', ml: 'താൾ'),
  'part': (en: 'Part divider', ml: 'ഭാഗം'),
  'document': (en: 'Chapter', ml: 'അദ്ധ്യായം'),
  'back-cover': (en: 'Back cover', ml: 'പിൻചട്ട'),
};

/// A book (Supabase `books`): details, its structure (covers, front pages, chapters from works)
/// and cover design. Kept as the raw row so cover and settings fields this app doesn't edit yet
/// travel through untouched.
class Book {
  Book(this.row);
  final Json row;

  String get id => row['id'] as String;
  String get title => (row['title'] as String?) ?? '';
  String? get subtitle => row['subtitle'] as String?;
  String? get author => row['author'] as String?;
  List<Json> get structure => ((row['structure'] as List?) ?? const []).cast<Map>().map((m) => m.cast<String, dynamic>()).toList();
  Json get cover => (row['cover'] as Map?)?.cast<String, dynamic>() ?? const {};
  Json get settings => (row['settings'] as Map?)?.cast<String, dynamic>() ?? const {};
  DateTime get updatedAt => DateTime.tryParse('${row['updated_at']}') ?? DateTime.now();
  int get chapters => structure.where((i) => i['type'] == 'document').length;

  static Book fromRow(Json r) => Book(r);
}

/// A new book's standard skeleton: covers, title pages, copyright and contents (the web's DEFAULT_STRUCTURE).
List<Json> defaultBookStructure() => [
      {'id': bookItemId(), 'type': 'cover'},
      {'id': bookItemId(), 'type': 'half-title'},
      {'id': bookItemId(), 'type': 'title'},
      {'id': bookItemId(), 'type': 'copyright'},
      {'id': bookItemId(), 'type': 'toc', 'title': 'ഉള്ളടക്കം'},
      {'id': bookItemId(), 'type': 'back-cover'},
    ];

String bookItemId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  final r = DateTime.now().microsecondsSinceEpoch;
  var n = r ^ (r >> 7) ^ identityHashCode(Object());
  return List.generate(8, (i) {
    n = (n * 1103515245 + 12345) & 0x7fffffff;
    return chars[n % chars.length];
  }).join();
}

/// The "classic" cover preset new books start from (COVER_PRESETS in the web's Cover.tsx).
const classicCover = <String, dynamic>{
  'preset': 'classic',
  'frame': true,
  'titleShadow': false,
  'titleBox': false,
  'titleScale': 1,
  'offsets': <String, dynamic>{},
  'sizes': <String, dynamic>{},
  'image': null,
  'template': 'kasavu',
  'art': 'literary',
  'bg': '#efe9dc',
  'fg': '#3d4232',
  'accent': '#a8875a',
  'font': 'Rachana',
  'ornament': 'flourish',
};
