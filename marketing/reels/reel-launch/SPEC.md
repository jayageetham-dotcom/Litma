# Reel 3: launch ad (30 s, Malayalam voiceover)

GOAL:    a 30 s product ad in the style of a mobile-app launch film (owner's reference: Sleeko Studio,
         "Best Mobile App Product Launch Ad Video | HowDo"): the real app in dark mode inside a phone,
         on a soft colour-field backdrop, writer questions floating around it, a female Malayalam voice.
OUTPUT:  HyperFrames, 1080 x 1920, 30 fps, H.264 + AAC, Instagram Reel.
OWNER'S CHOICES (Nov 2026, override reels.md for this reel): app screens in dark mode, shown inside a
         plain phone frame (not full screen); a monitor for the desktop beat; no subtitles of the voice.
VOICE:   TTSForFree "Sobhana (Natural)" ml-IN female (Gemini voices cost 8 credits a character and did not
         fit the free daily quota). Raw file assets/vo-raw.mp3, loudness-normalised to vo-norm.wav,
         cut into vo1..vo8.wav at the pauses (ffmpeg silencedetect), each placed on its beat.
SCRIPT:  vo1 0.3   മലയാളത്തിൽ എഴുതാൻ കീബോർഡ് മാറ്റണോ?
         vo2 3.1   വേണ്ട. ഇതാ ലിറ്റ്മ.
         vo3 5.3   ഇംഗ്ലീഷിൽ ടൈപ്പ് ചെയ്യൂ, മലയാളം തനിയെ വരും.
         vo4 10.6  നോവൽ മുതൽ തിരക്കഥ വരെ.
         vo5 13.7  വാക്കും പ്രാസവും അരികെ.
         vo6 17.7  കഥാപാത്രങ്ങൾ കഥാലോകത്തിൽ.
         vo7 20.8  ഒടുവിൽ, സ്വന്തം പുസ്തകം.
         vo8 27.0  ലിറ്റ്മ. സൗജന്യമായി എഴുതിത്തുടങ്ങൂ.
FOOTAGE: capture/rec-launch.cjs (dark mode, 390 x 798 CSS px at 3x = 1170 x 2394): write, picker, dict,
         world, cover; desktop (1440 x 900 at 4/3 = 1920 x 1200).
SHOTS:   0.0-3.0   hook: phone at 0.52 in the middle, four writer questions in glass bubbles, glass icons
         3.0-5.0   reveal: bubbles fly out, icon + ലിറ്റ്മ. lockup above the phone
         5.0-10.5  Manglish typed and turning into Malayalam (write.mp4 at 2.33x), punch-in 5.6-8.6
         10.5-13.5 writing-type picker (1.8x)
         13.5-17.5 dictionary: നിലാവ് looked up (2.4x), then its rhymes
         17.5-20.5 Story World: ആയിഷ added beside ജോസഫ്, മീനാക്ഷി (2.13x)
         20.5-26.8 book cover presets on നിലാവുള്ള രാത്രി by രസിയ; 24.3 the phone steps aside, monitor
                   shows the desktop editor
         26.8-30.0 end card: icon + wordmark, എഴുതൂ, / മലയാളത്തിൽ. (lime marker, coral dot), getlitma.in,
                   "Free to use · Web, Mac, Windows, Linux"
FAIRNESS: names ആയിഷ, ജോസഫ്, മീനാക്ഷി, രസിയ side by side; no community labels.
MUSIC:   none yet (HeyGen catalog needs `npx hyperframes auth login`); add a quiet track in Instagram's
         music picker at low volume under the voice.
