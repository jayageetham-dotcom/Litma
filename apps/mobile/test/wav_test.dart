import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:litma/core/wav.dart';

// 16-bit mono PCM at 22050 Hz, like Android's TextToSpeech files
final _fmt = Uint8List.fromList([1, 0, 1, 0, 0x22, 0x56, 0, 0, 0x44, 0xAC, 0, 0, 2, 0, 16, 0]);

void main() {
  test('builds and parses a WAV file', () {
    final wav = buildWav(_fmt, [Uint8List.fromList([1, 2, 3, 4])]);
    expect(String.fromCharCodes(wav.sublist(0, 4)), 'RIFF');
    expect(ByteData.sublistView(wav).getUint32(4, Endian.little), wav.length - 8);
    final p = parseWav(wav)!;
    expect(p.fmt, _fmt);
    expect(p.data, [1, 2, 3, 4]);
  });

  test('skips other chunks and odd padding', () {
    final b = BytesBuilder()
      ..add('RIFF'.codeUnits)
      ..add([0, 0, 0, 0])
      ..add('WAVE'.codeUnits)
      ..add('LIST'.codeUnits)
      ..add([3, 0, 0, 0, 9, 9, 9, 0])
      ..add('fmt '.codeUnits)
      ..add([16, 0, 0, 0])
      ..add(_fmt)
      ..add('data'.codeUnits)
      ..add([0xFF, 0xFF, 0xFF, 0xFF]) // size left unset by a streaming writer
      ..add([5, 6]);
    final p = parseWav(b.toBytes())!;
    expect(p.fmt, _fmt);
    expect(p.data, [5, 6]);
  });

  test('rejects what is not a WAV file', () {
    expect(parseWav(Uint8List.fromList('hello world!'.codeUnits)), isNull);
  });

  test('joins parts of the same format in order', () async {
    final dir = await Directory.systemTemp.createTemp('wav');
    try {
      final a = File('${dir.path}/a.wav')..writeAsBytesSync(buildWav(_fmt, [Uint8List.fromList([1, 2])]));
      final b = File('${dir.path}/b.wav')..writeAsBytesSync(buildWav(_fmt, [Uint8List.fromList([3, 4, 5, 6])]));
      final out = '${dir.path}/out.wav';
      expect(await joinWav([a.path, b.path], out), isTrue);
      expect(parseWav(File(out).readAsBytesSync())!.data, [1, 2, 3, 4, 5, 6]);

      final other = Uint8List.fromList(_fmt)..[2] = 2; // stereo
      final c = File('${dir.path}/c.wav')..writeAsBytesSync(buildWav(other, [Uint8List.fromList([7, 8])]));
      expect(await joinWav([a.path, c.path], out), isFalse);
    } finally {
      dir.deleteSync(recursive: true);
    }
  });
}
