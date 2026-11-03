import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../core/config.dart';
import 'auth.dart';

/// The AI companion's actions (packages/shared/src/ai-prompts.ts AI_ACTIONS; the prompts are built
/// on the server by the litma-ai Edge Function).
const aiActions = <String, ({String label, String ml, bool needsSelection})>{
  'continue': (label: 'Continue writing', ml: 'തുടർന്നെഴുതുക', needsSelection: false),
  'rewrite': (label: 'Rewrite', ml: 'മാറ്റിയെഴുതുക', needsSelection: true),
  'polish': (label: 'Polish language', ml: 'ഭാഷ മിനുക്കുക', needsSelection: true),
  'proofread': (label: 'Proofread', ml: 'തെറ്റുതിരുത്തുക', needsSelection: true),
  'synonyms': (label: 'Synonyms', ml: 'പര്യായങ്ങൾ', needsSelection: true),
  'rhymes': (label: 'Rhymes (പ്രാസം)', ml: 'പ്രാസം', needsSelection: true),
  'dialogue': (label: 'Dialogue ideas', ml: 'സംഭാഷണം', needsSelection: false),
  'describe': (label: 'Describe the scene', ml: 'വിവരണം', needsSelection: false),
  'titles': (label: 'Title ideas', ml: 'ശീർഷകങ്ങൾ', needsSelection: false),
  'summarize': (label: 'Summarise', ml: 'സംഗ്രഹം', needsSelection: false),
  'toMalayalam': (label: 'Translate to Malayalam', ml: 'മലയാളത്തിലേക്ക്', needsSelection: true),
  'toEnglish': (label: 'Translate to English', ml: 'ഇംഗ്ലീഷിലേക്ക്', needsSelection: true),
  'critique': (label: "Editor's notes", ml: 'നിരൂപണം', needsSelection: false),
};

const aiProviders = {'anthropic': 'Claude', 'openai': 'GPT', 'gemini': 'Gemini'};

/// Why a call failed in a way the panel can act on (no key, no credit, rejected key).
enum AiWhy { nokey, nocredit, badkey }

AiWhy? classifyAIError(String raw) {
  final m = raw.toLowerCase();
  if (RegExp(r'credit balance|insufficient_quota|billing|exceeded your current quota|payment').hasMatch(m)) return AiWhy.nocredit;
  if (RegExp(r'invalid x-api-key|invalid api key|incorrect api key|api key not valid|authentication_error|\b401\b').hasMatch(m)) return AiWhy.badkey;
  return null;
}

/// The request Litma hands to the Claude app: Claude reads the work through the Litma connector
/// (MCP) and sends the result back with suggest_edit, on the writer's own Claude plan (the web's
/// claudeAppPrompt).
String claudeAppPrompt({required String action, required String instruction, required String title, required String docId, required String selection}) {
  final task = action == 'custom' ? instruction.trim() : aiActions[action]!.label;
  final sel = selection.trim();
  final quoted = sel.length > 2500 ? '${sel.substring(0, 1200)}\n[…]\n${sel.substring(sel.length - 1200)}' : sel;
  return [
    'Using the Litma connector, open my work “$title” (document id $docId) and read it for context.',
    'Task: $task${action != 'custom' && instruction.trim().isNotEmpty ? '. Also: ${instruction.trim()}' : ''}.',
    sel.isNotEmpty ? 'Work on this passage:\n"""\n$quoted\n"""' : 'Work from where the text ends.',
    action == 'toEnglish' ? 'Write the result in English.' : 'Write in Malayalam script.',
    'Send the result to my editor with suggest_edit so I can review it: kind “replace” with target_text for a rewritten passage, “insert” for new text, “comment” for lists, ideas or notes. Don\'t change the document directly.',
  ].join('\n\n');
}

class AiException implements Exception {
  AiException(this.raw);
  final String raw;
  AiWhy? get why => classifyAIError(raw);
  @override
  String toString() => raw;
}

/// Calls to the litma-ai Edge Function with the writer's session (keys are stored encrypted on the
/// server, per writer; only the last 4 characters ever come back).
class AiApi {
  AiApi(this.auth, {http.Client? client}) : _client = client ?? http.Client();
  final AuthGateway auth;
  final http.Client _client;

  Future<Map<String, String>> _headers() async {
    final token = await auth.accessToken();
    if (token == null) throw AiException('Sign in to use the AI companion.');
    return {'content-type': 'application/json', 'authorization': 'Bearer $token', 'apikey': AppConfig.supabaseAnonKey};
  }

  Uri get _url => Uri.parse('${AppConfig.functionsUrl}/litma-ai');

  Future<dynamic> _call(Map<String, dynamic> body) async {
    final r = await _client.post(_url, headers: await _headers(), body: jsonEncode(body)).timeout(const Duration(seconds: 20));
    if (r.statusCode != 200) throw AiException(r.body);
    return jsonDecode(r.body);
  }

  /// Providers the writer has a key for.
  Future<List<({String provider, String last4})>> keys() async {
    final list = (await _call({'op': 'keys'}) as List).cast<Map>();
    return [for (final k in list) (provider: '${k['provider']}', last4: '${k['last4']}')];
  }

  Future<void> setKey(String provider, String key) => _call({'op': 'set_key', 'provider': provider, 'key': key});
  Future<void> deleteKey(String provider) => _call({'op': 'delete_key', 'provider': provider});

  /// Stream the answer as it is written.
  Stream<String> chat({required String provider, required String action, required String kind, String selection = '', String context = '', String instruction = ''}) async* {
    final req = http.Request('POST', _url)
      ..headers.addAll(await _headers())
      ..body = jsonEncode({'op': 'chat', 'provider': provider, 'action': action, 'kind': kind, 'selection': selection, 'context': context, 'instruction': instruction});
    final res = await _client.send(req).timeout(const Duration(seconds: 30));
    if (res.statusCode != 200) throw AiException(await res.stream.bytesToString());
    yield* res.stream.transform(utf8.decoder);
  }
}
