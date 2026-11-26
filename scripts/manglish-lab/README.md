# Manglish lab (prototype, not shipped)

Ranked offline Manglish suggestions: a loose sound skeleton (`skeleton.ts`) indexes a
Malayalam word list by consonant outline; `rank.ts` scores candidates by skeleton distance,
closeness to the plain rule reading (`manglishWord`) and word frequency. Unknown or invented
words keep the plain reading first; capitals/`~`/`_`, COMMON words, fragments and
non-letters keep today's behaviour.

Data (not committed, download into /home/claude/data):
- Word frequencies, CC BY 4.0: https://huggingface.co/datasets/kavyamanohar/Malayalam-word-freq (`ml.vocabfreq.tsv`) → `python3 wordlist.py 400000` → `words.tsv`
- Dakshina Malayalam lexicons, CC BY-SA 4.0 (tests): https://huggingface.co/datasets/vrclc/dakshina-lexicons-ml
- Aksharantar `mal.zip`, CC-BY / CC0 (tests): https://huggingface.co/datasets/ai4bharat/Aksharantar

Results (24 Nov 2026, 150k words, ~1 MB gzip): Dakshina test first 72.0% / top-6 86.1%
(today's engine 17.8% / 27.1%); Aksharantar test 52.7% / 64.2% (today 14.1% / 21.7%).
Run: `node --experimental-strip-types --max-old-space-size=8000 ev.mjs 150000 <test files>`.
