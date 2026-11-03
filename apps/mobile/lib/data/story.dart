import 'forms.dart';

/// Story World (കഥാലോകം): a port of apps/web/src/lib/story.ts. Cards per work in `story_items`.
enum StoryKind { character, location, item, beat, event, note }

StoryKind storyKindFrom(String? s) => StoryKind.values.firstWhere((k) => k.name == s, orElse: () => StoryKind.note);

class FieldDef {
  const FieldDef(this.key, this.label, {this.multiline = false, this.options, this.placeholder});
  final String key;
  final String label;
  final bool multiline;
  final List<String>? options;
  final String? placeholder;
}

const storyFields = <StoryKind, List<FieldDef>>{
  StoryKind.character: [
    FieldDef('role', 'Role', options: ['Protagonist', 'Antagonist', 'Supporting', 'Minor', 'Narrator']),
    FieldDef('age', 'Age'),
    FieldDef('gender', 'Gender'),
    FieldDef('occupation', 'Occupation'),
    FieldDef('appearance', 'Appearance', multiline: true, placeholder: 'How they look, dress, move'),
    FieldDef('personality', 'Personality', multiline: true),
    FieldDef('backstory', 'Backstory', multiline: true),
    FieldDef('goal', 'Wants / goal', multiline: true),
    FieldDef('conflict', 'Conflict / fear', multiline: true),
    FieldDef('arc', 'Arc: how they change', multiline: true),
    FieldDef('relationships', 'Relationships', multiline: true, placeholder: 'ഡെന്നി: കോളേജ് സുഹൃത്ത്…'),
    FieldDef('voice', 'Voice & dialect', multiline: true, placeholder: 'Thrissur slang, short sentences…'),
  ],
  StoryKind.location: [
    FieldDef('setting', 'Interior / exterior', options: ['Int.', 'Ext.', 'Int./Ext.']),
    FieldDef('period', 'Time / period'),
    FieldDef('description', 'Description', multiline: true),
    FieldDef('senses', 'Sights, sounds, smells', multiline: true),
    FieldDef('significance', 'Why it matters', multiline: true),
  ],
  StoryKind.item: [
    FieldDef('owner', 'Belongs to'),
    FieldDef('first', 'First appears'),
    FieldDef('description', 'Description', multiline: true),
    FieldDef('significance', 'Why it matters', multiline: true),
  ],
  StoryKind.beat: [
    FieldDef('group', 'Act / chapter'),
    FieldDef('status', 'Status', options: ['Idea', 'Drafting', 'Written', 'Revise']),
    FieldDef('color', 'Colour', options: ['kayal', 'kasavu', 'rose', 'sky', 'grey']),
  ],
  StoryKind.event: [
    FieldDef('when', 'When', placeholder: '1987 ഓണം / Day 3, night'),
    FieldDef('who', 'Who is involved'),
    FieldDef('where', 'Where'),
  ],
  StoryKind.note: [FieldDef('link', 'Link / source')],
};

class StoryTab {
  const StoryTab(this.kind, this.id, this.label, this.ml, {this.summary});
  final StoryKind? kind; // null: reports
  final String id;
  final String label;
  final String ml;
  final String? summary;
}

const _report = StoryTab(null, 'report', 'Reports', 'റിപ്പോർട്ട്');

/// Which Story World sections each writing type gets.
List<StoryTab> storyTabsFor(DocKind kind) {
  switch (kind) {
    case DocKind.screenplay:
    case DocKind.drama:
      final play = kind == DocKind.drama;
      return [
        const StoryTab(StoryKind.character, 'characters', 'Characters', 'കഥാപാത്രങ്ങൾ', summary: 'One-line description'),
        play
            ? const StoryTab(StoryKind.location, 'sets', 'Sets', 'രംഗപടങ്ങൾ', summary: 'One-line description')
            : const StoryTab(StoryKind.location, 'locations', 'Locations', 'ലൊക്കേഷനുകൾ', summary: 'One-line description'),
        const StoryTab(StoryKind.item, 'props', 'Props', 'സാമഗ്രികൾ', summary: 'One-line description'),
        const StoryTab(StoryKind.beat, 'beats', 'Beat board', 'ബീറ്റുകൾ', summary: 'What happens'),
        const StoryTab(StoryKind.event, 'timeline', 'Timeline', 'കാലക്രമം', summary: 'What happened'),
        const StoryTab(StoryKind.note, 'notes', 'Notes', 'കുറിപ്പുകൾ', summary: 'Note'),
        _report,
      ];
    case DocKind.novel:
    case DocKind.story:
      return const [
        StoryTab(StoryKind.character, 'characters', 'Characters', 'കഥാപാത്രങ്ങൾ', summary: 'One-line description'),
        StoryTab(StoryKind.location, 'places', 'Places', 'സ്ഥലങ്ങൾ', summary: 'One-line description'),
        StoryTab(StoryKind.item, 'objects', 'Objects', 'വസ്തുക്കൾ', summary: 'One-line description'),
        StoryTab(StoryKind.beat, 'plot', 'Plot board', 'കഥാഘടന', summary: 'What happens'),
        StoryTab(StoryKind.event, 'timeline', 'Timeline', 'കാലക്രമം', summary: 'What happened'),
        StoryTab(StoryKind.note, 'research', 'Research', 'ഗവേഷണം', summary: 'Note'),
        _report,
      ];
    case DocKind.poem:
    case DocKind.lyrics:
      return const [
        StoryTab(StoryKind.note, 'images', 'Images & ideas', 'ബിംബങ്ങൾ', summary: 'Image, line or idea'),
        StoryTab(StoryKind.beat, 'structure', 'Structure', 'ഘടന', summary: 'What this stanza or part does'),
        StoryTab(StoryKind.character, 'voices', 'Voices', 'ശബ്ദങ്ങൾ', summary: 'Who speaks'),
        _report,
      ];
    case DocKind.feature:
    case DocKind.essay:
      return const [
        StoryTab(StoryKind.character, 'people', 'People', 'വ്യക്തികൾ', summary: 'Who they are'),
        StoryTab(StoryKind.location, 'places', 'Places', 'സ്ഥലങ്ങൾ', summary: 'One-line description'),
        StoryTab(StoryKind.note, 'sources', 'Sources', 'സ്രോതസ്സുകൾ', summary: 'Quote, fact or source'),
        StoryTab(StoryKind.beat, 'outline', 'Outline', 'രൂപരേഖ', summary: 'Point to make'),
        _report,
      ];
    case DocKind.diary:
      return const [
        StoryTab(StoryKind.character, 'people', 'People', 'വ്യക്തികൾ', summary: 'Who they are'),
        StoryTab(StoryKind.location, 'places', 'Places', 'സ്ഥലങ്ങൾ', summary: 'One-line description'),
        StoryTab(StoryKind.event, 'timeline', 'Timeline', 'കാലക്രമം', summary: 'What happened'),
        StoryTab(StoryKind.note, 'notes', 'Notes', 'കുറിപ്പുകൾ', summary: 'Note'),
        _report,
      ];
    case DocKind.blank:
      return const [
        StoryTab(StoryKind.character, 'characters', 'Characters', 'കഥാപാത്രങ്ങൾ', summary: 'One-line description'),
        StoryTab(StoryKind.location, 'places', 'Places', 'സ്ഥലങ്ങൾ', summary: 'One-line description'),
        StoryTab(StoryKind.beat, 'outlineStory', 'Outline', 'രൂപരേഖ', summary: 'What happens'),
        StoryTab(StoryKind.note, 'notes', 'Notes', 'കുറിപ്പുകൾ', summary: 'Note'),
        _report,
      ];
  }
}

/// Beat board columns a writing type starts with (settings.beatColumns overrides).
List<String> defaultBeatGroups(DocKind kind) => switch (kind) {
      DocKind.screenplay => ['Act 1 · ആരംഭം', 'Act 2 · സംഘർഷം', 'Act 3 · പരിഹാരം'],
      DocKind.drama => ['അങ്കം 1 · Act 1', 'അങ്കം 2 · Act 2', 'അങ്കം 3 · Act 3'],
      DocKind.novel || DocKind.story => ['ആരംഭം', 'മധ്യം', 'അന്ത്യം'],
      DocKind.poem || DocKind.lyrics => ['പല്ലവി', 'അനുപല്ലവി', 'ചരണം'],
      _ => ['ആമുഖം', 'പ്രധാന ഭാഗം', 'ഉപസംഹാരം'],
    };

/// A card nobody has written anything in yet (closed right after "Add"): deleted, like on the web.
bool isBlankItem(Json it) {
  const auto = {'group', 'status', 'color'};
  if ('${it['name'] ?? ''}'.trim().isNotEmpty || '${it['summary'] ?? ''}'.trim().isNotEmpty || it['image_url'] != null) return false;
  final data = (it['data'] as Map?) ?? const {};
  return data.entries.every((e) => auto.contains(e.key) || '${e.value ?? ''}'.trim().isEmpty);
}
