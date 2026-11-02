// നാട്ടറിവ്: Malayalam words for the natural and everyday world, grouped by category, with
// English meanings. Shown in the Dictionary (each word opens its full entry). Plain data, no
// dependencies, so the mobile app can port it as is. Words are in a familiar-first order,
// not alphabetical; every word is a headword in the Olam data (checked when the list changes).

export type NattarivuTint = "violet" | "coral" | "sky" | "lime" | "tangerine";
export type NattarivuWord = { ml: string; en: string };
export type NattarivuCategory = { id: string; ml: string; en: string; tint: NattarivuTint; words: NattarivuWord[] };

/** "മലയാളം | English" per line */
const list = (s: string): NattarivuWord[] =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [ml, en] = l.split("|").map((x) => x.trim());
      return { ml, en };
    });

export const NATTARIVU: NattarivuCategory[] = [
  {
    id: "flowers",
    ml: "പൂക്കൾ",
    en: "Flowers",
    tint: "coral",
    words: list(`
      താമര | lotus
      ആമ്പൽ | water lily
      മുല്ല | jasmine
      പിച്ചകം | Spanish jasmine
      ചെമ്പരത്തി | hibiscus
      തെച്ചി | ixora, jungle geranium
      തുമ്പ | thumba, leucas
      കണിക്കൊന്ന | Indian laburnum, golden shower
      ചെണ്ടുമല്ലിക | marigold
      ജമന്തി | chrysanthemum
      പനിനീർപ്പൂ | rose
      അരളി | oleander
      ചെമ്പകം | champak
      പവിഴമല്ലി | night-flowering jasmine
      നന്ത്യാർവട്ടം | crape jasmine
      മന്ദാരം | orchid tree, bauhinia
      ശംഖുപുഷ്പം | butterfly pea
      നീലക്കുറിഞ്ഞി | neelakurinji
      എരിക്ക് | crown flower
      സൂര്യകാന്തി | sunflower
      നിശാഗന്ധി | queen of the night
    `),
  },
  {
    id: "trees",
    ml: "മരങ്ങൾ",
    en: "Trees",
    tint: "lime",
    words: list(`
      തെങ്ങ് | coconut palm
      കവുങ്ങ് | areca palm
      പ്ലാവ് | jackfruit tree
      മാവ് | mango tree
      ആഞ്ഞിലി | wild jack, anjili
      തേക്ക് | teak
      ഈട്ടി | rosewood
      പേരാൽ | banyan tree
      അരയാൽ | sacred fig, peepal
      ആര്യവേപ്പ് | neem
      പുളി | tamarind tree
      കുടമ്പുളി | Malabar tamarind
      ഇലഞ്ഞി | Spanish cherry
      വാക | gulmohar, flame tree
      പന | palmyra palm
      മുള | bamboo
      കശുമാവ് | cashew tree
      പുന്ന | Alexandrian laurel
      ചന്ദനം | sandalwood
      അത്തി | cluster fig
      കൂവളം | bael tree
      ഞാവൽ | jamun tree
      മഹാഗണി | mahogany
    `),
  },
  {
    id: "plants",
    ml: "സസ്യങ്ങൾ",
    en: "Plants",
    tint: "lime",
    words: list(`
      വാഴ | banana plant
      ചേന | elephant foot yam
      ചേമ്പ് | taro
      മരച്ചീനി | tapioca, cassava
      കുരുമുളക് | black pepper vine
      വെറ്റില | betel leaf
      പുല്ല് | grass
      കറുക | Bermuda grass
      ഞാറ് | paddy seedling
      പന്നൽ | fern
      പായൽ | moss, algae
      തൊട്ടാവാടി | touch-me-not, mimosa
      കൈത | screwpine
      ചീര | amaranth greens
      വള്ളി | creeper, vine
      കൂൺ | mushroom
    `),
  },
  {
    id: "fruits",
    ml: "പഴങ്ങൾ",
    en: "Fruits",
    tint: "tangerine",
    words: list(`
      മാമ്പഴം | mango
      ചക്ക | jackfruit
      പഴം | banana
      നേന്ത്രപ്പഴം | nendran banana, plantain
      പേരയ്ക്ക | guava
      കപ്പളങ്ങ | papaya
      കൈതച്ചക്ക | pineapple
      നെല്ലിക്ക | Indian gooseberry, amla
      ഞാവൽപ്പഴം | jamun, Java plum
      ചാമ്പക്ക | rose apple, water apple
      ആത്തച്ചക്ക | custard apple
      മാതളനാരങ്ങ | pomegranate
      നാരങ്ങ | lemon, lime
      മധുരനാരങ്ങ | orange
      മുന്തിരി | grapes
      ഇലന്തപ്പഴം | Indian jujube
      തണ്ണിമത്തൻ | watermelon
      കശുമാങ്ങ | cashew apple
      അമ്പഴങ്ങ | hog plum
      ഈന്തപ്പഴം | date
    `),
  },
  {
    id: "vegetables",
    ml: "പച്ചക്കറികൾ",
    en: "Vegetables",
    tint: "lime",
    words: list(`
      വെണ്ടയ്ക്ക | okra, lady's finger
      വഴുതനങ്ങ | brinjal, eggplant
      പാവയ്ക്ക | bitter gourd
      പടവലങ്ങ | snake gourd
      മത്തങ്ങ | pumpkin
      കുമ്പളങ്ങ | ash gourd
      വെള്ളരിക്ക | cucumber
      ചുരയ്ക്ക | bottle gourd
      പീച്ചിങ്ങ | ridge gourd
      കോവയ്ക്ക | ivy gourd
      പയർ | cowpea, long beans
      മുരിങ്ങക്കായ് | drumstick
      മുരിങ്ങയില | drumstick leaves
      കാച്ചിൽ | greater yam
      കൂർക്ക | Chinese potato
      ഉരുളക്കിഴങ്ങ് | potato
      ഉള്ളി | onion
      ചുവന്നുള്ളി | shallot
      വെളുത്തുള്ളി | garlic
      തക്കാളി | tomato
    `),
  },
  {
    id: "spices",
    ml: "സുഗന്ധവ്യഞ്ജനങ്ങൾ",
    en: "Spices",
    tint: "tangerine",
    words: list(`
      കുരുമുളക് | black pepper
      ഏലം | cardamom
      ഗ്രാമ്പൂ | clove
      കറുവാപ്പട്ട | cinnamon
      ജാതിക്ക | nutmeg
      ജാതിപത്രി | mace
      ഇഞ്ചി | ginger
      ചുക്ക് | dry ginger
      മഞ്ഞൾ | turmeric
      മല്ലി | coriander
      ജീരകം | cumin
      പെരുംജീരകം | fennel
      ഉലുവ | fenugreek
      കടുക് | mustard
      കായം | asafoetida
      വറ്റൽമുളക് | dried red chilli
      കറിവേപ്പില | curry leaves
      തക്കോലം | star anise
      എള്ള് | sesame
    `),
  },
  {
    id: "herbs",
    ml: "ഔഷധസസ്യങ്ങൾ",
    en: "Herbs and medicinal plants",
    tint: "lime",
    words: list(`
      തുളസി | holy basil
      കറ്റാർവാഴ | aloe vera
      ആടലോടകം | Malabar nut, adhatoda
      കീഴാർനെല്ലി | stonebreaker, phyllanthus
      മുക്കുറ്റി | little tree plant, biophytum
      കുറുന്തോട്ടി | country mallow, sida
      ബ്രഹ്മി | brahmi, water hyssop
      കയ്യോന്നി | false daisy, bhringraj
      ചിറ്റമൃത് | heart-leaved moonseed, giloy
      ശതാവരി | shatavari, wild asparagus
      അമുക്കുരം | ashwagandha, Indian ginseng
      പനിക്കൂർക്ക | Indian borage
      കുടങ്ങൽ | Indian pennywort, gotu kola
      നറുനീണ്ടി | Indian sarsaparilla
      ചെറൂള | mountain knotgrass
      തിപ്പലി | long pepper
      രാമച്ചം | vetiver
      ഇരട്ടിമധുരം | liquorice
    `),
  },
  {
    id: "birds",
    ml: "പക്ഷികൾ",
    en: "Birds",
    tint: "sky",
    words: list(`
      കാക്ക | crow
      മയിൽ | peacock
      തത്ത | parrot
      കുയിൽ | koel, cuckoo
      മൈന | myna
      പ്രാവ് | pigeon, dove
      കൊക്ക് | egret, heron
      മരംകൊത്തി | woodpecker
      പൊന്മാൻ | kingfisher
      മൂങ്ങ | owl
      പരുന്ത് | kite
      കഴുകൻ | vulture
      ചെമ്പോത്ത് | crow pheasant, coucal
      കുരുവി | sparrow
      ഓലേഞ്ഞാലി | rufous treepie
      ഇരട്ടത്തലച്ചി | red-whiskered bulbul
      വേഴാമ്പൽ | great hornbill
      കുളക്കോഴി | waterhen
      നീർക്കാക്ക | cormorant
      പനങ്കാക്ക | Indian roller
      കാട | quail
      താറാവ് | duck
      കോഴി | hen, chicken
      അരയന്നം | swan
    `),
  },
  {
    id: "animals",
    ml: "മൃഗങ്ങൾ",
    en: "Animals",
    tint: "tangerine",
    words: list(`
      ആന | elephant
      കടുവ | tiger
      പുലി | leopard
      സിംഹം | lion
      കരടി | bear
      മാൻ | deer
      കുരങ്ങ് | monkey
      വരയാട് | Nilgiri tahr
      കാട്ടുപോത്ത് | gaur, Indian bison
      കാട്ടുപന്നി | wild boar
      കുറുക്കൻ | jackal
      ചെന്നായ് | wolf
      മുയൽ | rabbit, hare
      അണ്ണാൻ | squirrel
      കീരി | mongoose
      മുള്ളൻപന്നി | porcupine
      വവ്വാൽ | bat
      എലി | rat, mouse
      പശു | cow
      കാള | bull, ox
      എരുമ | buffalo
      ആട് | goat
      പൂച്ച | cat
      നായ | dog
      കുതിര | horse
      കഴുത | donkey
      ഒട്ടകം | camel
      പാമ്പ് | snake
      ആമ | tortoise, turtle
      മുതല | crocodile
      ഉടുമ്പ് | monitor lizard
    `),
  },
  {
    id: "insects",
    ml: "പ്രാണികൾ",
    en: "Insects and small creatures",
    tint: "violet",
    words: list(`
      ഉറുമ്പ് | ant
      തേനീച്ച | honeybee
      പൂമ്പാറ്റ | butterfly
      ചിത്രശലഭം | butterfly
      തുമ്പി | dragonfly
      മിന്നാമിനുങ്ങ് | firefly
      കൊതുക് | mosquito
      ഈച്ച | fly
      പാറ്റ | cockroach
      ചീവീട് | cicada, cricket
      പുൽച്ചാടി | grasshopper
      ചിതൽ | termite
      വണ്ട് | beetle
      കടന്നൽ | wasp
      മൂട്ട | bedbug
      പേൻ | louse
      ചെള്ള് | weevil, small pest
      പുഴു | worm, caterpillar
      മണ്ണിര | earthworm
      ചിലന്തി | spider
      തേൾ | scorpion
      പഴുതാര | centipede
      തേരട്ട | millipede
      ഒച്ച് | snail
    `),
  },
  {
    id: "fish",
    ml: "മീനുകൾ",
    en: "Fish and seafood",
    tint: "sky",
    words: list(`
      മത്തി | sardine
      നെയ്മീൻ | seer fish, kingfish
      കരിമീൻ | pearl spot
      നെത്തോലി | anchovy
      വരാൽ | snakehead, murrel
      സ്രാവ് | shark
      തിരണ്ടി | stingray
      ചെമ്മീൻ | prawn, shrimp
      കൊഞ്ച് | prawn, lobster
      ഞണ്ട് | crab
      കക്ക | clam
      കല്ലുമ്മക്കായ | mussel
      കണവ | squid
    `),
  },
  {
    id: "seasons",
    ml: "ഋതുക്കൾ",
    en: "Seasons",
    tint: "violet",
    words: list(`
      വസന്തം | spring
      ഗ്രീഷ്മം | summer
      വർഷം | rainy season
      ശരത്ത് | autumn
      ഹേമന്തം | early winter
      ശിശിരം | late winter
      വേനൽ | hot dry season, summer
      മഴക്കാലം | rainy season, monsoon
      മഞ്ഞുകാലം | cold misty season, winter
    `),
  },
  {
    id: "months",
    ml: "മലയാള മാസങ്ങൾ",
    en: "Malayalam months",
    tint: "violet",
    words: list(`
      ചിങ്ങം | Chingam (mid-August to mid-September)
      കന്നി | Kanni (mid-September to mid-October)
      തുലാം | Thulam (mid-October to mid-November)
      വൃശ്ചികം | Vrischikam (mid-November to mid-December)
      ധനു | Dhanu (mid-December to mid-January)
      മകരം | Makaram (mid-January to mid-February)
      കുംഭം | Kumbham (mid-February to mid-March)
      മീനം | Meenam (mid-March to mid-April)
      മേടം | Medam (mid-April to mid-May)
      ഇടവം | Edavam (mid-May to mid-June)
      മിഥുനം | Mithunam (mid-June to mid-July)
      കർക്കടകം | Karkidakam (mid-July to mid-August)
    `),
  },
  {
    id: "weather",
    ml: "കാലാവസ്ഥ",
    en: "Weather",
    tint: "sky",
    words: list(`
      മഴ | rain
      ചാറ്റൽമഴ | drizzle
      പെരുമഴ | downpour
      കാലവർഷം | southwest monsoon
      തുലാവർഷം | northeast monsoon
      ഇടവപ്പാതി | June monsoon rains
      വെയിൽ | sunshine
      ഇളവെയിൽ | mild sunshine
      മേഘം | cloud
      കാർമേഘം | dark rain cloud
      ഇടി | thunder
      മിന്നൽ | lightning
      കാറ്റ് | wind
      ഇളംകാറ്റ് | breeze
      കൊടുങ്കാറ്റ് | storm
      ചുഴലിക്കാറ്റ് | cyclone
      മഞ്ഞ് | mist, dew, snow
      മൂടൽമഞ്ഞ് | fog
      മഴവില്ല് | rainbow
      ആലിപ്പഴം | hailstone
      ചൂട് | heat
      തണുപ്പ് | cold
      ഈർപ്പം | humidity, damp
      വരൾച്ച | drought
      വെള്ളപ്പൊക്കം | flood
    `),
  },
  {
    id: "water",
    ml: "നദികളും ജലാശയങ്ങളും",
    en: "Rivers and water bodies",
    tint: "sky",
    words: list(`
      പുഴ | river
      നദി | river
      ആറ് | river, stream
      അരുവി | brook, stream
      തോട് | canal, stream
      കായൽ | backwater, lagoon
      കടൽ | sea
      സമുദ്രം | ocean
      തടാകം | lake
      കുളം | pond
      ചിറ | embankment, tank
      കിണർ | well
      ഉറവ | spring
      വെള്ളച്ചാട്ടം | waterfall
      അഴിമുഖം | estuary, river mouth
      കടവ് | ferry landing, bathing ghat
      തീരം | shore, bank
      ചതുപ്പ് | marsh, swamp
      ഓളം | ripple, wave
      തിര | wave
    `),
  },
  {
    id: "mountains",
    ml: "മലകളും പർവതങ്ങളും",
    en: "Hills and mountains",
    tint: "lime",
    words: list(`
      മല | hill, mountain
      കുന്ന് | hillock
      പർവതം | mountain
      കൊടുമുടി | peak, summit
      മലഞ്ചെരിവ് | hillside, slope
      താഴ്വര | valley
      ചുരം | mountain pass, ghat road
      മേട് | upland, high meadow
      പീഠഭൂമി | plateau
      പാറ | rock
      ഗുഹ | cave
      കാട് | forest, jungle
      വനം | forest
      ചോല | shady grove, forest stream
      അഗ്നിപർവതം | volcano
      മലനാട് | highlands
      ഇടനാട് | midlands
      തീരപ്രദേശം | coastal region
    `),
  },
  {
    id: "farming",
    ml: "കൃഷി",
    en: "Farming",
    tint: "tangerine",
    words: list(`
      കൃഷി | farming, cultivation
      കർഷകൻ | farmer
      വയൽ | paddy field
      പാടം | field
      നെല്ല് | paddy
      അരി | rice
      വിത്ത് | seed
      ഞാറ്റുവേല | planting season
      കൊയ്ത്ത് | harvest
      മെതി | threshing
      കറ്റ | sheaf
      കലപ്പ | plough
      തൂമ്പ | spade, hoe
      അരിവാൾ | sickle
      വളം | manure, fertiliser
      ചാണകം | cow dung
      വരമ്പ് | field bund
      കള | weed
      ജലസേചനം | irrigation
      പത്തായം | granary
      പറ | para, grain measure
      പറമ്പ് | homestead land
      തോട്ടം | garden, plantation
      വിള | crop
      വിളവ് | yield, harvest
    `),
  },
  {
    id: "household",
    ml: "നാടൻ ഉപകരണങ്ങൾ",
    en: "Traditional tools and utensils",
    tint: "coral",
    words: list(`
      ഉരൽ | mortar
      ഉലക്ക | pestle
      അമ്മിക്കല്ല് | grinding stone
      ആട്ടുകല്ല് | wet grinding stone
      മുറം | winnowing tray
      ചിരവ | coconut scraper
      ഉറി | hanging rope sling
      കിണ്ടി | spouted water vessel
      ഉരുളി | wide bell-metal vessel
      ചട്ടി | clay pan
      കലം | pot
      തവി | ladle
      ചൂല് | broom
      പായ | mat
      നിലവിളക്ക് | standing oil lamp
      തൊട്ടി | bucket, trough
      കയർ | coir rope
      ഏണി | ladder
      വെട്ടുകത്തി | billhook, machete
      കോടാലി | axe
      വല | net
      തോണി | canoe
      വള്ളം | country boat
    `),
  },
  {
    id: "kinship",
    ml: "ബന്ധുക്കൾ",
    en: "Family and kinship",
    tint: "coral",
    words: list(`
      അച്ഛൻ | father
      അമ്മ | mother
      ചേട്ടൻ | elder brother
      അനിയൻ | younger brother
      ചേച്ചി | elder sister
      അനിയത്തി | younger sister
      മുത്തച്ഛൻ | grandfather
      മുത്തശ്ശി | grandmother
      അമ്മാവൻ | maternal uncle
      അമ്മായി | aunt
      വലിയച്ഛൻ | father's elder brother
      ചെറിയച്ഛൻ | father's younger brother
      മകൻ | son
      മകൾ | daughter
      മരുമകൻ | son-in-law, nephew
      മരുമകൾ | daughter-in-law, niece
      ഭർത്താവ് | husband
      ഭാര്യ | wife
      അളിയൻ | brother-in-law
      നാത്തൂൻ | sister-in-law
      പേരക്കുട്ടി | grandchild
    `),
  },
];

export const nattarivuCategory = (id: string | null | undefined) => NATTARIVU.find((c) => c.id === id);
