/**
 * @file joker_meta.js
 * @version 1.0
 * @author Sam Cao
 * @created 2026-10-21
 * @lastUpdated 2026-10-21
 * @description Per-joker data the engine lacks: what each sprite looks like, a general tier, ordering class, and counter units.
 * @aiUpdate Update @lastUpdated and @version. Append changelog at bottom.
 */
'use strict';

// Keyed by engine joker id (row * 10 + col in vendor/assets/Jokers.png).
//
// look  - what the sprite shows, written from viewing each one; searched and shown on the info card
// tags  - extra search words (synonyms, colors, objects)
// tier  - S/A/B/C/D. Claude's read of community consensus for Balatro 1.0.1, general play. Opinion, editable.
// order - when the joker scores, which decides where it should sit:
//           chips / mult / xmult        independent effect, fires in joker order after cards
//           card-chips / card-mult / card-xmult   fires per scored card, in joker order within each card
//           held                        fires from cards held in hand; joker position doesn't matter
//           retrigger                   retriggers cards; position doesn't matter
//           copy-right / copy-left      Blueprint / Brainstorm
//           none                        no scoring effect (money, shop, modifiers)
// c     - counter, matching the engine's joker value:
//           [unit, a, b, min]  shown value = max(min, a + b * count); unit is '+Mult', '+Chips', 'XMult' or text
//           ['toggle']         0 = inactive, 1 = active
//           ['count']          count with no score shown (label comes from vendor/cards.js)
//           ['select', what]   value picks a card / suit / rank / hand type
// note  - ordering or usage note shown on the info card, when the class alone doesn't say enough
const JOKER_META = {
  0: { look: 'Classic jester: orange and red hat, blue collar', tags: 'plain basic default original clown', tier: 'D', order: 'mult' },
  1: { look: 'Circus clown with green hair, white face, blue bow tie, orange suit', tags: 'chaos green clown bowtie', tier: 'C', order: 'none' },
  2: { look: 'Blue jester above two playing cards', tags: 'pair two cards blue', tier: 'C', order: 'mult' },
  3: { look: 'Green and yellow jester above three playing cards', tags: 'three cards green yellow', tier: 'C', order: 'mult' },
  4: { look: 'Pink and red jester above four playing cards', tags: 'two pair four cards pink', tier: 'C', order: 'mult' },
  5: { look: 'Jester with light blue hat and yellow collar above five cards in a row', tags: 'straight five cards yellow', tier: 'D', order: 'mult' },
  6: { look: 'Black and red jester above five red diamond cards', tags: 'flush red cards black', tier: 'C', order: 'mult' },
  7: { look: 'Jester card cut in half, bottom torn away and dark', tags: 'half cut torn broken ripped', tier: 'C', order: 'mult' },
  8: { look: 'Circus clown with red nose, orange and blue hat, ruffled collar', tags: 'merry clown red nose ruff', tier: 'C', order: 'none' },
  9: { look: 'Faded jester on cracked grey stone', tags: 'stone rock grey gray cracked', tier: 'C', order: 'chips', c: ['+Chips', 0, 25, 0] },
  10: { look: 'Tall court-card jester juggling balls, blue sash', tags: 'juggling balls juggle sash', tier: 'B', order: 'none' },
  11: { look: 'Court-card jester in green and red holding a bottle', tags: 'drunk bottle drinking wine', tier: 'C', order: 'none' },
  12: { look: 'Blue and red acrobats on a trapeze above an orange hoop', tags: 'trapeze circus hoop ring gymnast', tier: 'B', order: 'xmult', c: ['toggle'], note: 'Only on the last hand of the round: set it active then.' },
  13: { look: 'Black silhouette of two face profiles, like theatre masks', tags: 'theatre theater masks silhouette profile faces', tier: 'A', order: 'retrigger' },
  14: { look: 'White-faced mime in a black beret and red scarf', tags: 'mime beret french white face', tier: 'A', order: 'retrigger' },
  15: { look: 'Gold bank credit card with a chip', tags: 'credit card bank gold chip money', tier: 'D', order: 'none' },
  16: { look: 'Orange jester on an orange diamond-patterned card', tags: 'greedy diamonds orange', tier: 'C', order: 'card-mult' },
  17: { look: 'Red jester on a red heart-patterned card', tags: 'lusty hearts red', tier: 'C', order: 'card-mult' },
  18: { look: 'Purple jester on a purple spade-patterned card', tags: 'wrathful spades purple', tier: 'C', order: 'card-mult' },
  19: { look: 'Teal jester on a green club-patterned card', tags: 'gluttonous clubs green teal', tier: 'C', order: 'card-mult' },
  20: { look: 'Minstrel in a green coat playing a lute', tags: 'bard musician guitar lute minstrel', tier: 'C', order: 'none' },
  21: { look: 'Striped red, orange and white flag on a pole', tags: 'flag banner striped pole', tier: 'C', order: 'chips', c: ['+Chips', 0, 30, 0] },
  22: { look: 'Misty blue mountain peak with floating rocks', tags: 'mountain peak summit mist rocks', tier: 'C', order: 'mult', c: ['toggle'], note: 'Only with 0 discards left.' },
  23: { look: 'Cream marble statue of a jester', tags: 'marble statue bust white cream', tier: 'C', order: 'none' },
  24: { look: 'Red punch-hole loyalty card from Joker\'s Deli', tags: 'loyalty punch card deli stamps coupon', tier: 'B', order: 'xmult', c: ['count'], note: 'X4 when hands remaining reaches 0.' },
  25: { look: 'Stand-up comedian with a microphone on a red-curtained stage', tags: 'comedian microphone stage curtain standup', tier: 'B', order: 'retrigger' },
  26: { look: 'Misaligned print of a jester with colour test bars down the side', tags: 'misprint offset misaligned color bars glitch', tier: 'C', order: 'mult' },
  27: { look: 'Silver metallic jester', tags: 'steel metal silver chrome iron', tier: 'A', order: 'xmult', c: ['XMult', 1, 0.2, 1] },
  28: { look: 'Red raised fist on orange sunburst rays', tags: 'fist punch power propaganda sunburst', tier: 'B', order: 'held' },
  29: { look: 'Gold jester on white', tags: 'gold golden yellow', tier: 'B', order: 'none' },
  30: { look: 'Blue technical blueprint of a jester with circuit lines', tags: 'blueprint schematic blue copy circuit drawing', tier: 'S', order: 'copy-right', note: 'Copies the joker to its right. Put your strongest compatible joker there.' },
  31: { look: 'Jester behind reflective glass panes', tags: 'glass window reflection transparent pane', tier: 'B', order: 'xmult', c: ['XMult', 1, 0.75, 1] },
  32: { look: 'Dark card with glowing red eyes and a jagged red grin', tags: 'scary monster demon red eyes teeth dark', tier: 'B', order: 'card-chips' },
  33: { look: 'Abstract paint strokes over the word JOKER', tags: 'abstract art paint splash modern lettering', tier: 'B', order: 'mult' },
  34: { look: 'Hourglass with orange sand and blue lightning', tags: 'hourglass sand timer clock waiting', tier: 'C', order: 'none' },
  35: { look: 'Gold ticket with a serial number', tags: 'ticket golden gold serial', tier: 'B', order: 'none' },
  36: { look: 'Green card table with playing cards laid out as a smiling face', tags: 'face smile felt table cards arranged forming making shaped', tier: 'B', order: 'none' },
  37: { look: 'Sepia tan jester on a halftone dot background', tags: 'tan brown sepia halftone tarot', tier: 'B', order: 'none' },
  38: { look: 'Red jester, red hat and red collar', tags: 'even red', tier: 'C', order: 'card-mult' },
  39: { look: 'Blue jester, blue hat and blue collar', tags: 'odd blue', tier: 'C', order: 'card-chips' },
  40: { look: 'Tiny joker card floating in empty space', tags: 'wee tiny small mini little', tier: 'B', order: 'chips', c: ['+Chips', 0, 8, 0] },
  41: { look: 'Plain white business card for Joseph J. Joker', tags: 'business card name plain white text', tier: 'C', order: 'none' },
  42: { look: 'Deep space with a purple nebula and a bright star', tags: 'supernova space star nebula galaxy', tier: 'B', order: 'mult', note: 'Uses how many times this hand type was played (set it in hand levels).' },
  43: { look: 'Skeleton jester with a skull face', tags: 'skeleton skull bones dead', tier: 'B', order: 'none' },
  44: { look: 'Two club symbols on a blue marble swirl', tags: 'clubs swirl marble blue double', tier: 'C', order: 'xmult' },
  45: { look: 'Two cards over a stormy card with blue and yellow lightning', tags: 'duo lightning storm pair two cards', tier: 'B', order: 'xmult' },
  46: { look: 'Three cards over a stormy card with yellow and teal lightning', tags: 'trio lightning storm three cards', tier: 'B', order: 'xmult' },
  47: { look: 'Four cards over a stormy card with red lightning', tags: 'family lightning storm four cards red', tier: 'A', order: 'xmult' },
  48: { look: 'Five cards in a row over multicoloured lightning', tags: 'order lightning storm straight five cards', tier: 'B', order: 'xmult' },
  49: { look: 'Red diamond cards over a grey card with red lightning', tags: 'tribe lightning storm flush red cards', tier: 'A', order: 'xmult' },
  50: { look: 'Black magic 8 ball on a purple swirl', tags: '8 ball eight billiard pool purple', tier: 'C', order: 'none' },
  51: { look: 'Golden spiral over red and blue rectangles', tags: 'spiral golden ratio fibonacci squares mondrian', tier: 'B', order: 'card-mult' },
  52: { look: 'Black stencil silhouette of a jester', tags: 'stencil silhouette shadow black outline', tier: 'A', order: 'xmult', c: ['XMult', 1, 1, 1], note: 'Count is empty joker slots; Stencil counts itself.' },
  53: { look: 'Jester in an astronaut helmet and space suit', tags: 'astronaut space helmet spacesuit', tier: 'B', order: 'none' },
  54: { look: 'Matador in a black hat and gold jacket on a red cape', tags: 'matador bullfighter cape red', tier: 'C', order: 'none' },
  55: { look: 'Dagger with green glowing swirls on a dark card', tags: 'dagger knife blade green magic sacrifice', tier: 'B', order: 'mult', c: ['+Mult', 0, 1, 0] },
  56: { look: 'Ringmaster in a top hat with a red and black collar', tags: 'showman ringmaster top hat magician', tier: 'B', order: 'none' },
  57: { look: 'Fortune teller in a purple turban with a green jewel', tags: 'fortune teller turban mystic psychic purple', tier: 'C', order: 'mult', c: ['+Mult', 0, 1, 0] },
  58: { look: 'Highway through green hills with a yellow road sign', tags: 'road highway sign landscape hills', tier: 'B', order: 'xmult', c: ['XMult', 1, 0.5, 1] },
  59: { look: 'Pirate jester in a brown tricorn hat', tags: 'pirate tricorn hat swashbuckler', tier: 'C', order: 'mult', note: 'Adds the sell value of your other jokers; check their sell values.' },
  60: { look: 'Orange sunflowers in a grey pot', tags: 'flowers sunflowers vase pot plant', tier: 'B', order: 'xmult' },
  61: { look: 'Yellow bus stop sign: Route 210-A, stops for Jack, Queen, King', tags: 'bus stop sign yellow route', tier: 'B', order: 'mult', c: ['+Mult', 0, 1, 0] },
  62: { look: 'Queen court card holding a sceptre', tags: 'queen face card royal court', tier: 'B', order: 'held' },
  63: { look: 'Jester in a graduation cap with an A+ grade', tags: 'graduate cap mortarboard student school grade', tier: 'C', order: 'card-mult' },
  64: { look: 'Smeared, dripping jester in red and blue', tags: 'smeared blurry melting drip paint', tier: 'B', order: 'none' },
  65: { look: 'Green die showing six pips', tags: 'dice die six green', tier: 'A', order: 'none' },
  66: { look: 'White glove hand showing four fingers on purple', tags: 'hand glove fingers four purple', tier: 'B', order: 'none' },
  67: { look: 'Yellow banana on green', tags: 'banana fruit yellow', tier: 'B', order: 'mult' },
  68: { look: 'Daredevil in a stars-and-stripes helmet', tags: 'stuntman helmet daredevil motorcycle stars stripes', tier: 'B', order: 'chips' },
  69: { look: 'Ballot paper spelling J O K E R with one box punched', tags: 'ballot vote election punch chad', tier: 'B', order: 'retrigger', note: 'Retriggers the first scored card; card order matters.' },
  70: { look: 'Driver\'s licence ID card with a red-haired jester photo', tags: 'license licence id card photo driver', tier: 'B', order: 'xmult', c: ['count'], note: 'X3 once the count of enhanced cards reaches 16.' },
  71: { look: 'Faint, transparent outline of a jester', tags: 'invisible ghost faded transparent empty', tier: 'A', order: 'none', c: ['count'] },
  72: { look: 'Teal jester under a JOKER banner with stars', tags: 'astronomer teal stars banner', tier: 'C', order: 'none' },
  73: { look: 'Jester card burning, orange flames and charred black edges', tags: 'burnt fire flames charred burning', tier: 'A', order: 'none' },
  74: { look: 'Purple and orange dusk sky over a desert', tags: 'dusk sunset evening landscape desert', tier: 'B', order: 'retrigger', c: ['toggle'], note: 'Only on the last hand of the round: set it active then.' },
  75: { look: 'Teal jester on a 90s confetti pattern', tags: 'throwback retro 90s confetti pattern', tier: 'B', order: 'xmult', c: ['XMult', 1, 0.25, 1] },
  76: { look: 'Carved tiki mask idol', tags: 'idol tiki mask totem carved', tier: 'A', order: 'card-xmult', c: ['select', 'card'] },
  77: { look: 'Pencil sketch of a jester on parchment', tags: 'sketch drawing doodle paper pencil brainstorm', tier: 'S', order: 'copy-left', note: 'Copies the leftmost joker. Put your strongest compatible joker first.' },
  78: { look: 'Satellite orbiting above Earth', tags: 'satellite space earth orbit', tier: 'C', order: 'none', c: ['count'] },
  79: { look: 'Pale blue cut diamond on tan', tags: 'gem diamond crystal jewel rough', tier: 'B', order: 'none' },
  80: { look: 'Green stone with red speckles on pink marble', tags: 'bloodstone gem stone green red spots', tier: 'A', order: 'card-xmult' },
  81: { look: 'Grey-green flint arrowhead on lavender marble', tags: 'arrowhead flint spear stone', tier: 'B', order: 'card-chips' },
  82: { look: 'Black swirled agate stone on blue marble', tags: 'onyx agate black stone gem dark', tier: 'B', order: 'card-mult' },
  83: { look: 'Sad white pierrot clown with a CANIO nameplate', tags: 'canio pierrot white clown sad legendary', tier: 'A', order: 'xmult', c: ['XMult', 1, 1, 1] },
  84: { look: 'Jester in a blue and yellow hat with a TRIBOULET nameplate', tags: 'triboulet blue yellow legendary', tier: 'S', order: 'card-xmult' },
  85: { look: 'Jester in a yellow and black hat with a YORICK nameplate', tags: 'yorick yellow black legendary', tier: 'A', order: 'xmult', c: ['XMult', 0, 1, 1] },
  86: { look: 'Jester in a red hat and red collar with a CHICOT nameplate', tags: 'chicot red legendary', tier: 'A', order: 'none' },
  87: { look: 'Red-bearded jester in a green hat with a PERKEO nameplate', tags: 'perkeo green hat red beard legendary', tier: 'S', order: 'none' },
  88: { look: 'Certificate of Authenticity with a gold seal, signed J. Joker', tags: 'certificate document seal signature paper', tier: 'C', order: 'none' },
  89: { look: 'Cowboy boot with a spur and a red up arrow on orange rays', tags: 'boot cowboy spur arrow bootstraps', tier: 'B', order: 'mult', c: ['+Mult', 0, 2, 0], note: 'Count is your money divided by $5.' },
  100: { look: 'White egg with an orange smiling face', tags: 'egg face white', tier: 'C', order: 'none' },
  101: { look: 'Burglar in a striped beanie and striped shirt', tags: 'burglar robber thief stripes beanie', tier: 'C', order: 'none' },
  102: { look: 'Chalk drawing of a jester on a green chalkboard', tags: 'chalkboard blackboard chalk school green', tier: 'A', order: 'xmult' },
  103: { look: 'Runner with a red headband and race bib #345', tags: 'runner athlete marathon headband race bib', tier: 'B', order: 'chips', c: ['+Chips', 0, 15, 0] },
  104: { look: 'Ice cream cone with blue, orange and red scoops', tags: 'ice cream cone dessert scoops', tier: 'C', order: 'chips', c: ['+Chips', 100, -5, 0] },
  105: { look: 'Red and blue DNA double helix', tags: 'dna helix science genes', tier: 'S', order: 'none' },
  106: { look: 'Water splash on blue', tags: 'splash water wave droplets', tier: 'C', order: 'none' },
  107: { look: 'Blue-faced jester on a blue card', tags: 'blue face', tier: 'B', order: 'chips', c: ['+Chips', 104, 2, 0], note: 'Count is cards left in deck minus 52.' },
  108: { look: 'Purple psychic with a third eye and a halo', tags: 'sixth sense third eye psychic purple', tier: 'C', order: 'none' },
  109: { look: 'Jester drawn in stars on a night sky', tags: 'constellation stars night sky', tier: 'A', order: 'xmult', c: ['XMult', 1, 0.1, 1] },
  110: { look: 'Red-bearded hiker with a green cap and a backpack', tags: 'hiker backpack beard camping hiking', tier: 'A', order: 'card-chips' },
  111: { look: 'Jester with a blank white face, no features', tags: 'faceless blank no face empty', tier: 'C', order: 'none' },
  112: { look: 'Green jester on white', tags: 'green', tier: 'B', order: 'mult', c: ['+Mult', 0, 1, 0] },
  113: { look: 'Ace in a sphere with blue and red arrows pointing up and down', tags: 'superposition quantum atom sphere arrows ace', tier: 'C', order: 'none' },
  114: { look: 'Yellow notepad: To Do, Jog, Oil Change, Karate, Eat Candy, Ruminate', tags: 'to do list note notepad handwriting paper', tier: 'C', order: 'none', c: ['select', 'hand'] },
  115: { look: 'Glowing yellow banana with lightning on green', tags: 'cavendish banana yellow glowing', tier: 'S', order: 'xmult' },
  116: { look: 'Hooded figure in dark sunglasses', tags: 'card sharp hoodie hood sunglasses hacker', tier: 'A', order: 'xmult', note: 'Needs this hand type already played this round (set it in hand levels).' },
  117: { look: 'Plain red card, JOKER in the corner', tags: 'red card blank plain', tier: 'C', order: 'mult', c: ['+Mult', 0, 3, 0] },
  118: { look: 'Wild-eyed jester among dark vines on red', tags: 'madness crazy vines red insane', tier: 'B', order: 'xmult', c: ['XMult', 1, 0.5, 1] },
  119: { look: 'Square, blocky pixel jester', tags: 'square blocky cube pixel', tier: 'B', order: 'chips', c: ['+Chips', 0, 4, 0] },
  120: { look: 'Ghostly flame over a table between curtains', tags: 'seance ghost spirit table curtains candle', tier: 'C', order: 'none' },
  121: { look: 'Small joker on a white patterned wallpaper', tags: 'riff raff pattern wallpaper small', tier: 'C', order: 'none' },
  122: { look: 'Vampire with fangs, slicked hair and a high cape collar', tags: 'vampire dracula fangs cape', tier: 'A', order: 'xmult', c: ['XMult', 1, 0.1, 1] },
  123: { look: 'Sunny alley between buildings', tags: 'shortcut alley street path buildings', tier: 'B', order: 'none' },
  124: { look: 'Glitchy holographic jester', tags: 'hologram glitch sci-fi holographic', tier: 'A', order: 'xmult', c: ['XMult', 1, 0.25, 1] },
  125: { look: 'Sad hobo clown in a battered hat and patched coat', tags: 'vagabond hobo tramp sad clown hat', tier: 'B', order: 'none' },
  126: { look: 'Jester king in a gold crown and fur collar', tags: 'baron crown king royalty', tier: 'S', order: 'held' },
  127: { look: 'Cloud shaped like the number 9 in a blue sky', tags: 'cloud nine sky 9', tier: 'B', order: 'none', c: ['count'] },
  128: { look: 'Rocket ship lifting off', tags: 'rocket spaceship launch', tier: 'B', order: 'none', c: ['count'] },
  129: { look: 'Dark obelisk with glowing purple glyphs', tags: 'obelisk monolith tower pillar glyphs', tier: 'B', order: 'xmult', c: ['XMult', 1, 0.2, 1] },
  130: { look: 'Pale mask on a gold patterned background', tags: 'midas mask gold', tier: 'B', order: 'none' },
  131: { look: 'Luchador wrestler in a blue mask holding a gold belt', tags: 'luchador wrestler mask wrestling', tier: 'C', order: 'none' },
  132: { look: 'Polaroid photo of a jester', tags: 'photograph polaroid photo picture', tier: 'A', order: 'card-xmult', note: 'X2 on the first face card scored; card order matters.' },
  133: { look: 'Red gift wrapped with a gold bow, tagged To: Joker', tags: 'gift card present ribbon bow', tier: 'C', order: 'none' },
  134: { look: 'Black bean on green', tags: 'turtle bean seed', tier: 'C', order: 'none', c: ['count'] },
  135: { look: 'Brown eroded rock with small green plants', tags: 'erosion rock canyon dirt earth plants', tier: 'C', order: 'mult', c: ['+Mult', 0, 4, 0] },
  136: { look: 'Red Reserved Parking sign with arrows', tags: 'reserved parking sign red arrow', tier: 'C', order: 'none' },
  137: { look: 'Airmail envelope with a stamp, addressed to Jack Joker', tags: 'mail rebate envelope letter stamp', tier: 'C', order: 'none', c: ['select', 'rank'] },
  138: { look: 'Stock chart with a line shooting upward', tags: 'to the moon stocks chart graph line up stonks', tier: 'C', order: 'none' },
  139: { look: 'Trippy distorted jester with floating letters', tags: 'hallucination trippy psychedelic distorted', tier: 'C', order: 'none' },
  140: { look: 'Blue-grey jester above two cards', tags: 'sly pair two cards blue grey', tier: 'D', order: 'chips' },
  141: { look: 'Yellow-green jester above three cards', tags: 'wily three cards yellow green', tier: 'D', order: 'chips' },
  142: { look: 'Coral red jester above four cards', tags: 'clever two pair four cards red', tier: 'D', order: 'chips' },
  143: { look: 'Red, blue and yellow jester above five cards in a row', tags: 'devious straight five cards', tier: 'D', order: 'chips' },
  144: { look: 'Red and black jester above blue flush cards', tags: 'crafty flush cards red black', tier: 'D', order: 'chips' },
  145: { look: 'Waving lucky cat holding a gold coin', tags: 'lucky cat maneki neko waving coin', tier: 'B', order: 'xmult', c: ['XMult', 1, 0.25, 1] },
  146: { look: 'Signed baseball card of a player with a bat', tags: 'baseball bat player sports card', tier: 'S', order: 'xmult', note: 'The X1.5 fires at each Uncommon joker, so Uncommon jokers belong right of +Mult jokers.' },
  147: { look: 'Black bull\'s head with curved horns', tags: 'bull horns ox', tier: 'B', order: 'chips', c: ['+Chips', 0, 2, 0], note: 'Count is your money.' },
  148: { look: 'Cola bottle labelled Joker on orange bubbles', tags: 'diet cola soda bottle drink', tier: 'C', order: 'none' },
  149: { look: 'Trading card with stats boxes 4 and 3', tags: 'trading card tcg collectible stats', tier: 'B', order: 'none' },
  150: { look: 'Flash card showing Jj and a little jester', tags: 'flash card letter j alphabet school', tier: 'B', order: 'mult', c: ['+Mult', 0, 2, 0] },
  151: { look: 'Red striped popcorn bucket', tags: 'popcorn snack movie bucket', tier: 'C', order: 'mult', c: ['+Mult', 20, -4, 0] },
  152: { look: 'Bowl of ramen noodles with an egg', tags: 'ramen noodles soup bowl egg', tier: 'B', order: 'xmult', c: ['XMult', 2, -0.01, 0] },
  153: { look: 'Glass seltzer siphon bottle', tags: 'seltzer soda siphon bottle', tier: 'B', order: 'retrigger', c: ['hands left', 10, -1, 0] },
  154: { look: 'Pair of orange and blue trousers', tags: 'spare trousers pants jeans', tier: 'B', order: 'mult', c: ['+Mult', 0, 2, 0] },
  155: { look: 'Campfire and tent in a dark forest', tags: 'campfire fire forest tent night camping', tier: 'A', order: 'xmult', c: ['XMult', 1, 0.25, 1] },
  156: { look: 'Yellow smiley face', tags: 'smiley smile face yellow emoji', tier: 'B', order: 'card-mult' },
  157: { look: 'Ancient stone carving of a face among vines', tags: 'ancient stone carving temple ruins tablet', tier: 'A', order: 'card-xmult', c: ['select', 'suit'] },
  158: { look: 'Blue walkie-talkie radio', tags: 'walkie talkie radio', tier: 'C', order: 'card-mult' },
  159: { look: 'Snowy castle with blue roofs', tags: 'castle snow tower fortress', tier: 'B', order: 'chips', c: ['+Chips', 0, 3, 0] }
};

const JOKER_TIERS = ['S', 'A', 'B', 'C', 'D'];

// Ordering guidance by class, shown on the info card when the joker has no specific note.
const ORDER_NOTES = {
  chips: 'Adds Chips after cards score. Position barely matters; keep it left of xMult jokers.',
  mult: 'Adds Mult after cards score. Place left of xMult jokers.',
  xmult: 'Multiplies Mult after cards score. Place right of +Mult and +Chips jokers.',
  'card-chips': 'Adds Chips per scored card. Position doesn\'t matter.',
  'card-mult': 'Adds Mult per scored card. Place left of per-card xMult jokers (Photograph, Bloodstone, Triboulet).',
  'card-xmult': 'Multiplies Mult per scored card. Place right of per-card +Mult jokers.',
  held: 'Scores from cards held in hand, before other jokers. Position doesn\'t matter.',
  retrigger: 'Retriggers cards. Position doesn\'t matter.',
  'copy-right': 'Copies the joker to its right.',
  'copy-left': 'Copies the leftmost joker.',
  none: 'No direct scoring effect. Position doesn\'t matter.'
};

// shown value -> engine count, inverse of a + b * count, rounded to a whole count.
function counterFromDisplay(spec, shown) {
  const [, a, b] = spec;
  return Math.round((shown - a) / b);
}

function counterToDisplay(spec, count) {
  const [, a, b, min] = spec;
  return Math.max(min, Math.round((a + b * count) * 100) / 100);
}

if (typeof module !== 'undefined') module.exports = { JOKER_META, JOKER_TIERS, ORDER_NOTES, counterFromDisplay, counterToDisplay };

/** CHANGELOG
 * v1.0 (2026-10-21): All 150 jokers: appearance from viewing each sprite, general tiers, ordering classes, counter units.
 */
