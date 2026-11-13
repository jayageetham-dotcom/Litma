# Third-party notices

Litma includes or is built from the work below. Thank you to everyone who made it. The same credits,
in plain words for writers, are in the help site: getlitma.in/help/?a=credits
(`apps/web/content/help/11-account.md#credits`).

## mlmorph (Malayalam spelling engine)

`packages/shared/src/mlmorph.ts` (synced to `supabase/functions/_shared/mlmorph.ts`) is a TypeScript
port of parts of mlmorph 1.4.3, the Malayalam morphology analyser and spellchecker by Santhosh
Thottingal and contributors at Swathanthra Malayalam Computing: the transducer lookup, analysis
weights, normaliser, foreign-word patterns and suggestion strategies. The `litma-spell` Edge Function
also ships mlmorph's compiled transducer (`malayalam.a`, re-laid out by `scripts/build-mlmorph.mjs`)
and its list of common misspellings, both taken unchanged in content from the pinned PyPI wheel at
deploy time.

- Source: https://gitlab.com/smc/mlmorph · https://pypi.org/project/mlmorph/
- Paper: Santhosh Thottingal, "Finite State Transducer based Morphology analysis for Malayalam
  Language", Proceedings of the 2nd Workshop on Technologies for MT of Low Resource Languages, 2019.
- The list of common misspellings was compiled from Malayalam Wikipedia
  (https://ml.wikipedia.org/wiki/വിക്കിപീഡിയ:അക്ഷരത്തെറ്റോടുകൂടി_സാധാരണ_ഉപയോഗിക്കാറുള്ള_പദങ്ങൾ)
  and the Government of Kerala's glossary (https://glossary.kerala.gov.in).

```
"mlmorph" copyright (c) 2018 Santhosh Thottingal <santhosh.thottingal@gmail.com> and
contributors.

The MIT License

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the "Software"),
to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR
OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
```

## Olam datasets (dictionary, thesaurus, rhymes, spelling word lists)

Downloaded by `scripts/build-dictionary.mjs` at build time (not stored in this repository) and served
from `/dict/`. https://olam.in/p/open

- Datuk Malayalam–Malayalam dictionary: Open Database License (ODbL) 1.0
- Olam English–Malayalam dictionary (EnMl): Open Database License (ODbL) 1.0
- E. K. Kurup's Malayalam thesaurus: Creative Commons Attribution-ShareAlike 4.0

Opposites are looked up from Datamuse (https://www.datamuse.com/api/).

## Fonts

- Karumbi, Dyuthi, Uroob, Meera, Rachana (bundled in `apps/web/public/fonts/smc/`, and in the phone
  app): Swathanthra Malayalam Computing, SIL Open Font License 1.1 (see each `*-LICENSE.txt` there).
- Manjari, Gayathri, Chilanka (SMC), Noto Serif/Sans Malayalam (Google), Anek Malayalam and Baloo
  Chettan 2 (Ek Type), Inter, Manrope: loaded from Google Fonts on the website and desktop app,
  bundled in the phone app (`apps/mobile/assets/fonts/`), SIL Open Font License 1.1.

## Platform marks

`apps/web/public/brands/*.svg`: original files from the open `logos` collection (CC0); see the
README there. The marks themselves belong to their owners.

## Software

Open-source packages (Next.js, React, Tiptap, Tailwind CSS, Electron, Flutter packages, Supabase
clients, Lucide icons and others) keep their own licences, listed in each package
(`node_modules/*/LICENSE`, `apps/mobile/pubspec.lock` and the Flutter licence page in the phone app).
