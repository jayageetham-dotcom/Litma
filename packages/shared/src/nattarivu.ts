// നാട്ടറിവ്: Malayalam words for the natural and everyday world, grouped by category, with
// English meanings. Shown in the Dictionary (each word opens its full entry). Plain data, no
// dependencies, so the mobile app can port it as is. Words are in a familiar-first order,
// not alphabetical. Only words with a dictionary entry whose meaning matches (checked when the list
// changes). "# മലയാളം | English" lines start a section.

export type NattarivuTint = "violet" | "coral" | "sky" | "lime" | "tangerine";
/** `group` names the section a word sits in, for categories with sections (കല) */
export type NattarivuWord = { ml: string; en: string; group?: { ml: string; en: string } };
export type NattarivuCategory = { id: string; ml: string; en: string; tint: NattarivuTint; words: NattarivuWord[] };

/** "മലയാളം | English" per line; "# മലയാളം | English" starts a section */
const list = (s: string): NattarivuWord[] => {
  let group: NattarivuWord["group"];
  const out: NattarivuWord[] = [];
  for (const raw of s.split("\n")) {
    const l = raw.trim();
    if (!l) continue;
    const [ml, en] = l.replace(/^#\s*/, "").split("|").map((x) => x.trim());
    if (l.startsWith("#")) group = { ml, en };
    else out.push(group ? { ml, en, group } : { ml, en });
  }
  return out;
};

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
      # വള്ളിയിൽ കായ്ക്കുന്നവ | Gourds and beans
      പാവയ്ക്ക | bitter gourd
      പടവലങ്ങ | snake gourd
      മത്തങ്ങ | pumpkin
      കുമ്പളങ്ങ | ash gourd
      വെള്ളരിക്ക | cucumber
      ചുരയ്ക്ക | bottle gourd
      പീച്ചിങ്ങ | ridge gourd
      കോവയ്ക്ക | ivy gourd
      പയർ | cowpea, long beans
      # കായ്കളും ഇലകളും | Fruiting vegetables and greens
      വെണ്ടയ്ക്ക | okra, lady's finger
      വഴുതനങ്ങ | brinjal, eggplant
      തക്കാളി | tomato
      മുരിങ്ങക്കായ് | drumstick
      മുരിങ്ങയില | drumstick leaves
      # കിഴങ്ങുകൾ | Tubers and bulbs
      കാച്ചിൽ | greater yam
      കൂർക്ക | Chinese potato
      ഉരുളക്കിഴങ്ങ് | potato
      ഉള്ളി | onion
      ചുവന്നുള്ളി | shallot
      വെളുത്തുള്ളി | garlic
    `),
  },
  {
    id: "spices",
    ml: "സുഗന്ധവ്യഞ്ജനങ്ങൾ",
    en: "Spices",
    tint: "tangerine",
    words: list(`
      കുരുമുളക് | black pepper vine
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
    id: "food",
    ml: "ഭക്ഷണം",
    en: "Food",
    tint: "tangerine",
    words: list(`
      # ഊണ് | The meal
      ചോറ് | cooked rice
      കഞ്ഞി | rice gruel, kanji
      സദ്യ | feast on a banana leaf
      പപ്പടം | pappadam
      അച്ചാർ | pickle
      ചമ്മന്തി | chutney
      # കറികൾ | Curries
      അവിയൽ | avial
      തോരൻ | thoran, vegetables stir-fried with coconut
      ഓലൻ | olan
      കാളൻ | kalan
      എരിശ്ശേരി | erissery
      പുളിശ്ശേരി | buttermilk curry
      രസം | rasam
      # പ്രാതൽ | Breakfast
      പുട്ട് | puttu
      അപ്പം | appam
      ഇടിയപ്പം | string hoppers
      ദോശ | dosa
      ഇഡ്ഡലി | idli
      ഉപ്പുമാവ് | upma
      # പലഹാരങ്ങൾ | Snacks and sweets
      അട | ada, steamed rice parcel
      കൊഴുക്കട്ട | rice dumpling
      ഉണ്ണിയപ്പം | unniyappam
      പായസം | payasam
      ഹൽവ | halwa
      # പാലും നെയ്യും | Dairy
      മോര് | buttermilk
      തൈര് | curd
      നെയ്യ് | ghee
      വെണ്ണ | butter
    `),
  },
  {
    id: "birds",
    ml: "പക്ഷികൾ",
    en: "Birds",
    tint: "sky",
    words: list(`
      # പറമ്പിലെ പക്ഷികൾ | Garden and village birds
      കാക്ക | crow
      മയിൽ | peacock
      തത്ത | parrot
      കുയിൽ | koel, cuckoo
      മൈന | myna
      പ്രാവ് | pigeon, dove
      മരംകൊത്തി | woodpecker
      ചെമ്പോത്ത് | crow pheasant, coucal
      കുരുവി | sparrow
      ഓലേഞ്ഞാലി | rufous treepie
      ഇരട്ടത്തലച്ചി | red-whiskered bulbul
      വേഴാമ്പൽ | great hornbill
      പനങ്കാക്ക | Indian roller
      കാട | quail
      # ജലപക്ഷികൾ | Water birds
      കൊക്ക് | egret, heron
      പൊന്മാൻ | kingfisher
      കുളക്കോഴി | waterhen
      നീർക്കാക്ക | cormorant
      അരയന്നം | swan
      # ഇരപിടിയന്മാർ | Birds of prey
      മൂങ്ങ | owl
      പരുന്ത് | kite
      കഴുകൻ | vulture
      # വളർത്തുപക്ഷികൾ | Poultry
      കോഴി | hen, chicken
      താറാവ് | duck
    `),
  },
  {
    id: "animals",
    ml: "മൃഗങ്ങൾ",
    en: "Animals",
    tint: "tangerine",
    words: list(`
      # കാട്ടുമൃഗങ്ങൾ | Wild animals
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
      # ചെറുജീവികൾ | Small animals
      മുയൽ | rabbit, hare
      അണ്ണാൻ | squirrel
      കീരി | mongoose
      മുള്ളൻപന്നി | porcupine
      വവ്വാൽ | bat
      എലി | rat, mouse
      # വളർത്തുമൃഗങ്ങൾ | Domestic animals
      പശു | cow
      കാള | bull, ox
      എരുമ | buffalo
      ആട് | goat
      പൂച്ച | cat
      നായ | dog
      കുതിര | horse
      കഴുത | donkey
      ഒട്ടകം | camel
    `),
  },
  {
    id: "reptiles",
    ml: "ഉരഗങ്ങൾ",
    en: "Reptiles",
    tint: "lime",
    words: list(`
      # പാമ്പുകൾ | Snakes
      പാമ്പ് | snake
      മൂർഖൻ | cobra
      രാജവെമ്പാല | king cobra
      അണലി | Russell's viper
      വെള്ളിക്കെട്ടൻ | common krait
      ചേര | rat snake
      പെരുമ്പാമ്പ് | python
      നീർക്കോലി | checkered keelback, water snake
      പച്ചിലപ്പാമ്പ് | green vine snake
      # പല്ലികളും മറ്റും | Lizards
      ഓന്ത് | garden lizard
      പല്ലി | house lizard, gecko
      അരണ | skink
      ഉടുമ്പ് | monitor lizard
      # ആമയും മുതലയും | Turtles and crocodiles
      ആമ | tortoise, turtle
      കടലാമ | sea turtle
      മുതല | crocodile
      ചീങ്കണ്ണി | mugger crocodile
    `),
  },
  {
    id: "insects",
    ml: "പ്രാണികൾ",
    en: "Insects and small creatures",
    tint: "violet",
    words: list(`
      # പറക്കുന്നവ | Winged insects
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
      വണ്ട് | beetle
      കടന്നൽ | wasp
      # മണ്ണിലും വീട്ടിലും | In the soil and the house
      ഉറുമ്പ് | ant
      ചിതൽ | termite
      മൂട്ട | bedbug
      പേൻ | louse
      ചെള്ള് | weevil, small pest
      പുഴു | worm, caterpillar
      മണ്ണിര | earthworm
      ഒച്ച് | snail
      # എട്ടുകാലികളും മറ്റും | Spiders and many-legged
      ചിലന്തി | spider
      തേൾ | scorpion
      പഴുതാര | centipede
      തേരട്ട | millipede
    `),
  },
  {
    id: "aquatic",
    ml: "ജലജീവികൾ",
    en: "Fish and water creatures",
    tint: "sky",
    words: list(`
      # മീനുകൾ | Fish
      മത്തി | sardine
      നെയ്മീൻ | seer fish, kingfish
      കരിമീൻ | pearl spot
      നെത്തോലി | anchovy
      വരാൽ | snakehead, murrel
      സ്രാവ് | shark
      തിരണ്ടി | stingray
      # ഞണ്ടും കക്കയും | Shellfish
      ചെമ്മീൻ | prawn, shrimp
      കൊഞ്ച് | prawn, lobster
      ഞണ്ട് | crab
      കക്ക | clam
      കല്ലുമ്മക്കായ | mussel
      ചിപ്പി | oyster shell
      മുത്തുച്ചിപ്പി | pearl oyster
      ശംഖ് | conch
      # കടൽജീവികൾ | Sea life
      കണവ | squid
      നീരാളി | octopus
      തിമിംഗലം | whale
      നക്ഷത്രമത്സ്യം | starfish
      കടൽക്കുതിര | seahorse
      പവിഴം | coral
      കടൽപ്പായൽ | seaweed
      # കരയിലും വെള്ളത്തിലും | Frogs and otters
      തവള | frog
      മാക്രി | frog, toad
      നീർനായ | otter
    `),
  },
  {
    id: "time",
    ml: "കാലം",
    en: "Time and the calendar",
    tint: "violet",
    words: list(`
      # നേരങ്ങൾ | Times of day
      പുലരി | dawn
      പ്രഭാതം | morning
      രാവിലെ | in the morning
      നട്ടുച്ച | high noon
      ഉച്ച | noon
      സന്ധ്യ | dusk
      അന്തി | evening twilight
      വൈകുന്നേരം | evening
      രാത്രി | night
      പാതിര | midnight
      യാമം | a watch of the night (three hours)
      # ആഴ്ച | Days of the week
      ഞായറാഴ്ച | Sunday
      തിങ്കളാഴ്ച | Monday
      ചൊവ്വാഴ്ച | Tuesday
      ബുധനാഴ്ച | Wednesday
      വ്യാഴാഴ്ച | Thursday
      വെള്ളിയാഴ്ച | Friday
      ശനിയാഴ്ച | Saturday
      # ഋതുക്കൾ | Seasons
      വസന്തം | spring
      ഗ്രീഷ്മം | summer
      വർഷം | rainy season
      ശരത്ത് | autumn
      ഹേമന്തം | early winter
      ശിശിരം | late winter
      വേനൽ | hot dry season, summer
      മഴക്കാലം | rainy season, monsoon
      മഞ്ഞുകാലം | cold misty season, winter
      # മലയാള മാസങ്ങൾ | Malayalam months
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
      # നാളുകൾ | Birth stars
      അശ്വതി | Aswathi, 1st star
      ഭരണി | Bharani, 2nd star
      കാർത്തിക | Karthika, 3rd star
      രോഹിണി | Rohini, 4th star
      മകയിരം | Makayiram, 5th star
      തിരുവാതിര | Thiruvathira, 6th star
      പുണർതം | Punartham, 7th star
      പൂയം | Pooyam, 8th star
      ആയില്യം | Ayilyam, 9th star
      മകം | Makam, 10th star
      പൂരം | Pooram, 11th star
      ഉത്രം | Uthram, 12th star
      അത്തം | Atham, 13th star
      ചിത്തിര | Chithira, 14th star
      ചോതി | Chothi, 15th star
      വിശാഖം | Vishakham, 16th star
      തൃക്കേട്ട | Thrikketta, 18th star
      മൂലം | Moolam, 19th star
      പൂരാടം | Pooradam, 20th star
      ഉത്രാടം | Uthradam, 21st star
      തിരുവോണം | Thiruvonam, 22nd star
      അവിട്ടം | Avittam, 23rd star
      ചതയം | Chathayam, 24th star
      പൂരുരുട്ടാതി | Pooruruttathi, 25th star
      രേവതി | Revathi, 27th star
    `),
  },
  {
    id: "weather",
    ml: "കാലാവസ്ഥ",
    en: "Weather",
    tint: "sky",
    words: list(`
      # മഴ | Rain
      മഴ | rain
      ചാറ്റൽമഴ | drizzle
      പെരുമഴ | downpour
      കാലവർഷം | southwest monsoon
      തുലാവർഷം | northeast monsoon
      ഇടവപ്പാതി | June monsoon rains
      ഇടി | thunder
      മിന്നൽ | lightning
      ആലിപ്പഴം | hailstone
      വെള്ളപ്പൊക്കം | flood
      # കാറ്റ് | Wind
      കാറ്റ് | wind
      ഇളംകാറ്റ് | breeze
      കൊടുങ്കാറ്റ് | storm
      ചുഴലിക്കാറ്റ് | cyclone
      # വെയിലും മഞ്ഞും | Sun, heat and mist
      വെയിൽ | sunshine
      ഇളവെയിൽ | mild sunshine
      ചൂട് | heat
      വരൾച്ച | drought
      ഈർപ്പം | humidity, damp
      തണുപ്പ് | cold
      മഞ്ഞ് | mist, dew, snow
      മൂടൽമഞ്ഞ് | fog
      # ആകാശം | The sky
      ആകാശം | sky
      മേഘം | cloud
      കാർമേഘം | dark rain cloud
      മഴവില്ല് | rainbow
      സൂര്യൻ | sun
      ചന്ദ്രൻ | moon
      തിങ്കൾ | moon (literary)
      നക്ഷത്രം | star
      നിലാവ് | moonlight
      ഉദയം | sunrise
      അസ്തമയം | sunset
      ചക്രവാളം | horizon
      വെളുത്തവാവ് | full moon
      അമാവാസി | new moon
    `),
  },
  {
    id: "water",
    ml: "നദികളും ജലാശയങ്ങളും",
    en: "Rivers and water bodies",
    tint: "sky",
    words: list(`
      # ഒഴുകുന്ന വെള്ളം | Running water
      പുഴ | river
      നദി | river
      ആറ് | river, stream
      അരുവി | brook, stream
      തോട് | canal, stream
      ഉറവ | spring
      വെള്ളച്ചാട്ടം | waterfall
      # കെട്ടിനിൽക്കുന്ന വെള്ളം | Still water
      കായൽ | backwater, lagoon
      തടാകം | lake
      കുളം | pond
      ചിറ | embankment, tank
      കിണർ | well
      ചതുപ്പ് | marsh, swamp
      # കടലും തീരവും | Sea and shore
      കടൽ | sea
      സമുദ്രം | ocean
      അഴിമുഖം | estuary, river mouth
      കടവ് | ferry landing, bathing ghat
      തീരം | shore, bank
      ഓളം | ripple, wave
      തിര | wave
    `),
  },
  {
    id: "mountains",
    ml: "ഭൂപ്രദേശം",
    en: "Terrain",
    tint: "lime",
    words: list(`
      # മലകൾ | Hills and mountains
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
      അഗ്നിപർവതം | volcano
      # കാട് | Forest
      കാട് | forest, jungle
      വനം | forest
      ചോല | shady grove, forest stream
      # നാട് | Regions of Kerala
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
      # നിലം | Land
      വയൽ | paddy field
      പാടം | field
      വരമ്പ് | field bund
      പറമ്പ് | homestead land
      തോട്ടം | garden, plantation
      # പണി | Work
      കൃഷി | farming, cultivation
      കർഷകൻ | farmer
      വിത്ത് | seed
      ഞാറ്റുവേല | planting season
      ജലസേചനം | irrigation
      വളം | manure, fertiliser
      ചാണകം | cow dung
      കള | weed
      കൊയ്ത്ത് | harvest
      മെതി | threshing
      # ഉപകരണങ്ങൾ | Tools
      കലപ്പ | plough
      തൂമ്പ | spade, hoe
      അരിവാൾ | sickle
      # വിളവ് | The harvest
      നെല്ല് | paddy
      അരി | rice
      കറ്റ | sheaf
      വിള | crop
      വിളവ് | yield, harvest
      പത്തായം | granary
    `),
  },
  {
    id: "household",
    ml: "ഉപകരണങ്ങൾ",
    en: "Tools and utensils",
    tint: "coral",
    words: list(`
      # അടുക്കള | Kitchen
      ഉരൽ | mortar
      ഉലക്ക | pestle
      അമ്മിക്കല്ല് | grinding stone
      ആട്ടുകല്ല് | wet grinding stone
      മുറം | winnowing tray
      ചിരവ | coconut scraper
      ഉറി | hanging rope sling
      ഉരുളി | wide bell-metal vessel
      ചട്ടി | clay pan
      കലം | pot
      തവി | ladle
      കിണ്ടി | spouted water vessel
      # വീട്ടുസാധനങ്ങൾ | Around the house
      ചൂല് | broom
      പായ | mat
      നിലവിളക്ക് | standing oil lamp
      തൊട്ടി | bucket, trough
      കയർ | coir rope
      ഏണി | ladder
      # പണിയായുധങ്ങൾ | Work tools
      വെട്ടുകത്തി | billhook, machete
      കോടാലി | axe
      വല | net
      # യാത്ര | Boats
      തോണി | canoe
      വള്ളം | country boat
    `),
  },
  {
    id: "house",
    ml: "വീട്",
    en: "Parts of a traditional house",
    tint: "coral",
    words: list(`
      # വീടുകൾ | Kinds of house
      നാലുകെട്ട് | four-winged traditional house
      എട്ടുകെട്ട് | eight-winged traditional house
      പത്തായപ്പുര | granary house
      പടിപ്പുര | gatehouse
      # ഇടങ്ങൾ | Rooms and spaces
      ഉമ്മറം | front verandah
      കോലായ | verandah, sit-out
      പൂമുഖം | front hall, entrance
      തിണ്ണ | raised sit-out
      മുറ്റം | courtyard, front yard
      നടുമുറ്റം | central open courtyard
      അകത്തളം | inner hall
      അറ | inner room, storeroom
      അടുക്കള | kitchen
      ചായ്പ്പ് | lean-to, side shed
      തട്ടിൻപുറം | loft
      # നിർമാണം | How it is built
      മേൽക്കൂര | roof
      ഓട് | roof tile
      ഓല | palm-leaf thatch
      ഉത്തരം | roof beam
      കഴുക്കോൽ | rafter
      മച്ച് | wooden ceiling, attic
      തൂൺ | pillar
      ചുമർ | wall
      വാതിൽ | door
      ജനൽ | window
      പടി | step, threshold
      കോണി | staircase, ladder
      നിലം | floor
    `),
  },
  {
    id: "clothes",
    ml: "വസ്ത്രങ്ങളും ആഭരണങ്ങളും",
    en: "Clothes and ornaments",
    tint: "coral",
    words: list(`
      # വസ്ത്രങ്ങൾ | Clothes
      മുണ്ട് | mundu, dhoti
      നേര്യത് | neriyathu, upper cloth
      കസവ് | kasavu, gold border
      സാരി | sari
      ചേല | sari, cloth
      കുപ്പായം | shirt, blouse
      പാവാട | long skirt
      ദാവണി | davani, half-sari wrap
      തോർത്ത് | thin cotton towel
      തലപ്പാവ് | turban
      # ആഭരണങ്ങൾ | Ornaments
      മാല | necklace
      കാശുമാല | coin necklace
      പതക്കം | pendant
      വള | bangle
      മോതിരം | ring
      കമ്മൽ | earring
      മൂക്കുത്തി | nose stud
      പാദസരം | anklet
      കൊലുസ് | anklet
      അരഞ്ഞാണം | waist chain
    `),
  },
  {
    id: "colours",
    ml: "നിറങ്ങൾ",
    en: "Colours",
    tint: "violet",
    words: list(`
      # നിത്യനിറങ്ങൾ | Everyday colours
      ചുവപ്പ് | red
      പച്ച | green
      നീല | blue
      മഞ്ഞ | yellow
      കറുപ്പ് | black
      വെളുപ്പ് | white
      ചാരനിറം | grey
      തവിട്ടുനിറം | brown
      കാവി | ochre, saffron
      ഇളംചുവപ്പ് | pink
      ഊത | violet, purple
      വെള്ളിനിറം | silver
      ചെമ്പൻ | copper red, reddish brown
      കടുംനീല | dark blue
      # കാവ്യഭാഷയിൽ | In literary Malayalam
      ശ്യാമം | dark, dusky
      ധവളം | white (literary)
      അരുണം | dawn red (literary)
      ഹരിതം | green (literary)
      പീതം | yellow (literary)
      നീലിമ | blueness
    `),
  },
  {
    id: "body",
    ml: "ശരീരഭാഗങ്ങൾ",
    en: "Parts of the body",
    tint: "coral",
    words: list(`
      # തലയും മുഖവും | Head and face
      തല | head
      മുടി | hair
      നെറ്റി | forehead
      കണ്ണ് | eye
      പുരികം | eyebrow
      കൺപീലി | eyelash
      മൂക്ക് | nose
      ചെവി | ear
      കവിൾ | cheek
      ചുണ്ട് | lip
      വായ | mouth
      പല്ല് | tooth
      നാക്ക് | tongue
      താടി | chin, beard
      # ഉടലും കൈകാലുകളും | Body and limbs
      കഴുത്ത് | neck
      തോൾ | shoulder
      കൈ | hand, arm
      കൈമുട്ട് | elbow
      വിരൽ | finger
      നഖം | nail
      നെഞ്ച് | chest
      വയറ് | stomach, belly
      പുറം | back
      അര | waist
      കാൽ | leg, foot
      കാൽമുട്ട് | knee
      ഉപ്പൂറ്റി | heel
      തൊലി | skin
      # ഉള്ളിൽ | Inside the body
      ഹൃദയം | heart
      ശ്വാസകോശം | lungs
      കരൾ | liver
      വൃക്ക | kidney
      രക്തം | blood
      എല്ല് | bone
      ഞരമ്പ് | vein, nerve
    `),
  },
  {
    id: "feelings",
    ml: "വികാരങ്ങൾ",
    en: "Feelings",
    tint: "violet",
    words: list(`
      # സന്തോഷം | Joy and love
      സന്തോഷം | happiness
      ആനന്ദം | bliss
      ആഹ്ലാദം | delight
      ഉത്സാഹം | enthusiasm
      ആശ്വാസം | relief
      പ്രതീക്ഷ | hope
      അഭിമാനം | pride
      സ്നേഹം | love
      വാത്സല്യം | tender affection
      പ്രണയം | romantic love
      അത്ഭുതം | wonder
      # ദുഃഖം | Sorrow
      ദുഃഖം | sorrow
      സങ്കടം | sadness
      വിഷാദം | melancholy
      നിരാശ | despair, disappointment
      ഏകാന്തത | loneliness
      വിരഹം | pain of separation
      നൊമ്പരം | ache, heartache
      കുറ്റബോധം | guilt
      # ഭയവും ദേഷ്യവും | Fear and anger
      ഭയം | fear
      പേടി | fright
      ആശങ്ക | anxiety, worry
      പരിഭ്രമം | panic, flurry
      കോപം | anger
      ദേഷ്യം | anger, irritation
      അസൂയ | jealousy
      വെറുപ്പ് | hatred, disgust
      നാണം | shyness
      ലജ്ജ | shame, bashfulness
      അമ്പരപ്പ് | bewilderment
    `),
  },
  {
    id: "sounds",
    ml: "ശബ്ദങ്ങൾ",
    en: "Sounds",
    tint: "sky",
    words: list(`
      # ജീവികളുടെ ശബ്ദം | Creatures
      കൂവൽ | crowing, call
      ഗർജനം | roar
      ചിന്നംവിളി | trumpeting of an elephant
      അമറൽ | lowing, bellowing
      കുര | bark
      ഓരിയിടൽ | howl
      ചീറ്റൽ | hiss
      മൂളൽ | hum, buzz
      കരച്ചിൽ | cry
      # പ്രകൃതിയുടെ ശബ്ദം | Nature and things
      ഇരമ്പം | roar, rumble
      മർമരം | rustle
      കളകളം | babble, murmur of water
      ഇടിമുഴക്കം | rumble of thunder
      മുഴക്കം | boom, resounding
      കിലുക്കം | jingle, tinkle
      പ്രതിധ്വനി | echo
    `),
  },
  {
    id: "kinship",
    ml: "ബന്ധുക്കൾ",
    en: "Family and kinship",
    tint: "coral",
    words: list(`
      # വീട്ടിൽ | Parents, siblings and children
      അച്ഛൻ | father
      അമ്മ | mother
      ചേട്ടൻ | elder brother
      അനിയൻ | younger brother
      ചേച്ചി | elder sister
      അനിയത്തി | younger sister
      മകൻ | son
      മകൾ | daughter
      പേരക്കുട്ടി | grandchild
      # മുതിർന്നവർ | Elders
      മുത്തച്ഛൻ | grandfather
      മുത്തശ്ശി | grandmother
      അമ്മാവൻ | maternal uncle
      അമ്മായി | aunt
      വലിയച്ഛൻ | father's elder brother
      ചെറിയച്ഛൻ | father's younger brother
      # വിവാഹബന്ധം | By marriage
      ഭർത്താവ് | husband
      ഭാര്യ | wife
      മരുമകൻ | son-in-law, nephew
      മരുമകൾ | daughter-in-law, niece
      അളിയൻ | brother-in-law
      നാത്തൂൻ | sister-in-law
    `),
  },
  {
    id: "measures",
    ml: "അളവുകൾ",
    en: "Traditional measures and money",
    tint: "tangerine",
    words: list(`
      # ധാന്യം അളക്കാൻ | Grain measures
      നാഴി | nazhi, a small grain measure
      പറ | para, a large grain measure
      # നീളം | Length
      ചാൺ | span of the hand
      മുഴം | cubit, elbow to fingertip
      കാതം | league, about ten miles
      # സമയം | Time
      നാഴിക | nazhika, twenty-four minutes
      വിനാഴിക | vinazhika, twenty-four seconds
      # പണം | Old money
      കാശ് | kash, small coin, money
      പണം | panam, old coin, money
      അണ | anna
      പൈസ | paisa
      രൂപ | rupee
    `),
  },
  {
    id: "arts",
    ml: "കല",
    en: "Arts, music and play",
    tint: "coral",
    words: list(`
      # കലാരൂപങ്ങൾ | Art forms
      കഥകളി | Kathakali, classical dance-drama
      മോഹിനിയാട്ടം | Mohiniyattam, classical dance
      ഓട്ടൻതുള്ളൽ | Ottanthullal, satirical solo recital
      കൂടിയാട്ടം | Koodiyattam, Sanskrit theatre
      ചാക്യാർകൂത്ത് | Chakyar Koothu, comic storytelling
      തെയ്യം | Theyyam, ritual dance of North Malabar
      തിരുവാതിരക്കളി | Thiruvathirakali, women's circle dance
      ഒപ്പന | Oppana, wedding song and dance
      കോൽക്കളി | Kolkali, stick dance
      പടയണി | Padayani, masked night dance
      പുലിക്കളി | Pulikali, tiger dance
      കളരിപ്പയറ്റ് | Kalaripayattu, martial art
      # വാദ്യങ്ങൾ | Musical instruments
      ചെണ്ട | chenda, cylindrical drum
      മദ്ദളം | maddalam, barrel drum
      ഇടയ്ക്ക | idakka, hourglass drum
      തിമില | thimila, drum of the panchavadyam
      ഇലത്താളം | ilathalam, cymbals
      കൊമ്പ് | kombu, curved horn
      കുഴൽ | kuzhal, double-reed pipe
      നാദസ്വരം | nadaswaram, long double-reed pipe
      തകിൽ | thavil, barrel drum
      മിഴാവ് | mizhavu, large copper drum
      ഉടുക്ക് | udukku, small hand drum
      വീണ | veena, stringed instrument
      പഞ്ചവാദ്യം | panchavadyam, five-instrument ensemble
      തായമ്പക | thayambaka, solo chenda performance
      മേളം | melam, percussion ensemble
      # നാടൻ കളികൾ | Folk games
      കിളിത്തട്ട് | kilithattu, team chasing game
      ഒളിച്ചുകളി | hide and seek
      കൊത്തങ്കല്ലുകളി | five stones
      ഗോലി | marbles
      പമ്പരം | spinning top
      വടംവലി | tug of war
      ചതുരംഗം | chess
      പകിട | dice game
      ഊഞ്ഞാൽ | swing
      # ആഘോഷങ്ങൾ | Festivals and celebrations
      ഓണം | Onam, Kerala's harvest festival
      മാവേലി | Maveli, the king Onam welcomes home
      ഓണക്കോടി | new clothes given for Onam
      ഓണപ്പുടവ | Onam cloth
      ഉത്രാടപ്പാച്ചിൽ | the rush on Onam eve to get everything ready
      പൂക്കളം | flower carpet
      തുമ്പിതുള്ളൽ | thumbithullal, girls' Onam game
      കുമ്മാട്ടി | kummatti, masked folk play
      ഊഞ്ഞാലാട്ടം | swinging on a swing
      പുത്തരി | rice from the first harvest
      വിഷു | Vishu, Kerala new year
      വിഷുക്കൈനീട്ടം | Vishu money gift from elders
      വിഷുപ്പക്ഷി | Vishu bird, Indian cuckoo
      പടക്കം | firecracker
      പൂത്തിരി | sparkler
      മത്താപ്പ് | coloured flare
      വെടിക്കെട്ട് | fireworks display
      വള്ളംകളി | boat race
      ചുണ്ടൻവള്ളം | snake boat
      ഓടിവള്ളം | fast racing boat
      ആർപ്പുവിളി | joyful cheering
      കുരവ | women's joyful ululation
      ഘോഷയാത്ര | festive procession
      തോരണം | festoon
      ചമയം | festive decoration, costume
      # സംഗീതം | Music
      സംഗീതം | music
      പാട്ട് | song
      ഗാനം | song
      ഗീതം | song, verse to be sung
      ഈണം | tune, melody
      രാഗം | raga, melody
      താളം | rhythm, beat
      ലയം | tempo, rhythmic flow
      ശ്രുതി | pitch, drone
      സ്വരം | musical note
      നാദം | musical sound, tone
      ഗമകം | gamakam, ornamenting a note
      ആലാപനം | singing, unfolding a raga
      വായ്പ്പാട്ട് | vocal music
      മൂളിപ്പാട്ട് | humming a tune
      പല്ലവി | refrain, opening line of a song
      അനുപല്ലവി | the part after the refrain
      ഈരടി | couplet
      ശീൽ | a line of song, tune
      താരാട്ട് | lullaby
      നാടൻപാട്ട് | folk song
      വഞ്ചിപ്പാട്ട് | boat song
      ഞാറ്റുപാട്ട് | song sung while planting paddy
      ഓണപ്പാട്ട് | Onam song
      മാപ്പിളപ്പാട്ട് | Mappila song
      കുമ്മി | kummi, women's clapping song and dance
      പടപ്പാട്ട് | battle song
      കച്ചേരി | concert
      ഗാനമേള | concert of songs
      ഗായകൻ | singer
      ഗായിക | singer (woman)
      പാട്ടുകാരൻ | singer
      പാട്ടുകാരി | singer (woman)
      സംഗീതജ്ഞൻ | musician
      മേളക്കാരൻ | percussionist, instrumentalist
      ഗാനരചയിതാവ് | lyricist
      സംഗീതസംവിധായകൻ | music composer
      ചെമ്പട | chempada tala
      അടന്ത | adantha tala
      പഞ്ചാരി | panchari, a melam rhythm
      വായ്ത്താരി | vaythari, spoken rhythm syllables
      സോപാനം | sopanam, Kerala's sopana music style
    `),
  },
];

/** categories that were merged keep their old links working */
const MOVED: Record<string, string> = { seasons: "time", months: "time", stars: "time", fish: "aquatic" };
export const nattarivuCategory = (id: string | null | undefined) => {
  const key = id ? (MOVED[id] ?? id) : id;
  return NATTARIVU.find((c) => c.id === key);
};
