import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../core/theme.dart';
import '../data/models.dart';

/// Avatar pictures in the web's order (apps/web/public/avatars/avatars.json), shown as equals.
const avatarImages = ['f-1', 'm-1', 'f-2', 'm-2', 'f-3', 'm-3', 'f-4', 'm-4', 'f-5', 'm-5', 'm-6', 'm-7'];

/// Pictures drawn in vectors (kept as SVG); the others are PNG.
const _svgAvatars = {'m-6'};

const avatarTints = ['violet', 'coral', 'sky', 'lime', 'tangerine'];

Color tintColor(LitmaTokens c, String tint) => switch (tint) {
      'coral' => c.tintCoral,
      'sky' => c.tintSky,
      'lime' => c.tintLime,
      'tangerine' => c.tintTangerine,
      _ => c.tintViolet,
    };

/// A steady tint per name (the web's tintFor), so a writer who never picks one keeps the same colour.
String tintFor(String name) {
  var h = 0;
  for (final r in name.runes) {
    h = (h * 31 + r) & 0xFFFFFFFF;
  }
  return avatarTints[h % avatarTints.length];
}

/// First written letter: a whole Malayalam akshara (ക്ഷ, not ക), or an uppercase Latin letter.
String firstLetter(String name, [String fallback = 'ല']) {
  final s = name.trim();
  if (s.isEmpty) return fallback;
  final m = RegExp(r'^(?:[ക-ഹ]്)+[ക-ഹ][ാ-ൌൗ]?').firstMatch(s);
  return (m?[0] ?? s.characters.first).toUpperCase();
}

/// One avatar: a picture id from [avatarImages], else the first letter of [name] in [tint].
class AvatarArt extends StatelessWidget {
  const AvatarArt({super.key, this.id, required this.name, this.tint, this.size = 36});
  final String? id;
  final String name;
  final String? tint;
  final double size;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    if (id != null && avatarImages.contains(id)) {
      final path = 'assets/avatars/avatar-$id.${_svgAvatars.contains(id) ? 'svg' : 'png'}';
      return ClipOval(
        child: SizedBox.square(
          dimension: size,
          child: _svgAvatars.contains(id) ? SvgPicture.asset(path, fit: BoxFit.cover) : Image.asset(path, fit: BoxFit.cover, filterQuality: FilterQuality.medium),
        ),
      );
    }
    final col = tintColor(c, tint ?? tintFor(name));
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(shape: BoxShape.circle, color: Color.alphaBlend(col.withValues(alpha: 0.16), c.surface)),
      child: Text(firstLetter(name), style: TextStyle(fontFamily: LitmaFonts.display, fontWeight: FontWeight.w700, fontSize: size * 0.44, color: col, height: 1)),
    );
  }
}

/// The writer's avatar from their profile (the web's profileAvatar): chosen picture, else an
/// earlier uploaded photo, else the first letter.
class ProfileAvatar extends StatelessWidget {
  const ProfileAvatar({super.key, required this.profile, this.fallbackName = '', this.size = 36});
  final Profile? profile;
  final String fallbackName;
  final double size;

  @override
  Widget build(BuildContext context) {
    final p = profile;
    final name = (p?.avatarName.isNotEmpty ?? false) ? p!.avatarName : fallbackName;
    final id = p?.preferences['avatar'] as String?;
    final tint = avatarTints.contains(p?.preferences['avatarTint']) ? p!.preferences['avatarTint'] as String : tintFor(name);
    if (id == null && (p?.avatarUrl?.isNotEmpty ?? false)) {
      return ClipOval(
        child: Image.network(p!.avatarUrl!, width: size, height: size, fit: BoxFit.cover, errorBuilder: (_, _, _) => AvatarArt(name: name, tint: tint, size: size)),
      );
    }
    return AvatarArt(id: id, name: name, tint: tint, size: size);
  }
}
