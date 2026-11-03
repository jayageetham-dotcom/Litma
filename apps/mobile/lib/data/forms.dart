/// Writing types (സാഹിത്യരൂപം): a port of packages/shared/src/forms.ts. Keep the two in step.
library;

enum DocKind { novel, story, poem, screenplay, feature, essay, drama, lyrics, diary, blank }

DocKind kindFrom(String? s) => DocKind.values.firstWhere((k) => k.name == s, orElse: () => DocKind.blank);

const kindNames = <DocKind, ({String ml, String en})>{
  DocKind.novel: (ml: 'നോവൽ', en: 'Novel'),
  DocKind.story: (ml: 'ചെറുകഥ', en: 'Short story'),
  DocKind.poem: (ml: 'കവിത', en: 'Poem'),
  DocKind.screenplay: (ml: 'തിരക്കഥ', en: 'Screenplay'),
  DocKind.feature: (ml: 'ഫീച്ചർ', en: 'Feature writing'),
  DocKind.essay: (ml: 'ലേഖനം', en: 'Essay / article'),
  DocKind.drama: (ml: 'നാടകം', en: 'Drama / play'),
  DocKind.lyrics: (ml: 'ഗാനം', en: 'Song lyrics'),
  DocKind.diary: (ml: 'ഡയറി', en: 'Diary / memoir'),
  DocKind.blank: (ml: 'ശൂന്യം', en: 'Blank page'),
};

typedef Json = Map<String, dynamic>;

const Json defaultSettings = {
  'pageSize': 'A4',
  'margins': {'top': 25, 'bottom': 25, 'left': 25, 'right': 25},
  'font': 'Noto Serif Malayalam',
  'fontSize': 12,
  'lineHeight': 1.75,
  'goal': 0,
  'notes': '',
  'characters': <Object>[],
  'inputMode': 'manglish',
};

const Map<DocKind, Json> _formSettings = {
  DocKind.novel: {'font': 'Noto Serif Malayalam', 'fontSize': 12, 'lineHeight': 1.8, 'margins': {'top': 25, 'bottom': 25, 'left': 28, 'right': 25}},
  DocKind.story: {'font': 'Noto Serif Malayalam', 'fontSize': 12, 'lineHeight': 1.8},
  DocKind.poem: {'font': 'Manjari', 'fontSize': 13, 'lineHeight': 1.9, 'showMetre': false, 'margins': {'top': 30, 'bottom': 25, 'left': 30, 'right': 30}},
  DocKind.screenplay: {'font': 'Noto Sans Malayalam', 'fontSize': 11, 'lineHeight': 1.65, 'margins': {'top': 22, 'bottom': 22, 'left': 22, 'right': 22}},
  DocKind.feature: {'font': 'Noto Serif Malayalam', 'fontSize': 11.5, 'lineHeight': 1.75},
  DocKind.essay: {'font': 'Noto Serif Malayalam', 'fontSize': 12, 'lineHeight': 1.75},
  DocKind.drama: {'font': 'Noto Serif Malayalam', 'fontSize': 12, 'lineHeight': 1.7},
  DocKind.lyrics: {'font': 'Manjari', 'fontSize': 13, 'lineHeight': 1.9, 'showMetre': false},
  DocKind.diary: {'font': 'Gayathri', 'fontSize': 13, 'lineHeight': 1.85},
  DocKind.blank: {},
};

Json settingsFor(DocKind kind) {
  final f = _formSettings[kind] ?? const {};
  return {
    ...defaultSettings,
    ...f,
    'margins': {...(defaultSettings['margins'] as Map), ...((f['margins'] as Map?) ?? const {})},
  };
}

/// Settings for a brand-new work (new screenplays number scenes "രംഗം 1").
Json newSettings(DocKind kind) {
  final s = settingsFor(kind);
  if (kind == DocKind.screenplay) s['headingLabels'] = 'ml';
  return s;
}

Json _sb(String variant, [String? text]) => {
      'type': 'styledBlock',
      'attrs': {'variant': variant},
      if (text != null) 'content': [
        {'type': 'text', 'text': text}
      ],
    };
Json _p([String? text]) => {
      'type': 'paragraph',
      if (text != null) 'content': [
        {'type': 'text', 'text': text}
      ],
    };
Json _node(String type, [String? text]) => {
      'type': type,
      if (text != null) 'content': [
        {'type': 'text', 'text': text}
      ],
    };
Json _dlg() => {'type': 'dialogue', 'content': [_node('dialogueCue'), _node('dialogueSpeech')]};
Json _cast() => {'type': 'castEntry', 'content': [_node('castName'), _node('castRole')]};

Json starterContent(DocKind kind, {DateTime? now}) => switch (kind) {
      DocKind.novel => {'type': 'doc', 'content': [_sb('title'), _sb('author'), _sb('epigraph'), _sb('chapter'), _p()]},
      DocKind.story => {'type': 'doc', 'content': [_sb('title'), _sb('author'), _p()]},
      DocKind.essay => {'type': 'doc', 'content': [_sb('title'), _sb('subtitle'), _sb('author'), _p()]},
      DocKind.poem => {'type': 'doc', 'content': [_sb('title'), _sb('author'), _p()]},
      DocKind.screenplay => {
          'type': 'doc',
          'content': [_node('sceneHeading'), _node('sceneTime'), _node('sceneCast'), _node('action'), _dlg()]
        },
      DocKind.feature => {'type': 'doc', 'content': [_sb('kicker'), _sb('title'), _sb('standfirst'), _sb('byline'), _p()]},
      DocKind.drama => {
          'type': 'doc',
          'content': [_sb('title'), _sb('author'), _sb('subhead', 'കഥാപാത്രങ്ങൾ'), _cast(), _sb('scene'), _sb('stage'), _dlg()]
        },
      DocKind.lyrics => {
          'type': 'doc',
          'content': [_sb('title'), _sb('credits'), _sb('part', 'പല്ലവി'), _p(), _sb('part', 'അനുപല്ലവി'), _p(), _sb('part', 'ചരണം'), _p()]
        },
      DocKind.diary => {'type': 'doc', 'content': [_sb('title'), _sb('dateline', todayLine(now ?? DateTime.now())), _p()]},
      DocKind.blank => {'type': 'doc', 'content': [_p()]},
    };

/// A new work's empty author or byline line filled with the writer's name.
Json withAuthor(Json content, String? name) {
  final n = name?.trim();
  if (n == null || n.isEmpty) return content;
  var done = false;
  final blocks = [
    for (final b in (content['content'] as List? ?? const []).cast<Json>())
      if (!done &&
          b['type'] == 'styledBlock' &&
          const ['author', 'byline'].contains((b['attrs'] as Map?)?['variant']) &&
          ((b['content'] as List?)?.isEmpty ?? true))
        () {
          done = true;
          return {
            ...b,
            'content': [
              {'type': 'text', 'text': n}
            ]
          };
        }()
      else
        b,
  ];
  return {...content, 'content': blocks};
}

const _months = ['ജനുവരി', 'ഫെബ്രുവരി', 'മാർച്ച്', 'ഏപ്രിൽ', 'മേയ്', 'ജൂൺ', 'ജൂലൈ', 'ഓഗസ്റ്റ്', 'സെപ്റ്റംബർ', 'ഒക്ടോബർ', 'നവംബർ', 'ഡിസംബർ'];
const _weekdays = ['തിങ്കളാഴ്ച', 'ചൊവ്വാഴ്ച', 'ബുധനാഴ്ച', 'വ്യാഴാഴ്ച', 'വെള്ളിയാഴ്ച', 'ശനിയാഴ്ച', 'ഞായറാഴ്ച'];

/// Today's date as a diary heading, e.g. "2026 നവംബർ 3, ചൊവ്വാഴ്ച" (same as the web's ml-IN format).
String todayLine(DateTime d) => '${d.year} ${_months[d.month - 1]} ${d.day}, ${_weekdays[d.weekday - 1]}';

/// Prompts shown on empty lines (apps/web/src/components/editor/extensions.ts).
const variantPrompt = <String, String>{
  'title': 'ശീർഷകം',
  'subtitle': 'ഉപശീർഷകം',
  'author': 'എഴുതുന്ന ആളുടെ പേര്',
  'chapter': 'അദ്ധ്യായത്തിന്റെ പേര്',
  'kicker': 'വിഭാഗം (ഉദാ: യാത്ര)',
  'standfirst': 'ലേഖനത്തിന്റെ ചുരുക്കം രണ്ടു വരിയിൽ…',
  'byline': 'എഴുതിയത്: …',
  'subhead': 'ഉപതലക്കെട്ട്',
  'pullquote': 'ശ്രദ്ധേയമായ ഒരു വരി…',
  'part': 'പല്ലവി / അനുപല്ലവി / ചരണം',
  'stage': 'രംഗനിർദ്ദേശം',
  'dateline': 'തീയതി',
  'epigraph': 'മേൽക്കുറിപ്പ്',
  'caption': 'അടിക്കുറിപ്പ്',
  'stanza': 'ഖണ്ഡത്തിന് പേര് (വേണമെങ്കിൽ)',
  'act': 'അങ്കത്തിന് പേര് (വേണമെങ്കിൽ)',
  'scene': 'സ്ഥലം, സമയം (വേണമെങ്കിൽ)',
  'refrain': 'ആവർത്തിക്കുന്ന വരി',
  'credits': 'ചിത്രം / ആൽബം · സംഗീതം · ആലാപനം',
  'infobox': 'വിവരപ്പെട്ടി: ചെറിയ വസ്തുതകൾ, കണക്കുകൾ…',
  'references': 'അവലംബം',
};

const nodePrompt = <String, String>{
  'sceneHeading': 'Int./Ext. സ്ഥലം',
  'castName': 'കഥാപാത്രം',
  'castRole': 'ആരാണ് (ഒറ്റവരിയിൽ)',
  'sceneTime': 'പകൽ / രാത്രി',
  'sceneCast': 'കഥാപാത്രങ്ങൾ',
  'action': 'രംഗവിവരണം…',
  'dialogueCue': 'കഥാപാത്രം',
  'dialogueSpeech': 'സംഭാഷണം…',
  'transition': 'കട്ട് ടു',
  'heading': 'തലക്കെട്ട്',
};

/// Block names for the block menu, in both languages ("അങ്കം · Act").
const variantNames = <String, ({String label, String ml})>{
  'title': (label: 'Title', ml: 'ശീർഷകം'),
  'subtitle': (label: 'Subtitle', ml: 'ഉപശീർഷകം'),
  'author': (label: 'Author', ml: 'രചന'),
  'chapter': (label: 'Chapter', ml: 'അദ്ധ്യായം'),
  'kicker': (label: 'Kicker', ml: 'കിക്കർ'),
  'standfirst': (label: 'Standfirst', ml: 'ആമുഖം'),
  'byline': (label: 'Byline', ml: 'ബൈലൈൻ'),
  'subhead': (label: 'Subhead', ml: 'ഉപതലക്കെട്ട്'),
  'pullquote': (label: 'Pull quote', ml: 'ഉദ്ധരണി'),
  'part': (label: 'Song part', ml: 'ഭാഗം'),
  'stage': (label: 'Stage direction', ml: 'രംഗനിർദ്ദേശം'),
  'dateline': (label: 'Date', ml: 'തീയതി'),
  'epigraph': (label: 'Epigraph', ml: 'മേൽക്കുറിപ്പ്'),
  'caption': (label: 'Caption', ml: 'അടിക്കുറിപ്പ്'),
  'stanza': (label: 'Stanza', ml: 'ഖണ്ഡം'),
  'act': (label: 'Act', ml: 'അങ്കം'),
  'scene': (label: 'Scene', ml: 'രംഗം'),
  'refrain': (label: 'Repeat line', ml: 'ആവർത്തനം'),
  'credits': (label: 'Song details', ml: 'ഗാനവിവരം'),
  'infobox': (label: 'Info box', ml: 'വിവരപ്പെട്ടി'),
  'references': (label: 'References', ml: 'അവലംബം'),
};

/// Which styled blocks the block menu offers for each writing type (most useful first).
List<String> menuVariants(DocKind kind) => switch (kind) {
      DocKind.novel => ['chapter', 'epigraph', 'subhead', 'title', 'author'],
      DocKind.story => ['subhead', 'epigraph', 'title', 'author'],
      DocKind.poem => ['stanza', 'title', 'author', 'epigraph'],
      DocKind.lyrics => ['part', 'refrain', 'credits', 'title'],
      DocKind.feature => ['subhead', 'pullquote', 'infobox', 'caption', 'kicker', 'standfirst', 'byline', 'title'],
      DocKind.essay => ['subhead', 'pullquote', 'references', 'title', 'subtitle', 'author'],
      DocKind.drama => ['act', 'scene', 'stage', 'subhead', 'title', 'author'],
      DocKind.diary => ['dateline', 'subhead', 'title'],
      DocKind.screenplay => ['subhead'],
      DocKind.blank => ['title', 'subhead', 'chapter', 'pullquote'],
    };
