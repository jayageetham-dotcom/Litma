# Clean word list for the engine: Malayalam only, well-formed, most used first.
import re, sys
N=int(sys.argv[1])
C='ക-ഹ'; SIGN='ാ-ൌൗൢൣ'; V='്'
ok=re.compile(r'^[ഀ-ൿ‌‍]+$')
bad=[re.compile(x) for x in [
  r'^['+SIGN+V+'ംഃ]',            # starts with a sign, virama, ം or ഃ
  r'[^'+C+'഼]['+SIGN+V+']',          # sign or virama not after a consonant
  r'['+SIGN+']['+SIGN+V+']',              # two signs in a row (ു് etc.)
  r'്്', r'[‌‍]{2}', r'(.)\1\1',
  r'\u0D03', r'(?<=.)[\u0D05-\u0D14]', r'^(['+C+r'])\u0D4D\1', r'^.$',                                  # single letters
]]
out=0
with open('/home/claude/data/words.tsv','w',encoding='utf8') as o:
  for l in open('/home/claude/data/ml.vocabfreq.tsv',encoding='utf8'):
    w,_,f=l.rstrip('\n').partition('\t')
    if not ok.match(w) or any(b.search(w) for b in bad): continue
    # old chillu (consonant + virama + ZWJ) -> atomic chillu; vowel sign au -> au length mark (modern)
    for a,b in (('\u0D23\u0D4D\u200D','\u0D7A'),('\u0D28\u0D4D\u200D','\u0D7B'),('\u0D30\u0D4D\u200D','\u0D7C'),('\u0D32\u0D4D\u200D','\u0D7D'),('\u0D33\u0D4D\u200D','\u0D7E'),('\u0D15\u0D4D\u200D','\u0D7F')): w=w.replace(a,b)
    w=w.replace('\u0D4C','\u0D57').replace('\u200d','').replace('\u200c','')
    o.write(f'{w}\t{f}\n'); out+=1
    if out>=N: break
print(out)
