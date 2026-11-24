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
    w=w.replace('‍','').replace('‌','')
    o.write(f'{w}\t{f}\n'); out+=1
    if out>=N: break
print(out)
