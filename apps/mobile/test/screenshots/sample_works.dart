// Sample works for design previews. Original short texts; names and occasions from Kerala's
// different communities sit side by side as equals (CLAUDE.md fairness rule).
import 'package:litma/data/forms.dart';
import 'package:litma/data/models.dart' show plainTextOf;

Json _t(String s, [List<Json>? marks]) => {'type': 'text', 'text': s, 'marks': ?marks};
Json _p(List<Json> c, {String? align}) => {'type': 'paragraph', if (align != null) 'attrs': {'textAlign': align}, 'content': c};
Json _sb(String v, String text) => {
      'type': 'styledBlock',
      'attrs': {'variant': v},
      'content': [_t(text)]
    };
Json _n(String type, String text) => {'type': type, 'content': [_t(text)]};
Json _dlg(String who, String line) => {'type': 'dialogue', 'content': [_n('dialogueCue', who), _n('dialogueSpeech', line)]};

final sampleProfile = {'id': 'writer-1', 'display_name': 'Aamina Rahman', 'pen_name': 'ആമിന', 'username': 'aamina', 'bio': 'കഥകളും കവിതകളും എഴുതുന്നു. പുഴയും മഴയും ഇഷ്ടം.', 'location': 'തൃശ്ശൂർ', 'website': 'https://getlitma.in', 'daily_goal': 500, 'preferences': <String, dynamic>{'avatar': 'f-2'}};

final novel = {
  'type': 'doc',
  'content': [
    _sb('title', 'പുഴ പറഞ്ഞ കഥ'),
    _sb('author', 'ആമിന'),
    _sb('epigraph', 'ഓരോ പുഴയ്ക്കും ഒരു വീടുണ്ട്, അത് കടലാണ്.'),
    _sb('chapter', 'മഴ തുടങ്ങിയ ദിവസം'),
    _p([
      _t('അന്ന് രാവിലെ മുതൽ മഴയായിരുന്നു. ഉമ്മ ഉമ്മറത്തിരുന്ന് '),
      _t('പഴയ ഒരു പാട്ട്', [
        {'type': 'italic'}
      ]),
      _t(' മൂളുന്നുണ്ടായിരുന്നു. അപ്പുറത്തെ വീട്ടിൽനിന്ന് അമ്മച്ചി വിളിച്ചുചോദിച്ചു, “പുഴ കയറുമോ?”'),
    ]),
    _p([_t('ചേട്ടൻ വള്ളം കെട്ടിയിടാൻ ഓടി. പാടവരമ്പിലൂടെ വെള്ളം കുതിച്ചൊഴുകി, '), _t('ഗ്രാമം മുഴുവൻ', [
        {'type': 'bold'}
      ]), _t(' ആ ശബ്ദം കേട്ടു നിന്നു.')]),
    _p([_t('വൈകുന്നേരമായപ്പോൾ എല്ലാവരും പള്ളിക്കൂടത്തിന്റെ വരാന്തയിൽ ഒത്തുകൂടി. ആരും ഒന്നും പറഞ്ഞില്ല; മഴ മാത്രം സംസാരിച്ചു.')]),
    {'type': 'pageBreak'},
    _sb('chapter', 'പുഴയുടെ ഓർമ'),
    _p([_t('പിറ്റേന്ന് വെയിൽ തെളിഞ്ഞു. പുഴ പഴയതുപോലെ ശാന്തമായി ഒഴുകി, ഒന്നും സംഭവിക്കാത്തതുപോലെ.')]),
  ],
};

final story = {
  'type': 'doc',
  'content': [
    _sb('title', 'ക്രിസ്മസ് രാവിലെ'),
    _sb('author', 'ആമിന'),
    _p([_t('ജോസഫ് നക്ഷത്രം തൂക്കുമ്പോൾ അയലത്തെ ഫാത്തിമ കേക്കുമായി വന്നു. അനിയൻ ഹരി മുറ്റത്ത് പൂക്കളം ഒരുക്കുകയായിരുന്നു, ഓണം കഴിഞ്ഞിട്ടും അവന്റെ ശീലം മാറിയിട്ടില്ല.')]),
    _p([_t('എഴുതാൻ തുടങ്ങിയതേയുള്ളൂ…')]),
  ],
};

final poem = {
  'type': 'doc',
  'content': [
    _sb('title', 'മഴക്കാലം'),
    _sb('author', 'ആമിന'),
    _sb('stanza', 'ഒന്ന്'),
    _p([_t('ഇലകളിൽ വീഴുന്നു'), {'type': 'hardBreak'}, _t('ഒരു പഴയ പാട്ടിന്റെ'), {'type': 'hardBreak'}, _t('ആദ്യത്തെ വരികൾ')]),
    _sb('stanza', 'രണ്ട്'),
    _p([_t('മുറ്റത്തെ ചെളിയിൽ'), {'type': 'hardBreak'}, _t('കുട്ടികളുടെ കാൽപ്പാടുകൾ'), {'type': 'hardBreak'}, _t('കഥ എഴുതുന്നു')]),
  ],
};

final screenplay = {
  'type': 'doc',
  'content': [
    _n('sceneHeading', 'INT. തറവാട്ടു വീട് - അടുക്കള'),
    _n('sceneTime', 'രാത്രി'),
    _n('sceneCast', 'ഉമ്മ, റസിയ, ജോർജ്'),
    _n('action', 'പെരുന്നാൾ തലേന്ന്. അടുക്കളയിൽ ബിരിയാണിയുടെ മണം. റസിയ ജനലിലൂടെ പുറത്തേക്ക് നോക്കുന്നു.'),
    _dlg('ഉമ്മ', 'ജോർജ് വന്നോ? അവന്റെ ഇഷ്ടം അറിയാമല്ലോ.'),
    _dlg('റസിയ', 'വഴിയിലുണ്ട്, ഉമ്മാ. ക്രിസ്മസിന് അവന്റെ വീട്ടിൽ നമ്മൾ പോയതുപോലെ.'),
    _n('action', 'വാതിലിൽ മുട്ട്. ജോർജ് ഒരു പൊതിയുമായി അകത്തേക്ക്.'),
  ],
};

final drama = {
  'type': 'doc',
  'content': [
    _sb('title', 'കടത്തുവള്ളം'),
    _sb('author', 'ആമിന'),
    _sb('subhead', 'കഥാപാത്രങ്ങൾ'),
    {'type': 'castEntry', 'content': [_n('castName', 'വേലായുധൻ'), _n('castRole', 'കടത്തുകാരൻ')]},
    {'type': 'castEntry', 'content': [_n('castName', 'മറിയം'), _n('castRole', 'അധ്യാപിക')]},
    _sb('act', 'പുഴക്കര'),
    _sb('scene', 'സന്ധ്യ'),
    _sb('stage', 'പുഴക്കരയിൽ ഒരു വള്ളം. ദൂരെ പള്ളിമണി.'),
    _dlg('മറിയം', 'ഇന്ന് അവസാനത്തെ കടത്താണോ?'),
    _dlg('വേലായുധൻ', 'നിങ്ങൾക്കായി ഒന്നുകൂടി.'),
  ],
};

final diary = {
  'type': 'doc',
  'content': [
    _sb('title', 'ഓണക്കാലം'),
    _sb('dateline', '2026 സെപ്റ്റംബർ 5, വെള്ളിയാഴ്ച'),
    _p([_t('ഇന്ന് പൂക്കളമിട്ടു. സൈനബയും ജോണും സഹായിക്കാൻ വന്നു. ഉച്ചയ്ക്ക് സദ്യ.')]),
  ],
};

Json _doc(String id, DocKind kind, String title, Json content, int words, String updated) => {
      'id': id,
      'user_id': 'writer-1',
      'title': title,
      'kind': kind.name,
      'content': content,
      'settings': settingsFor(kind)..addAll(kind == DocKind.screenplay ? {'headingLabels': 'ml'} : {}),
      'word_count': words,
      'plain_text': plainTextOf(content),
      'archived': false,
      'is_public': false,
      'share_id': null,
      'created_at': '2026-10-01T08:00:00.000Z',
      'updated_at': updated,
    };

Map<String, List<Json>> sampleTables() {
  final now = DateTime.now().toUtc();
  String ago(Duration d) => now.subtract(d).toIso8601String();
  return {
    'documents': [
      _doc('w-novel', DocKind.novel, 'പുഴ പറഞ്ഞ കഥ', novel, 12480, ago(const Duration(minutes: 12))),
      _doc('w-screenplay', DocKind.screenplay, 'ഒരു പെരുന്നാൾ രാവ്', screenplay, 3210, ago(const Duration(hours: 3))),
      _doc('w-story', DocKind.story, 'ക്രിസ്മസ് രാവിലെ', story, 840, ago(const Duration(days: 1))),
      _doc('w-poem', DocKind.poem, 'മഴക്കാലം', poem, 96, ago(const Duration(days: 3))),
      _doc('w-drama', DocKind.drama, 'കടത്തുവള്ളം', drama, 2150, ago(const Duration(days: 9))),
      _doc('w-diary', DocKind.diary, 'ഓണക്കാലം', diary, 410, ago(const Duration(days: 40))),
    ],
    'profiles': [sampleProfile],
    'story_items': [
      {'id': 's1', 'document_id': 'w-novel', 'kind': 'character', 'name': 'ഉമ്മ', 'summary': 'ഉമ്മറത്തിരുന്ന് പാട്ടു മൂളുന്ന അമ്മ', 'data': {'role': 'Supporting', 'age': '62'}, 'image_url': null, 'position': 1},
      {'id': 's2', 'document_id': 'w-novel', 'kind': 'character', 'name': 'അമ്മച്ചി', 'summary': 'അപ്പുറത്തെ വീട്ടിലെ അയൽക്കാരി', 'data': {'role': 'Supporting'}, 'image_url': null, 'position': 2},
      {'id': 's3', 'document_id': 'w-novel', 'kind': 'character', 'name': 'ചേട്ടൻ', 'summary': 'വള്ളം കെട്ടാൻ ഓടുന്ന മകൻ', 'data': {'role': 'Protagonist'}, 'image_url': null, 'position': 3},
      {'id': 's4', 'document_id': 'w-novel', 'kind': 'beat', 'name': 'മഴ തുടങ്ങുന്നു', 'summary': 'പുഴ കയറുമോ എന്ന ഭയം', 'data': {'group': 'ആരംഭം', 'status': 'Written', 'color': 'kayal'}, 'image_url': null, 'position': 4},
      {'id': 's5', 'document_id': 'w-novel', 'kind': 'beat', 'name': 'പള്ളിക്കൂടത്തിൽ', 'summary': 'എല്ലാവരും ഒത്തുകൂടുന്നു', 'data': {'group': 'മധ്യം', 'status': 'Drafting', 'color': 'kasavu'}, 'image_url': null, 'position': 5},
    ],
    'books': [
      {
        'id': 'b-1',
        'title': 'പുഴയുടെ കഥകൾ',
        'subtitle': 'ചെറുകഥകൾ',
        'author': 'ആമിന',
        'structure': [
          {'id': 'i1', 'type': 'cover'},
          {'id': 'i2', 'type': 'half-title'},
          {'id': 'i3', 'type': 'title'},
          {'id': 'i4', 'type': 'toc', 'title': 'ഉള്ളടക്കം'},
          {'id': 'i5', 'type': 'document', 'documentId': 'w-story', 'showTitle': true},
          {'id': 'i6', 'type': 'document', 'documentId': 'w-novel', 'showTitle': true},
          {'id': 'i7', 'type': 'back-cover'},
        ],
        'settings': {'pageSize': 'A5'},
        'cover': {'bg': '#1f3a4d', 'fg': '#f3ead8', 'accent': '#e0b86a', 'frame': true},
        'created_at': '2026-10-01T08:00:00.000Z',
        'updated_at': ago(const Duration(hours: 5)),
      },
    ],
    'writing_days': [
      for (var i = 0; i < 5; i++) {'day': now.subtract(Duration(days: i)).toIso8601String().substring(0, 10), 'words': 300 + i * 40},
    ],
  };
}
