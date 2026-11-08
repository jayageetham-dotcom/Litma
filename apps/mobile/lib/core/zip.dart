import 'dart:convert';
import 'dart:typed_data';

/// A small zip writer (stored, no compression), a port of the web's lib/zip.ts: enough for a backup
/// of text files without another package.
final _table = () {
  final t = Uint32List(256);
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) {
      c = (c & 1) != 0 ? 0xedb88320 ^ (c >> 1) : c >> 1;
    }
    t[n] = c;
  }
  return t;
}();

int _crc32(List<int> b) {
  var c = 0xffffffff;
  for (final x in b) {
    c = _table[(c ^ x) & 0xff] ^ (c >> 8);
  }
  return (c ^ 0xffffffff) & 0xffffffff;
}

Uint8List zip(List<(String name, List<int> data)> files, [DateTime? when]) {
  final w = when ?? DateTime.now();
  final time = ((w.hour << 11) | (w.minute << 5) | (w.second >> 1)) & 0xffff;
  final date = (((w.year - 1980) << 9) | (w.month << 5) | w.day) & 0xffff;
  final out = BytesBuilder(copy: false);
  final central = BytesBuilder(copy: false);
  var offset = 0;
  for (final (name, data) in files) {
    final n = utf8.encode(name);
    final crc = _crc32(data);
    final local = ByteData(30)
      ..setUint32(0, 0x04034b50, Endian.little)
      ..setUint16(4, 20, Endian.little)
      ..setUint16(6, 0x0800, Endian.little) // names in UTF-8
      ..setUint16(8, 0, Endian.little)
      ..setUint16(10, time, Endian.little)
      ..setUint16(12, date, Endian.little)
      ..setUint32(14, crc, Endian.little)
      ..setUint32(18, data.length, Endian.little)
      ..setUint32(22, data.length, Endian.little)
      ..setUint16(26, n.length, Endian.little)
      ..setUint16(28, 0, Endian.little);
    out
      ..add(local.buffer.asUint8List())
      ..add(n)
      ..add(data);
    final c = ByteData(46)
      ..setUint32(0, 0x02014b50, Endian.little)
      ..setUint16(4, 20, Endian.little)
      ..setUint16(6, 20, Endian.little)
      ..setUint16(8, 0x0800, Endian.little)
      ..setUint16(10, 0, Endian.little)
      ..setUint16(12, time, Endian.little)
      ..setUint16(14, date, Endian.little)
      ..setUint32(16, crc, Endian.little)
      ..setUint32(20, data.length, Endian.little)
      ..setUint32(24, data.length, Endian.little)
      ..setUint16(28, n.length, Endian.little)
      ..setUint32(42, offset, Endian.little);
    central
      ..add(c.buffer.asUint8List())
      ..add(n);
    offset += 30 + n.length + data.length;
  }
  final size = central.length;
  out.add(central.takeBytes());
  final end = ByteData(22)
    ..setUint32(0, 0x06054b50, Endian.little)
    ..setUint16(8, files.length, Endian.little)
    ..setUint16(10, files.length, Endian.little)
    ..setUint32(12, size, Endian.little)
    ..setUint32(16, offset, Endian.little);
  out.add(end.buffer.asUint8List());
  return out.takeBytes();
}
