import 'dart:io';
import 'dart:typed_data';

/// Joins WAV files made with the same voice into one (read aloud's "Save as an audio file": each
/// part is one piece of the work, since the speech engines take a few thousand characters at most).
/// The parts must share one format; returns false otherwise or when a part can't be read.
Future<bool> joinWav(List<String> parts, String out) async {
  Uint8List? fmt;
  final data = <Uint8List>[];
  for (final p in parts) {
    final w = parseWav(await File(p).readAsBytes());
    if (w == null) return false;
    if (fmt == null) {
      fmt = w.fmt;
    } else if (!_same(fmt, w.fmt)) {
      return false;
    }
    data.add(w.data);
  }
  if (fmt == null) return false;
  await File(out).writeAsBytes(buildWav(fmt, data), flush: true);
  return true;
}

/// The `fmt ` chunk body and the sound data of a RIFF/WAVE file, or null when it isn't one.
({Uint8List fmt, Uint8List data})? parseWav(Uint8List bytes) {
  if (bytes.length < 12 || _id(bytes, 0) != 'RIFF' || _id(bytes, 8) != 'WAVE') return null;
  final view = ByteData.sublistView(bytes);
  Uint8List? fmt;
  Uint8List? data;
  var at = 12;
  while (at + 8 <= bytes.length) {
    final id = _id(bytes, at);
    var size = view.getUint32(at + 4, Endian.little);
    final start = at + 8;
    // streaming writers leave the size unset; take what is there
    if (size > bytes.length - start) size = bytes.length - start;
    final body = Uint8List.sublistView(bytes, start, start + size);
    if (id == 'fmt ' && fmt == null) fmt = body;
    if (id == 'data' && data == null) data = body;
    at = start + size + (size.isOdd ? 1 : 0);
  }
  if (fmt == null || data == null) return null;
  return (fmt: fmt, data: data);
}

/// A WAV file from a `fmt ` chunk body and sound data.
Uint8List buildWav(Uint8List fmt, List<Uint8List> data) {
  final dataLen = data.fold<int>(0, (n, d) => n + d.length);
  final fmtPad = fmt.length.isOdd ? 1 : 0;
  final dataPad = dataLen.isOdd ? 1 : 0;
  final total = 12 + 8 + fmt.length + fmtPad + 8 + dataLen + dataPad;
  final b = BytesBuilder(copy: false);
  void id(String s) => b.add(s.codeUnits);
  void u32(int v) => b.add((ByteData(4)..setUint32(0, v, Endian.little)).buffer.asUint8List());
  id('RIFF');
  u32(total - 8);
  id('WAVE');
  id('fmt ');
  u32(fmt.length);
  b.add(fmt);
  if (fmtPad == 1) b.addByte(0);
  id('data');
  u32(dataLen);
  for (final d in data) {
    b.add(d);
  }
  if (dataPad == 1) b.addByte(0);
  return b.toBytes();
}

String _id(Uint8List b, int at) => String.fromCharCodes(b.sublist(at, at + 4));

bool _same(Uint8List a, Uint8List b) {
  if (a.length != b.length) return false;
  for (var i = 0; i < a.length; i++) {
    if (a[i] != b[i]) return false;
  }
  return true;
}
