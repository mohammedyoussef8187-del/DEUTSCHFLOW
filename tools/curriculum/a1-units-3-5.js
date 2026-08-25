/*
 * DeutschFlow A1 — units 3 to 5.
 *
 * The learner can now say who they are and handle numbers and time. These units give them
 * people to talk about, a day to describe, and a shop to survive in — which is where the
 * accusative case finally has a reason to exist.
 */

export const UNITS_3_5 = [
  /* ==================================================================== unit 3 */
  {
    slug: "familie-und-menschen", ordering: 3,
    title: { de: "Familie und Menschen", en: "Family and people", ar: "العائلة والناس" },
    objective: { ar: "تتحدث عن عائلتك، وتصف الناس، وتقول ما تملكه." },
    lessons: [
      {
        slug: "a1-l07-familie", ordering: 1,
        title: { de: "Meine Familie", en: "My family", ar: "عائلتي" },
        objective: { ar: "تسمّي أفراد العائلة وتتحدث عن عائلتك بجمل بسيطة." },
        context: { ar: "زميلة في الدورة تريك صورة عائلتها وتسألك عن عائلتك." },
        canDo: { ar: "أستطيع تقديم أفراد عائلتي والحديث عنهم." },
        vocabulary: [
          { de: "Familie", article: "die", plural: "Familien", ar: "العائلة", en: "family", wordClass: "noun" },
          { de: "Vater", article: "der", plural: "Väter", ar: "الأب", en: "father", wordClass: "noun" },
          { de: "Mutter", article: "die", plural: "Mütter", ar: "الأم", en: "mother", wordClass: "noun" },
          { de: "Bruder", article: "der", plural: "Brüder", ar: "الأخ", en: "brother", wordClass: "noun" },
          { de: "Schwester", article: "die", plural: "Schwestern", ar: "الأخت", en: "sister", wordClass: "noun" },
          { de: "Kind", article: "das", plural: "Kinder", ar: "الطفل", en: "child", wordClass: "noun" },
          { de: "Eltern", article: "die", ar: "الوالدان", en: "parents", wordClass: "noun" },
          { de: "verheiratet", ar: "متزوّج", en: "married", wordClass: "adjective" },
          { de: "ledig", ar: "أعزب", en: "single", wordClass: "adjective" },
          { de: "haben", ar: "يملك؛ لديه", en: "to have", wordClass: "verb" }
        ],
        sentences: [
          { de: "Ich habe einen Bruder und zwei Schwestern.", ar: "لديّ أخ وأختان.", en: "I have one brother and two sisters.", uses: ["haben", "Bruder", "Schwester"] },
          { de: "Meine Mutter heißt Fatima.", ar: "أمي اسمها فاطمة.", en: "My mother is called Fatima.", uses: ["Mutter"] },
          { de: "Mein Vater arbeitet in Kairo.", ar: "أبي يعمل في القاهرة.", en: "My father works in Cairo.", uses: ["Vater"] },
          { de: "Ich bin ledig und habe keine Kinder.", ar: "أنا أعزب وليس لديّ أطفال.", en: "I am single and have no children.", uses: ["ledig", "Kind", "haben"] }
        ],
        grammar: {
          slug: "possessivartikel",
          title: { de: "mein, dein, sein, ihr", en: "Possessive articles", ar: "أدوات الملكية" },
          summary: { ar: "كيف تقول «أبي» و«أختك» و«كتابه»." },
          rules: [
            {
              slug: "mein-dein",
              title: { de: "mein/meine je nach Nomen", en: "mein or meine", ar: "mein أم meine" },
              explanation: {
                ar: "أداة الملكية تتبع نوع الاسم الذي بعدها، لا نوع المالك. مع أسماء der وdas نقول «mein»، ومع أسماء die ومع الجمع نقول «meine». مثال: der Vater ← mein Vater، die Mutter ← meine Mutter، das Kind ← mein Kind، die Eltern (جمع) ← meine Eltern.",
                en: "The possessive agrees with the noun that follows: mein for der/das nouns, meine for die and plural."
              },
              formation: { de: "der Vater → mein Vater · die Mutter → meine Mutter · das Kind → mein Kind · die Eltern → meine Eltern" },
              usage: { ar: "نفس القاعدة لكل الأدوات: dein (لك)، sein (له)، ihr (لها/لهم)، unser (لنا)." },
              mistake: { ar: "خطأ شائع: «meine Vater». الأب مذكّر (der Vater) فالصواب «mein Vater»." },
              examples: [
                { de: "Mein Bruder ist Lehrer.", ar: "أخي معلّم." },
                { de: "Meine Schwester wohnt in Köln.", ar: "أختي تسكن في كولونيا." },
                { de: "Wie heißt dein Kind?", ar: "ما اسم طفلك؟" }
              ]
            },
            {
              slug: "haben-praesens",
              title: { de: "haben im Präsens", en: "haben in the present", ar: "haben في المضارع" },
              explanation: {
                ar: "haben فعل أساسي وشاذ قليلاً: لاحظ أن «du hast» و«er hat» تفقدان حرف b. تحتاجه للملكية وللعمر وللحديث عن الوقت.",
                en: "haben loses its b with du and er/sie: du hast, er hat."
              },
              formation: { de: "ich habe · du hast · er/sie hat · wir haben · ihr habt · sie/Sie haben" },
              mistake: { ar: "خطأ شائع: «du habst». الصواب «du hast»." },
              examples: [
                { de: "Hast du Geschwister?", ar: "هل لديك إخوة؟" },
                { de: "Sie hat zwei Kinder.", ar: "لديها طفلان." }
              ]
            }
          ]
        },
        exercises: [
          { type: "multiple_choice", answer: "mein", options: ["mein", "meine", "meinen"], practises: ["mein-dein"],
            instruction: { ar: "اختر أداة الملكية الصحيحة." }, prompt: { de: "___ Vater ist Ingenieur." } },
          { type: "multiple_choice", answer: "meine", options: ["mein", "meine", "meinem"], practises: ["mein-dein"],
            instruction: { ar: "اختر أداة الملكية الصحيحة." }, prompt: { de: "___ Mutter kocht gern." } },
          { type: "type_answer", answer: "hast", practises: ["haben-praesens"],
            instruction: { ar: "أكمل بالصيغة الصحيحة من haben." }, prompt: { de: "___ du Geschwister?" } },
          { type: "type_answer", answer: "hat", practises: ["haben-praesens"],
            instruction: { ar: "أكمل بالصيغة الصحيحة من haben." }, prompt: { de: "Er ___ zwei Kinder." } },
          { type: "type_answer", answer: "die Schwester", practises: ["Schwester"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "الأخت" } },
          { type: "type_answer", answer: "der Bruder", practises: ["Bruder"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "الأخ" } },
          { type: "multiple_choice", answer: "Kinder", options: ["Kinder", "Kindes", "Kinden"], practises: ["Kind"],
            instruction: { ar: "ما جمع das Kind؟" }, prompt: { de: "das Kind → die ___" } },
          { type: "self_assessed",
            instruction: { ar: "اكتب أربع جمل عن عائلتك: عدد الإخوة، أسماؤهم، وأين يسكنون." },
            prompt: { de: "Meine Familie: …" } }
        ],
        review: { ar: "أداة الملكية تتبع الاسم بعدها: mein Vater / meine Mutter. وdu hast لا du habst." },
        mistakes: [{ ar: "«meine Vater» خطأ. der Vater ← mein Vater." }]
      },
      {
        slug: "a1-l08-menschen", ordering: 2,
        title: { de: "Menschen beschreiben", en: "Describing people", ar: "وصف الأشخاص" },
        objective: { ar: "تصف شخصاً: مظهره وشخصيته وعمله." },
        context: { ar: "تصف صديقاً لشخص لم يقابله بعد." },
        canDo: { ar: "أستطيع وصف شخص بجمل بسيطة." },
        vocabulary: [
          { de: "Mann", article: "der", plural: "Männer", ar: "الرجل", en: "man", wordClass: "noun" },
          { de: "Frau", article: "die", plural: "Frauen", ar: "المرأة", en: "woman", wordClass: "noun" },
          { de: "Freund", article: "der", plural: "Freunde", ar: "الصديق", en: "friend", wordClass: "noun" },
          { de: "nett", ar: "لطيف", en: "nice", wordClass: "adjective" },
          { de: "freundlich", ar: "ودود", en: "friendly", wordClass: "adjective" },
          { de: "ruhig", ar: "هادئ", en: "quiet, calm", wordClass: "adjective" },
          { de: "groß", ar: "طويل؛ كبير", en: "tall; big", wordClass: "adjective" },
          { de: "klein", ar: "قصير؛ صغير", en: "short; small", wordClass: "adjective" },
          { de: "jung", ar: "شاب", en: "young", wordClass: "adjective" },
          { de: "arbeiten", ar: "يعمل", en: "to work", wordClass: "verb" }
        ],
        sentences: [
          { de: "Mein Freund ist sehr nett.", ar: "صديقي لطيف جداً.", en: "My friend is very nice.", uses: ["Freund", "nett"] },
          { de: "Sie ist groß und freundlich.", ar: "هي طويلة وودودة.", en: "She is tall and friendly.", uses: ["groß", "freundlich"] },
          { de: "Er arbeitet als Koch.", ar: "يعمل طاهياً.", en: "He works as a cook.", uses: ["arbeiten"] },
          { de: "Die Frau dort ist meine Lehrerin.", ar: "المرأة هناك هي معلّمتي.", en: "The woman over there is my teacher.", uses: ["Frau"] }
        ],
        grammar: {
          slug: "personalpronomen-adjektive",
          title: { de: "Personalpronomen und Adjektive nach sein", en: "Pronouns and adjectives after sein", ar: "الضمائر والصفات بعد sein" },
          summary: { ar: "الصفة بعد sein لا تتغيّر أبداً — وهذا يريح المبتدئ." },
          rules: [
            {
              slug: "adjektiv-nach-sein",
              title: { de: "Adjektiv nach sein bleibt gleich", en: "Adjectives after sein never change", ar: "الصفة بعد sein ثابتة" },
              explanation: {
                ar: "عندما تأتي الصفة بعد الفعل sein فإنها لا تأخذ أي نهاية، مهما كان نوع الاسم أو عدده. «Der Mann ist groß»، «Die Frau ist groß»، «Die Kinder sind groß» — الصفة groß لم تتغيّر. النهايات تظهر فقط عندما تسبق الصفة الاسمَ مباشرة، وذلك درس لاحق.",
                en: "After sein an adjective takes no ending, whatever the noun."
              },
              formation: { de: "Der Mann ist groß. · Die Frau ist groß. · Die Kinder sind groß." },
              mistake: { ar: "خطأ شائع: «Die Frau ist große». لا نهاية بعد sein." },
              examples: [
                { de: "Mein Bruder ist ruhig.", ar: "أخي هادئ." },
                { de: "Meine Eltern sind sehr freundlich.", ar: "والداي ودودان جداً." }
              ]
            },
            {
              slug: "pronomen",
              title: { de: "er, sie, es", en: "er, sie, es", ar: "er وsie وes" },
              explanation: {
                ar: "الضمير يتبع نوع الاسم النحوي لا جنسه الطبيعي. der Tisch ← er، die Lampe ← sie، das Kind ← es. لذلك يقال عن الطفل «es» وإن كان ولداً، لأن das Kind محايد.",
                en: "The pronoun follows the noun's grammatical gender: der → er, die → sie, das → es."
              },
              examples: [
                { de: "Der Freund? Er ist nett.", ar: "الصديق؟ هو لطيف." },
                { de: "Die Lehrerin? Sie ist streng.", ar: "المعلّمة؟ هي صارمة." },
                { de: "Das Kind? Es ist klein.", ar: "الطفل؟ هو صغير." }
              ]
            }
          ]
        },
        exercises: [
          { type: "multiple_choice", answer: "groß", options: ["groß", "große", "großen"], practises: ["adjektiv-nach-sein"],
            instruction: { ar: "اختر الصيغة الصحيحة." }, prompt: { de: "Die Frau ist ___." } },
          { type: "multiple_choice", answer: "er", options: ["er", "sie", "es"], practises: ["pronomen"],
            instruction: { ar: "اختر الضمير المناسب." }, prompt: { de: "Der Freund kommt. ___ ist nett." } },
          { type: "multiple_choice", answer: "es", options: ["er", "sie", "es"], practises: ["pronomen"],
            instruction: { ar: "اختر الضمير المناسب." }, prompt: { de: "Das Kind spielt. ___ ist klein." } },
          { type: "type_answer", answer: "arbeitet", practises: ["arbeiten"],
            instruction: { ar: "أكمل بالصيغة الصحيحة من arbeiten." }, prompt: { de: "Er ___ als Koch." } },
          { type: "type_answer", answer: "die Frau", practises: ["Frau"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "المرأة" } },
          { type: "type_answer", answer: "freundlich", practises: ["freundlich"],
            instruction: { ar: "اكتب الصفة الألمانية." }, prompt: { ar: "ودود" } },
          { type: "self_assessed",
            instruction: { ar: "صف صديقاً في أربع جمل: الاسم، العمر، المظهر، الشخصية." },
            prompt: { de: "Mein Freund / Meine Freundin …" } }
        ],
        review: { ar: "بعد sein لا نهاية للصفة. الضمير يتبع der/die/das لا الجنس الطبيعي." }
      }
    ]
  },

  /* ==================================================================== unit 4 */
  {
    slug: "alltag", ordering: 4,
    title: { de: "Mein Alltag", en: "My daily life", ar: "حياتي اليومية" },
    objective: { ar: "تصف يومك: ما تفعله ومتى، وتستخدم الأفعال المنفصلة." },
    lessons: [
      {
        slug: "a1-l09-tagesablauf", ordering: 1,
        title: { de: "Mein Tag", en: "My day", ar: "يومي" },
        objective: { ar: "تصف روتينك اليومي من الاستيقاظ حتى النوم." },
        context: { ar: "المعلّمة تسأل الصف: كيف يبدو يومكم المعتاد؟" },
        canDo: { ar: "أستطيع وصف يومي بالترتيب." },
        vocabulary: [
          { de: "auf|stehen", ar: "ينهض من النوم", en: "to get up", wordClass: "verb", key: "aufstehen" },
          { de: "frühstücken", ar: "يتناول الإفطار", en: "to have breakfast", wordClass: "verb" },
          { de: "ein|kaufen", ar: "يتسوّق", en: "to shop", wordClass: "verb", key: "einkaufen" },
          { de: "an|fangen", ar: "يبدأ", en: "to start", wordClass: "verb", key: "anfangen" },
          { de: "fern|sehen", ar: "يشاهد التلفاز", en: "to watch TV", wordClass: "verb", key: "fernsehen" },
          { de: "schlafen", ar: "ينام", en: "to sleep", wordClass: "verb" },
          { de: "Arbeit", article: "die", ar: "العمل", en: "work", wordClass: "noun" },
          { de: "Morgen", article: "der", plural: "Morgen", ar: "الصباح", en: "morning", wordClass: "noun" },
          { de: "Abend", article: "der", plural: "Abende", ar: "المساء", en: "evening", wordClass: "noun" },
          { de: "immer", ar: "دائماً", en: "always", wordClass: "word" }
        ],
        sentences: [
          { de: "Ich stehe um sechs Uhr auf.", ar: "أستيقظ الساعة السادسة.", en: "I get up at six.", uses: ["aufstehen"] },
          { de: "Danach frühstücke ich.", ar: "بعد ذلك أتناول الإفطار.", en: "After that I have breakfast.", uses: ["frühstücken"] },
          { de: "Am Abend sehe ich fern.", ar: "في المساء أشاهد التلفاز.", en: "In the evening I watch TV.", uses: ["fernsehen", "Abend"] },
          { de: "Ich kaufe am Samstag ein.", ar: "أتسوّق يوم السبت.", en: "I shop on Saturday.", uses: ["einkaufen"] }
        ],
        grammar: {
          slug: "trennbare-verben",
          title: { de: "Trennbare Verben", en: "Separable verbs", ar: "الأفعال المنفصلة" },
          summary: { ar: "أفعال ينفصل أولها ويذهب إلى آخر الجملة." },
          rules: [
            {
              slug: "trennung",
              title: { de: "Das Präfix geht ans Ende", en: "The prefix goes to the end", ar: "البادئة تذهب إلى النهاية" },
              explanation: {
                ar: "بعض الأفعال الألمانية تتكوّن من بادئة + فعل، مثل «aufstehen» (auf + stehen). في الجملة العادية تنفصل البادئة وتذهب إلى آخر الجملة، ويبقى الفعل في مكانه الثاني: «Ich stehe um sechs Uhr auf». في القاموس تجدها موصولة، ولذلك نكتبها هنا بخط فاصل: auf|stehen. أشهر البادئات: auf، an، ein، aus، mit، fern، zu.",
                en: "A separable verb splits: the verb stays in position two, the prefix goes to the very end."
              },
              formation: { de: "auf|stehen → Ich stehe … auf. · ein|kaufen → Ich kaufe … ein." },
              usage: { ar: "البادئة تبقى ملتصقة فقط بعد الأفعال الناقصة: «Ich muss um sechs aufstehen»." },
              mistake: { ar: "خطأ شائع: «Ich aufstehe um sechs». الصواب: «Ich stehe um sechs auf»." },
              examples: [
                { de: "Der Kurs fängt um neun an.", ar: "الدرس يبدأ الساعة التاسعة." },
                { de: "Wann stehst du auf?", ar: "متى تستيقظ؟" },
                { de: "Am Abend sehe ich fern.", ar: "في المساء أشاهد التلفاز." }
              ]
            }
          ]
        },
        listening: {
          slug: "l09-mein-tag", activityType: "monologue",
          title: { de: "Ein Tag von Lena", en: "A day in Lena's life", ar: "يوم في حياة لينا" },
          instruction: { ar: "اقرأ النص وانتبه إلى الأفعال المنفصلة وإلى أوقات اليوم." },
          speakers: ["Lena"],
          lines: [
            { speaker: "Lena", de: "Ich stehe jeden Tag um halb sieben auf.", ar: "أستيقظ كل يوم في السادسة والنصف." },
            { speaker: "Lena", de: "Dann frühstücke ich und trinke Kaffee.", ar: "ثم أتناول الإفطار وأشرب القهوة." },
            { speaker: "Lena", de: "Die Arbeit fängt um acht an.", ar: "العمل يبدأ الساعة الثامنة." },
            { speaker: "Lena", de: "Am Nachmittag kaufe ich ein.", ar: "بعد الظهر أتسوّق." },
            { speaker: "Lena", de: "Am Abend sehe ich fern und dann schlafe ich.", ar: "في المساء أشاهد التلفاز ثم أنام." }
          ]
        },
        exercises: [
          { type: "type_answer", answer: "auf", practises: ["trennung"],
            instruction: { ar: "أكمل الجملة بالبادئة في مكانها الصحيح." }, prompt: { de: "Ich stehe um sechs Uhr ___." } },
          { type: "type_answer", answer: "an", practises: ["trennung"],
            instruction: { ar: "أكمل الجملة بالبادئة." }, prompt: { de: "Der Kurs fängt um neun ___." } },
          { type: "multiple_choice", answer: "Ich kaufe am Samstag ein.",
            options: ["Ich kaufe am Samstag ein.", "Ich einkaufe am Samstag.", "Ich kaufe ein am Samstag."],
            practises: ["trennung"], instruction: { ar: "أي جملة صحيحة؟" }, prompt: { de: "einkaufen + Samstag" } },
          { type: "type_answer", answer: "sehe", practises: ["fernsehen"],
            instruction: { ar: "أكمل: Am Abend ___ ich fern." }, prompt: { de: "Am Abend ___ ich fern." } },
          { type: "type_answer", answer: "die Arbeit", practises: ["Arbeit"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "العمل" } },
          { type: "multiple_choice", answer: "halb sieben", options: ["halb sieben", "halb acht", "sieben Uhr"],
            instruction: { ar: "حسب النص: متى تستيقظ لينا؟" }, prompt: { de: "Wann steht Lena auf?" } },
          { type: "self_assessed",
            instruction: { ar: "اكتب خمس جمل عن يومك مستخدماً فعلين منفصلين على الأقل." },
            prompt: { de: "Mein Tag: Ich stehe … auf. Dann …" } }
        ],
        review: { ar: "الفعل المنفصل: الفعل ثانياً والبادئة أخيراً. Ich stehe … auf." },
        mistakes: [{ ar: "«Ich aufstehe» خطأ — الصواب «Ich stehe … auf»." }]
      },
      {
        slug: "a1-l10-freizeit", ordering: 2,
        title: { de: "Freizeit und Hobbys", en: "Free time and hobbies", ar: "وقت الفراغ والهوايات" },
        objective: { ar: "تتحدث عن هواياتك وتقول ما تحب وما لا تحب." },
        context: { ar: "في استراحة، يسألك زميل عمّا تفعله في عطلة نهاية الأسبوع." },
        canDo: { ar: "أستطيع الحديث عن هواياتي وتفضيلاتي." },
        vocabulary: [
          { de: "Freizeit", article: "die", ar: "وقت الفراغ", en: "free time", wordClass: "noun" },
          { de: "Hobby", article: "das", plural: "Hobbys", ar: "الهواية", en: "hobby", wordClass: "noun" },
          { de: "lesen", ar: "يقرأ", en: "to read", wordClass: "verb" },
          { de: "spielen", ar: "يلعب", en: "to play", wordClass: "verb" },
          { de: "schwimmen", ar: "يسبح", en: "to swim", wordClass: "verb" },
          { de: "kochen", ar: "يطبخ", en: "to cook", wordClass: "verb" },
          { de: "Musik", article: "die", ar: "الموسيقى", en: "music", wordClass: "noun" },
          { de: "Sport", article: "der", ar: "الرياضة", en: "sport", wordClass: "noun" },
          { de: "gern", ar: "بسرور؛ يحب أن", en: "gladly, like doing", wordClass: "word" },
          { de: "oft", ar: "غالباً", en: "often", wordClass: "word" }
        ],
        sentences: [
          { de: "Ich lese gern Bücher.", ar: "أحب قراءة الكتب.", en: "I like reading books.", uses: ["lesen", "gern"] },
          { de: "Am Wochenende schwimme ich oft.", ar: "في عطلة الأسبوع أسبح غالباً.", en: "At the weekend I often swim.", uses: ["schwimmen", "oft"] },
          { de: "Meine Schwester kocht sehr gern.", ar: "أختي تحب الطبخ كثيراً.", en: "My sister likes cooking a lot.", uses: ["kochen", "gern"] },
          { de: "Ich höre nicht gern Musik.", ar: "لا أحب سماع الموسيقى.", en: "I don't like listening to music.", uses: ["Musik", "gern"] }
        ],
        grammar: {
          slug: "gern-und-nicht",
          title: { de: "gern und die Verneinung mit nicht", en: "gern and negation with nicht", ar: "gern والنفي بـ nicht" },
          summary: { ar: "كيف تقول «أحب أن…» وكيف تنفي فعلاً." },
          rules: [
            {
              slug: "gern",
              title: { de: "gern nach dem Verb", en: "gern comes after the verb", ar: "gern بعد الفعل" },
              explanation: {
                ar: "الألمانية لا تحتاج فعلاً خاصاً لـ«أحب أن أفعل». تضع الفعل العادي ثم كلمة «gern». «Ich lese gern» = أحب القراءة. وللنفي: «Ich lese nicht gern» = لا أحب القراءة. وللمبالغة: «sehr gern» = أحب كثيراً.",
                en: "Say the ordinary verb, then gern: ich lese gern = I like reading."
              },
              formation: { de: "Verb + gern · Verb + nicht gern · Verb + sehr gern" },
              mistake: { ar: "خطأ شائع: «Ich gern lese». الصواب «Ich lese gern» — gern بعد الفعل." },
              examples: [
                { de: "Ich spiele gern Fußball.", ar: "أحب لعب كرة القدم." },
                { de: "Er kocht nicht gern.", ar: "هو لا يحب الطبخ." }
              ]
            },
            {
              slug: "nicht-position",
              title: { de: "Wo steht nicht?", en: "Where nicht goes", ar: "أين يوضع nicht" },
              explanation: {
                ar: "قاعدة عملية للمبتدئ: «nicht» يأتي قبل الكلمة التي تنفيها، وفي نفي الفعل كاملاً يأتي في آخر الجملة. «Ich arbeite heute nicht» = لا أعمل اليوم. أما نفي الاسم النكرة فيكون بـ«kein» لا بـ«nicht»: «Ich habe kein Auto».",
                en: "nicht negates the whole sentence at the end, or stands before the word it denies. Use kein for indefinite nouns."
              },
              formation: { de: "Ich arbeite heute nicht. · Ich habe kein Auto." },
              mistake: { ar: "خطأ شائع: «Ich habe nicht ein Auto». الصواب «Ich habe kein Auto»." },
              examples: [
                { de: "Heute schwimme ich nicht.", ar: "اليوم لا أسبح." },
                { de: "Ich habe keine Zeit.", ar: "ليس لديّ وقت." }
              ]
            }
          ]
        },
        exercises: [
          { type: "multiple_choice", answer: "Ich lese gern.", options: ["Ich lese gern.", "Ich gern lese.", "Gern ich lese."],
            practises: ["gern"], instruction: { ar: "أي جملة صحيحة؟" }, prompt: { de: "lesen + gern" } },
          { type: "type_answer", answer: "gern", practises: ["gern"],
            instruction: { ar: "أكمل الجملة." }, prompt: { de: "Ich schwimme sehr ___." } },
          { type: "multiple_choice", answer: "kein", options: ["kein", "nicht", "nicht ein"], practises: ["nicht-position"],
            instruction: { ar: "اختر أداة النفي الصحيحة." }, prompt: { de: "Ich habe ___ Auto." } },
          { type: "type_answer", answer: "nicht", practises: ["nicht-position"],
            instruction: { ar: "أكمل بأداة النفي." }, prompt: { de: "Heute arbeite ich ___." } },
          { type: "type_answer", answer: "das Hobby", practises: ["Hobby"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "الهواية" } },
          { type: "type_answer", answer: "kochen", practises: ["kochen"],
            instruction: { ar: "اكتب الفعل الألماني." }, prompt: { ar: "يطبخ" } },
          { type: "self_assessed",
            instruction: { ar: "اكتب أربع جمل: هوايتان تحبهما وشيء لا تحبه." },
            prompt: { de: "Ich … gern. Ich … nicht gern." } }
        ],
        review: { ar: "gern بعد الفعل. kein للاسم النكرة، nicht لبقية الحالات." }
      }
    ]
  },

  /* ==================================================================== unit 5 */
  {
    slug: "essen-und-einkaufen", ordering: 5,
    title: { de: "Essen und Einkaufen", en: "Food and shopping", ar: "الطعام والتسوّق" },
    objective: { ar: "تتسوّق، وتطلب في مقهى، وتستخدم حالة النصب." },
    lessons: [
      {
        slug: "a1-l11-lebensmittel", ordering: 1,
        title: { de: "Im Supermarkt", en: "At the supermarket", ar: "في السوبر ماركت" },
        objective: { ar: "تسمّي الأطعمة الأساسية وتسأل عن السعر والكمية." },
        context: { ar: "تشتري احتياجات الأسبوع وتسأل موظفاً عن مكان الحليب." },
        canDo: { ar: "أستطيع التسوّق وسؤال البائع." },
        vocabulary: [
          { de: "Brot", article: "das", plural: "Brote", ar: "الخبز", en: "bread", wordClass: "noun" },
          { de: "Milch", article: "die", ar: "الحليب", en: "milk", wordClass: "noun" },
          { de: "Ei", article: "das", plural: "Eier", ar: "البيضة", en: "egg", wordClass: "noun" },
          { de: "Apfel", article: "der", plural: "Äpfel", ar: "التفاحة", en: "apple", wordClass: "noun" },
          { de: "Käse", article: "der", ar: "الجبن", en: "cheese", wordClass: "noun" },
          { de: "Wasser", article: "das", ar: "الماء", en: "water", wordClass: "noun" },
          { de: "kaufen", ar: "يشتري", en: "to buy", wordClass: "verb" },
          { de: "brauchen", ar: "يحتاج", en: "to need", wordClass: "verb" },
          { de: "Kilo", article: "das", plural: "Kilo", ar: "الكيلو", en: "kilo", wordClass: "noun" },
          { de: "Flasche", article: "die", plural: "Flaschen", ar: "الزجاجة", en: "bottle", wordClass: "noun" }
        ],
        sentences: [
          { de: "Ich brauche einen Apfel und eine Flasche Wasser.", ar: "أحتاج تفاحة وزجاجة ماء.", en: "I need an apple and a bottle of water.", uses: ["brauchen", "Apfel", "Flasche", "Wasser"] },
          { de: "Wo finde ich die Milch?", ar: "أين أجد الحليب؟", en: "Where do I find the milk?", uses: ["Milch"] },
          { de: "Ich kaufe ein Kilo Äpfel.", ar: "أشتري كيلو تفاح.", en: "I buy a kilo of apples.", uses: ["kaufen", "Kilo", "Apfel"] },
          { de: "Was kostet das Brot?", ar: "كم يكلّف الخبز؟", en: "How much is the bread?", uses: ["Brot"] }
        ],
        grammar: {
          slug: "akkusativ",
          title: { de: "Der Akkusativ", en: "The accusative case", ar: "حالة النصب" },
          summary: { ar: "ما الذي يتغيّر عندما يصبح الاسم مفعولاً به." },
          rules: [
            {
              slug: "akkusativ-artikel",
              title: { de: "Nur der wird zu den", en: "Only der becomes den", ar: "der وحدها تتحوّل إلى den" },
              explanation: {
                ar: "المفعول به في الألمانية يأخذ حالة النصب. الخبر السار: التغيير يقع على المذكّر فقط. der ← den، وein ← einen. أما die وdas فتبقيان كما هما، وكذلك eine. لذلك: «Ich kaufe den Apfel» لكن «Ich kaufe die Milch» و«Ich kaufe das Brot».",
                en: "In the accusative only the masculine changes: der → den, ein → einen."
              },
              formation: { de: "der Apfel → den Apfel · ein Apfel → einen Apfel · die Milch → die Milch · das Brot → das Brot" },
              usage: { ar: "أفعال تحتاج النصب دائماً: kaufen، brauchen، haben، essen، trinken، nehmen." },
              mistake: { ar: "خطأ شائع: «Ich brauche ein Apfel». الصواب «einen Apfel» لأن der Apfel مذكّر." },
              examples: [
                { de: "Ich nehme den Käse.", ar: "آخذ الجبن." },
                { de: "Wir brauchen einen Tisch.", ar: "نحتاج طاولة." },
                { de: "Sie kauft eine Flasche Wasser.", ar: "تشتري زجاجة ماء." }
              ]
            }
          ]
        },
        exercises: [
          { type: "multiple_choice", answer: "einen", options: ["ein", "einen", "eine"], practises: ["akkusativ-artikel"],
            instruction: { ar: "اختر الصيغة الصحيحة." }, prompt: { de: "Ich brauche ___ Apfel." } },
          { type: "multiple_choice", answer: "eine", options: ["ein", "einen", "eine"], practises: ["akkusativ-artikel"],
            instruction: { ar: "اختر الصيغة الصحيحة." }, prompt: { de: "Ich kaufe ___ Flasche Wasser." } },
          { type: "multiple_choice", answer: "das", options: ["der", "den", "das"], practises: ["akkusativ-artikel"],
            instruction: { ar: "اختر الصيغة الصحيحة." }, prompt: { de: "Ich nehme ___ Brot." } },
          { type: "type_answer", answer: "den", practises: ["akkusativ-artikel"],
            instruction: { ar: "أكمل بأداة التعريف في حالة النصب." }, prompt: { de: "Ich esse ___ Käse." } },
          { type: "type_answer", answer: "die Milch", practises: ["Milch"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "الحليب" } },
          { type: "multiple_choice", answer: "Eier", options: ["Eier", "Eis", "Eien"], practises: ["Ei"],
            instruction: { ar: "ما جمع das Ei؟" }, prompt: { de: "das Ei → die ___" } },
          { type: "type_answer", answer: "brauchen", practises: ["brauchen"],
            instruction: { ar: "اكتب الفعل الألماني." }, prompt: { ar: "يحتاج" } },
          { type: "self_assessed",
            instruction: { ar: "اكتب قائمة تسوّق بخمسة أصناف في جمل كاملة مع حالة النصب." },
            prompt: { de: "Ich brauche …" } }
        ],
        review: { ar: "النصب يغيّر المذكّر فقط: den / einen. المؤنث والمحايد بلا تغيير." },
        mistakes: [{ ar: "«ein Apfel» كمفعول به خطأ — الصواب «einen Apfel»." }]
      },
      {
        slug: "a1-l12-im-cafe", ordering: 2,
        title: { de: "Im Café bestellen", en: "Ordering in a café", ar: "الطلب في المقهى" },
        objective: { ar: "تطلب طعاماً وشراباً وتدفع الحساب بأدب." },
        context: { ar: "تجلس في مقهى مع صديق وتريد أن تطلب." },
        canDo: { ar: "أستطيع الطلب في مقهى ودفع الحساب." },
        vocabulary: [
          { de: "Kaffee", article: "der", ar: "القهوة", en: "coffee", wordClass: "noun" },
          { de: "Tee", article: "der", ar: "الشاي", en: "tea", wordClass: "noun" },
          { de: "Kuchen", article: "der", plural: "Kuchen", ar: "الكعك", en: "cake", wordClass: "noun" },
          { de: "Rechnung", article: "die", plural: "Rechnungen", ar: "الحساب", en: "bill", wordClass: "noun" },
          { de: "bestellen", ar: "يطلب", en: "to order", wordClass: "verb" },
          { de: "trinken", ar: "يشرب", en: "to drink", wordClass: "verb" },
          { de: "essen", ar: "يأكل", en: "to eat", wordClass: "verb" },
          { de: "zahlen", ar: "يدفع", en: "to pay", wordClass: "verb" },
          { de: "zusammen", ar: "معاً", en: "together", wordClass: "word" },
          { de: "getrennt", ar: "منفصلين", en: "separately", wordClass: "word" }
        ],
        sentences: [
          { de: "Ich möchte einen Kaffee, bitte.", ar: "أريد قهوة من فضلك.", en: "I would like a coffee, please.", uses: ["Kaffee"] },
          { de: "Was möchten Sie trinken?", ar: "ماذا تودّ أن تشرب؟", en: "What would you like to drink?", uses: ["trinken"] },
          { de: "Die Rechnung, bitte!", ar: "الحساب من فضلك!", en: "The bill, please!", uses: ["Rechnung"] },
          { de: "Zusammen oder getrennt?", ar: "معاً أم منفصلين؟", en: "Together or separately?", uses: ["zusammen", "getrennt"] }
        ],
        grammar: {
          slug: "moechten",
          title: { de: "möchten — höflich bestellen", en: "möchten — ordering politely", ar: "möchten — الطلب بأدب" },
          summary: { ar: "الصيغة المهذّبة التي تحتاجها في كل مقهى ومتجر." },
          rules: [
            {
              slug: "moechten-formen",
              title: { de: "ich möchte, Sie möchten", en: "Forms of möchten", ar: "تصريف möchten" },
              explanation: {
                ar: "«möchten» أدب أساسي في الألمانية. لا تقل «Ich will einen Kaffee» في مقهى — تبدو فظّاً. قل «Ich möchte einen Kaffee». لاحظ أن صيغتي ich وer متطابقتان بلا نهاية: ich möchte، er möchte. وإذا جاء بعدها فعل آخر ذهب هذا الفعل إلى آخر الجملة بصيغة المصدر.",
                en: "Use möchten to order politely. ich möchte and er möchte are identical, and a second verb goes to the end."
              },
              formation: { de: "ich möchte · du möchtest · er/sie möchte · wir möchten · ihr möchtet · sie/Sie möchten" },
              usage: { ar: "möchten + مفعول به في النصب: «Ich möchte einen Tee»." },
              mistake: { ar: "خطأ شائع: «Ich möchte ein Kaffee». der Kaffee مذكّر ← «einen Kaffee»." },
              examples: [
                { de: "Ich möchte ein Stück Kuchen.", ar: "أريد قطعة كعك." },
                { de: "Möchten Sie auch etwas trinken?", ar: "هل تودّ أن تشرب شيئاً أيضاً؟" }
              ]
            }
          ]
        },
        listening: {
          slug: "l12-im-cafe", activityType: "dialogue",
          title: { de: "Im Café", en: "In the café", ar: "في المقهى" },
          instruction: { ar: "اقرأ الحوار ولاحظ صيغ möchten وحالة النصب." },
          speakers: ["Kellner", "Amir", "Lena"],
          lines: [
            { speaker: "Kellner", de: "Guten Tag! Was möchten Sie?", ar: "طاب يومكم! ماذا تودّون؟" },
            { speaker: "Amir", de: "Ich möchte einen Kaffee, bitte.", ar: "أريد قهوة من فضلك." },
            { speaker: "Lena", de: "Und ich nehme einen Tee und ein Stück Kuchen.", ar: "وأنا آخذ شاياً وقطعة كعك." },
            { speaker: "Kellner", de: "Gern. Sonst noch etwas?", ar: "بكل سرور. أي شيء آخر؟" },
            { speaker: "Amir", de: "Nein, danke. Die Rechnung bitte gleich zusammen.", ar: "لا شكراً. الحساب معاً من فضلك." }
          ]
        },
        exercises: [
          { type: "multiple_choice", answer: "einen", options: ["ein", "einen", "eine"], practises: ["moechten-formen"],
            instruction: { ar: "اختر الصيغة الصحيحة." }, prompt: { de: "Ich möchte ___ Kaffee." } },
          { type: "type_answer", answer: "möchte", practises: ["moechten-formen"],
            instruction: { ar: "أكمل بالصيغة الصحيحة من möchten." }, prompt: { de: "Er ___ einen Tee." } },
          { type: "type_answer", answer: "möchten", practises: ["moechten-formen"],
            instruction: { ar: "أكمل بالصيغة الصحيحة من möchten." }, prompt: { de: "Was ___ Sie trinken?" } },
          { type: "type_answer", answer: "die Rechnung", practises: ["Rechnung"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "الحساب" } },
          { type: "multiple_choice", answer: "Die Rechnung, bitte!", options: ["Die Rechnung, bitte!", "Das Geld, bitte!", "Die Karte, bitte!"],
            instruction: { ar: "كيف تطلب الحساب؟" }, prompt: { de: "…" } },
          { type: "type_answer", answer: "zusammen", practises: ["zusammen"],
            instruction: { ar: "اكتب الكلمة الألمانية." }, prompt: { ar: "معاً" } },
          { type: "multiple_choice", answer: "einen Tee und ein Stück Kuchen",
            options: ["einen Tee und ein Stück Kuchen", "einen Kaffee", "nur Wasser"],
            instruction: { ar: "حسب الحوار: ماذا طلبت لينا؟" }, prompt: { de: "Was nimmt Lena?" } },
          { type: "self_assessed",
            instruction: { ar: "اكتب حواراً قصيراً في مقهى: النادل يسأل، وأنت تطلب وتدفع." },
            prompt: { de: "— Was möchten Sie? — …" } }
        ],
        review: { ar: "möchten للطلب المهذّب، ودائماً مع النصب: einen Kaffee." }
      }
    ]
  }
];
