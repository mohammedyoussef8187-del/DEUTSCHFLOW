/*
 * DeutschFlow A1 — units 6 to 8.
 *
 * The last stretch of A1: a place to live, a city to find your way around, and the two
 * things every beginner eventually needs — making an appointment and saying what happened.
 * The Perfekt arrives here, deliberately late, once there is enough past to talk about.
 */

export const UNITS_6_8 = [
  /* ==================================================================== unit 6 */
  {
    slug: "wohnen", ordering: 6,
    title: { de: "Wohnen", en: "Living and housing", ar: "السكن" },
    objective: { ar: "تصف سكنك وأثاثه، وتقول أين توجد الأشياء." },
    lessons: [
      {
        slug: "a1-l13-wohnung", ordering: 1,
        title: { de: "Meine Wohnung", en: "My flat", ar: "شقتي" },
        objective: { ar: "تصف شقتك وغرفها وتقول كم غرفة فيها." },
        context: { ar: "صديق يسألك عن سكنك الجديد." },
        canDo: { ar: "أستطيع وصف سكني وغرفه." },
        vocabulary: [
          { de: "Wohnung", article: "die", plural: "Wohnungen", ar: "الشقة", en: "flat", wordClass: "noun" },
          { de: "Zimmer", article: "das", plural: "Zimmer", ar: "الغرفة", en: "room", wordClass: "noun" },
          { de: "Küche", article: "die", plural: "Küchen", ar: "المطبخ", en: "kitchen", wordClass: "noun" },
          { de: "Bad", article: "das", plural: "Bäder", ar: "الحمّام", en: "bathroom", wordClass: "noun" },
          { de: "Tisch", article: "der", plural: "Tische", ar: "الطاولة", en: "table", wordClass: "noun" },
          { de: "Stuhl", article: "der", plural: "Stühle", ar: "الكرسي", en: "chair", wordClass: "noun" },
          { de: "Bett", article: "das", plural: "Betten", ar: "السرير", en: "bed", wordClass: "noun" },
          { de: "Fenster", article: "das", plural: "Fenster", ar: "النافذة", en: "window", wordClass: "noun" },
          { de: "hell", ar: "مضيء", en: "bright", wordClass: "adjective" },
          { de: "Miete", article: "die", plural: "Mieten", ar: "الإيجار", en: "rent", wordClass: "noun" }
        ],
        sentences: [
          { de: "Meine Wohnung hat drei Zimmer.", ar: "شقتي فيها ثلاث غرف.", en: "My flat has three rooms.", uses: ["Wohnung", "Zimmer"] },
          { de: "Die Küche ist klein, aber hell.", ar: "المطبخ صغير لكنه مضيء.", en: "The kitchen is small but bright.", uses: ["Küche", "hell"] },
          { de: "Die Miete ist nicht zu hoch.", ar: "الإيجار ليس مرتفعاً جداً.", en: "The rent is not too high.", uses: ["Miete"] },
          { de: "Im Zimmer stehen ein Bett und ein Tisch.", ar: "في الغرفة سرير وطاولة.", en: "In the room there is a bed and a table.", uses: ["Zimmer", "Bett", "Tisch"] }
        ],
        grammar: {
          slug: "es-gibt-und-plural",
          title: { de: "es gibt und der Plural", en: "es gibt and the plural", ar: "es gibt والجمع" },
          summary: { ar: "كيف تقول «يوجد»، وكيف تُبنى صيغ الجمع." },
          rules: [
            {
              slug: "es-gibt",
              title: { de: "es gibt + Akkusativ", en: "es gibt takes the accusative", ar: "es gibt مع النصب" },
              explanation: {
                ar: "«es gibt» تعني «يوجد»، وهي ثابتة لا تتغيّر مع المفرد أو الجمع: «Es gibt einen Tisch» و«Es gibt zwei Tische». وما بعدها دائماً في حالة النصب، لذلك المذكّر يصبح einen.",
                en: "es gibt means there is/are and never changes; what follows is accusative."
              },
              formation: { de: "Es gibt einen Tisch. · Es gibt eine Küche. · Es gibt zwei Zimmer." },
              mistake: { ar: "خطأ شائع: «Es geben zwei Zimmer». الصيغة ثابتة: «Es gibt»." },
              examples: [
                { de: "In der Wohnung gibt es ein Bad.", ar: "في الشقة يوجد حمّام." },
                { de: "Gibt es hier einen Supermarkt?", ar: "هل يوجد سوبر ماركت هنا؟" }
              ]
            },
            {
              slug: "plural",
              title: { de: "Pluralformen", en: "Plural forms", ar: "صيغ الجمع" },
              explanation: {
                ar: "الجمع في الألمانية لا يتبع قاعدة واحدة، لذلك يُحفظ مع الكلمة. الأنماط الشائعة: إضافة ‎-e (Tisch ← Tische)، إضافة ‎-e مع Umlaut (Stuhl ← Stühle)، إضافة ‎-n/-en (Wohnung ← Wohnungen)، إضافة ‎-er (Bad ← Bäder)، وبلا تغيير (Zimmer ← Zimmer). أداة التعريف في الجمع دائماً «die».",
                en: "German plurals follow several patterns and are learned with the word. The plural article is always die."
              },
              formation: { de: "der Tisch → die Tische · der Stuhl → die Stühle · die Wohnung → die Wohnungen · das Zimmer → die Zimmer" },
              mistake: { ar: "خطأ شائع: استخدام der أو das مع الجمع. الجمع دائماً die." },
              examples: [
                { de: "Die Zimmer sind groß.", ar: "الغرف كبيرة." },
                { de: "Wir brauchen vier Stühle.", ar: "نحتاج أربعة كراسٍ." }
              ]
            }
          ]
        },
        exercises: [
          { type: "type_answer", answer: "gibt", practises: ["es-gibt"],
            instruction: { ar: "أكمل الجملة." }, prompt: { de: "Es ___ hier einen Supermarkt." } },
          { type: "multiple_choice", answer: "einen", options: ["ein", "einen", "eine"], practises: ["es-gibt"],
            instruction: { ar: "اختر الصيغة الصحيحة." }, prompt: { de: "Es gibt ___ Tisch." } },
          { type: "multiple_choice", answer: "die", options: ["der", "die", "das"], practises: ["plural"],
            instruction: { ar: "أي أداة تعريف تسبق الجمع؟" }, prompt: { de: "___ Zimmer sind groß." } },
          { type: "multiple_choice", answer: "Stühle", options: ["Stühle", "Stuhle", "Stuhlen"], practises: ["plural"],
            instruction: { ar: "ما جمع der Stuhl؟" }, prompt: { de: "der Stuhl → die ___" } },
          { type: "type_answer", answer: "die Küche", practises: ["Küche"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "المطبخ" } },
          { type: "type_answer", answer: "das Bad", practises: ["Bad"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "الحمّام" } },
          { type: "self_assessed",
            instruction: { ar: "صف سكنك في خمس جمل: عدد الغرف، المطبخ، الإضاءة، الإيجار." },
            prompt: { de: "Meine Wohnung …" } }
        ],
        review: { ar: "es gibt ثابتة وما بعدها نصب. الجمع دائماً die، وصيغته تُحفظ مع الكلمة." }
      },
      {
        slug: "a1-l14-wo-ist", ordering: 2,
        title: { de: "Wo ist das?", en: "Where is it?", ar: "أين يوجد؟" },
        objective: { ar: "تقول أين توجد الأشياء باستخدام حروف الجر مع حالة الجر." },
        context: { ar: "تبحث عن مفاتيحك في البيت وتسأل أين وضعتها." },
        canDo: { ar: "أستطيع تحديد مكان الأشياء." },
        vocabulary: [
          { de: "Schrank", article: "der", plural: "Schränke", ar: "الخزانة", en: "cupboard", wordClass: "noun" },
          { de: "Regal", article: "das", plural: "Regale", ar: "الرف", en: "shelf", wordClass: "noun" },
          { de: "Schlüssel", article: "der", plural: "Schlüssel", ar: "المفتاح", en: "key", wordClass: "noun" },
          { de: "Tasche", article: "die", plural: "Taschen", ar: "الحقيبة", en: "bag", wordClass: "noun" },
          { de: "auf", ar: "على", en: "on", wordClass: "preposition" },
          { de: "in", ar: "في", en: "in", wordClass: "preposition" },
          { de: "unter", ar: "تحت", en: "under", wordClass: "preposition" },
          { de: "neben", ar: "بجانب", en: "next to", wordClass: "preposition" },
          { de: "zwischen", ar: "بين", en: "between", wordClass: "preposition" },
          { de: "liegen", ar: "يرقد؛ موجود مستلقياً", en: "to lie", wordClass: "verb" }
        ],
        sentences: [
          { de: "Der Schlüssel liegt auf dem Tisch.", ar: "المفتاح على الطاولة.", en: "The key is on the table.", uses: ["Schlüssel", "auf", "liegen"] },
          { de: "Die Tasche ist unter dem Bett.", ar: "الحقيبة تحت السرير.", en: "The bag is under the bed.", uses: ["Tasche", "unter"] },
          { de: "Das Buch steht im Regal.", ar: "الكتاب في الرف.", en: "The book is on the shelf.", uses: ["Regal", "in"] },
          { de: "Der Stuhl steht neben dem Fenster.", ar: "الكرسي بجانب النافذة.", en: "The chair is next to the window.", uses: ["neben"] }
        ],
        grammar: {
          slug: "dativ-ort",
          title: { de: "Der Dativ beim Ort", en: "The dative for location", ar: "حالة الجر لتحديد المكان" },
          summary: { ar: "عندما تجيب على سؤال «أين؟» تستخدم حالة الجر." },
          rules: [
            {
              slug: "wo-dativ",
              title: { de: "Wo? → Dativ", en: "Wo? takes the dative", ar: "سؤال Wo يأخذ الجر" },
              explanation: {
                ar: "حروف الجر auf، in، unter، neben، zwischen، vor، hinter، an، über يمكن أن تأخذ النصب أو الجر. القاعدة الحاسمة: إذا كان السؤال «Wo?» (أين يوجد الشيء الآن، بلا حركة) فالحالة جر. أدوات التعريف في الجر: der ← dem، das ← dem، die ← der، والجمع ← den. اختصارات شائعة: in dem = im، an dem = am.",
                en: "With Wo? (position, no movement) these prepositions take the dative: dem, dem, der, den."
              },
              formation: { de: "der Tisch → auf dem Tisch · das Bett → unter dem Bett · die Tasche → in der Tasche · in dem = im" },
              usage: { ar: "أفعال الموضع الشائعة: liegen (مستلقٍ)، stehen (قائم)، sein، hängen." },
              mistake: { ar: "خطأ شائع: «auf den Tisch» للإجابة على «أين». هذه حالة نصب وتعني الحركة إلى الطاولة. للمكان: «auf dem Tisch»." },
              examples: [
                { de: "Der Schlüssel ist in der Tasche.", ar: "المفتاح في الحقيبة." },
                { de: "Die Lampe hängt über dem Tisch.", ar: "المصباح معلّق فوق الطاولة." },
                { de: "Ich bin im Bad.", ar: "أنا في الحمّام." }
              ]
            }
          ]
        },
        exercises: [
          { type: "multiple_choice", answer: "dem", options: ["den", "dem", "der"], practises: ["wo-dativ"],
            instruction: { ar: "اختر الصيغة الصحيحة." }, prompt: { de: "Der Schlüssel liegt auf ___ Tisch." } },
          { type: "multiple_choice", answer: "der", options: ["den", "dem", "der"], practises: ["wo-dativ"],
            instruction: { ar: "اختر الصيغة الصحيحة." }, prompt: { de: "Das Geld ist in ___ Tasche." } },
          { type: "type_answer", answer: "im", practises: ["wo-dativ"],
            instruction: { ar: "اكتب الاختصار من in + dem." }, prompt: { de: "Ich bin ___ Bad." } },
          /* The gap tests the CASE, not which spatial relation the author had in mind:
             neben, vor, hinter and auf are all correct German in the original frame. */
          { type: "type_answer", answer: "dem", practises: ["wo-dativ"],
            instruction: { ar: "أكمل بأداة التعريف في حالة الجر." },
            prompt: { de: "Die Tasche ist unter ___ Bett." } },
          { type: "type_answer", answer: "der Schrank", practises: ["Schrank"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "الخزانة" } },
          { type: "type_answer", answer: "der Schlüssel", practises: ["Schlüssel"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "المفتاح" } },
          { type: "self_assessed",
            instruction: { ar: "اكتب خمس جمل تصف أين توجد أشياء في غرفتك." },
            prompt: { de: "Das Buch liegt … Der Stuhl steht …" } }
        ],
        review: { ar: "Wo؟ ← جر: dem / dem / der / den. in dem = im، an dem = am." },
        mistakes: [{ ar: "«auf den Tisch» تعني الحركة. المكان: «auf dem Tisch»." }]
      }
    ]
  },

  /* ==================================================================== unit 7 */
  {
    slug: "stadt-und-wege", ordering: 7,
    title: { de: "Stadt und Wege", en: "City and directions", ar: "المدينة والطرق" },
    objective: { ar: "تسأل عن الطريق، وتستخدم وسائل النقل، وتستعمل الأفعال الناقصة." },
    lessons: [
      {
        slug: "a1-l15-in-der-stadt", ordering: 1,
        title: { de: "In der Stadt", en: "In the city", ar: "في المدينة" },
        objective: { ar: "تسمّي أماكن المدينة وتسأل عن الطريق وتفهم الإرشاد." },
        context: { ar: "أنت في مدينة جديدة وتبحث عن محطة القطار." },
        canDo: { ar: "أستطيع السؤال عن الطريق وفهم الإجابة." },
        vocabulary: [
          { de: "Bahnhof", article: "der", plural: "Bahnhöfe", ar: "محطة القطار", en: "train station", wordClass: "noun" },
          { de: "Apotheke", article: "die", plural: "Apotheken", ar: "الصيدلية", en: "pharmacy", wordClass: "noun" },
          { de: "Bank", article: "die", plural: "Banken", ar: "البنك", en: "bank", wordClass: "noun" },
          { de: "Post", article: "die", ar: "البريد", en: "post office", wordClass: "noun" },
          { de: "links", ar: "يساراً", en: "left", wordClass: "word" },
          { de: "rechts", ar: "يميناً", en: "right", wordClass: "word" },
          { de: "geradeaus", ar: "مباشرة إلى الأمام", en: "straight ahead", wordClass: "word" },
          { de: "Ecke", article: "die", plural: "Ecken", ar: "الزاوية", en: "corner", wordClass: "noun" },
          { de: "fahren", ar: "يقود؛ يسافر", en: "to go (by vehicle)", wordClass: "verb" },
          { de: "zu Fuß", ar: "سيراً على الأقدام", en: "on foot", wordClass: "phrase" }
        ],
        sentences: [
          { de: "Entschuldigung, wo ist der Bahnhof?", ar: "عفواً، أين محطة القطار؟", en: "Excuse me, where is the station?", uses: ["Bahnhof"] },
          { de: "Gehen Sie geradeaus und dann links.", ar: "امشِ مباشرة ثم يساراً.", en: "Go straight and then left.", uses: ["geradeaus", "links"] },
          { de: "Die Apotheke ist an der Ecke.", ar: "الصيدلية عند الزاوية.", en: "The pharmacy is on the corner.", uses: ["Apotheke", "Ecke"] },
          { de: "Ich fahre mit dem Bus.", ar: "أذهب بالحافلة.", en: "I go by bus.", uses: ["fahren"] }
        ],
        grammar: {
          slug: "imperativ-sie",
          title: { de: "Der Imperativ mit Sie", en: "The Sie imperative", ar: "صيغة الأمر المهذّبة" },
          summary: { ar: "كيف تُعطى التعليمات وتُفهم في الشارع." },
          rules: [
            {
              slug: "imperativ",
              title: { de: "Verb + Sie", en: "Verb before Sie", ar: "الفعل قبل Sie" },
              explanation: {
                ar: "لإعطاء تعليمة بأدب نستخدم صيغة Sie، ونضع الفعل أولاً ثم Sie: «Gehen Sie geradeaus!» و«Nehmen Sie die zweite Straße!». هذه الصيغة هي التي ستسمعها عندما تسأل عن الطريق، لذلك يكفي في A1 أن تفهمها وتستخدم بعضها.",
                en: "Polite instructions put the verb first, then Sie: Gehen Sie geradeaus!"
              },
              formation: { de: "Gehen Sie …! · Nehmen Sie …! · Fahren Sie …! · Entschuldigen Sie!" },
              mistake: { ar: "خطأ شائع: «Sie gehen geradeaus!» كأمر. الترتيب في الأمر: الفعل أولاً." },
              examples: [
                { de: "Nehmen Sie die U-Bahn.", ar: "خذ مترو الأنفاق." },
                { de: "Gehen Sie hier rechts.", ar: "اتّجه هنا يميناً." }
              ]
            },
            {
              slug: "mit-dativ",
              title: { de: "mit + Dativ", en: "mit takes the dative", ar: "mit مع حالة الجر" },
              explanation: {
                ar: "حروف الجر mit، zu، von، bei، nach، aus تأخذ حالة الجر دائماً بلا استثناء. لذلك: «mit dem Bus»، «mit der Bahn»، «zum Bahnhof» (zu dem = zum)، «zur Post» (zu der = zur).",
                en: "mit, zu, von, bei, nach, aus always take the dative."
              },
              formation: { de: "mit dem Bus · mit der Bahn · zu dem = zum · zu der = zur" },
              mistake: { ar: "خطأ شائع: «mit den Bus». الصواب «mit dem Bus»." },
              examples: [
                { de: "Ich fahre mit dem Fahrrad.", ar: "أذهب بالدراجة." },
                { de: "Wie komme ich zum Bahnhof?", ar: "كيف أصل إلى المحطة؟" }
              ]
            }
          ]
        },
        listening: {
          slug: "l15-nach-dem-weg", activityType: "dialogue",
          title: { de: "Nach dem Weg fragen", en: "Asking for directions", ar: "السؤال عن الطريق" },
          instruction: { ar: "اقرأ الحوار وتتبّع الإرشادات خطوة بخطوة." },
          speakers: ["Amir", "Passantin"],
          lines: [
            { speaker: "Amir", de: "Entschuldigung, wie komme ich zum Bahnhof?", ar: "عفواً، كيف أصل إلى المحطة؟" },
            { speaker: "Passantin", de: "Gehen Sie hier geradeaus, etwa fünf Minuten.", ar: "امشِ هنا مباشرة، حوالي خمس دقائق." },
            { speaker: "Passantin", de: "Dann nehmen Sie die zweite Straße links.", ar: "ثم خذ الشارع الثاني يساراً." },
            { speaker: "Amir", de: "Und ist das weit? Soll ich mit dem Bus fahren?", ar: "وهل هو بعيد؟ هل آخذ الحافلة؟" },
            { speaker: "Passantin", de: "Nein, zu Fuß sind es zehn Minuten.", ar: "لا، سيراً على الأقدام عشر دقائق." },
            { speaker: "Amir", de: "Vielen Dank!", ar: "شكراً جزيلاً!" }
          ]
        },
        exercises: [
          { type: "multiple_choice", answer: "dem", options: ["den", "dem", "der"], practises: ["mit-dativ"],
            instruction: { ar: "اختر الصيغة الصحيحة." }, prompt: { de: "Ich fahre mit ___ Bus." } },
          { type: "type_answer", answer: "zum", practises: ["mit-dativ"],
            instruction: { ar: "اكتب الاختصار من zu + dem." }, prompt: { de: "Wie komme ich ___ Bahnhof?" } },
          { type: "multiple_choice", answer: "Gehen Sie geradeaus!", options: ["Gehen Sie geradeaus!", "Sie gehen geradeaus!", "Geradeaus Sie gehen!"],
            practises: ["imperativ"], instruction: { ar: "أي جملة أمر صحيحة؟" }, prompt: { de: "gehen + geradeaus" } },
          { type: "type_answer", answer: "links", practises: ["links"],
            instruction: { ar: "اكتب الكلمة الألمانية." }, prompt: { ar: "يساراً" } },
          { type: "type_answer", answer: "der Bahnhof", practises: ["Bahnhof"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "محطة القطار" } },
          { type: "type_answer", answer: "die Apotheke", practises: ["Apotheke"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "الصيدلية" } },
          { type: "multiple_choice", answer: "zehn Minuten", options: ["zehn Minuten", "fünf Minuten", "eine Stunde"],
            instruction: { ar: "حسب الحوار: كم تستغرق المسافة سيراً؟" }, prompt: { de: "Wie lange zu Fuß?" } },
          { type: "self_assessed",
            instruction: { ar: "اشرح الطريق من بيتك إلى أقرب سوبر ماركت في أربع جمل." },
            prompt: { de: "Gehen Sie …" } }
        ],
        review: { ar: "الأمر المهذّب: الفعل أولاً ثم Sie. وmit/zu/von/bei/nach/aus دائماً جر." }
      },
      {
        slug: "a1-l16-modalverben", ordering: 2,
        title: { de: "können, müssen, wollen", en: "can, must, want", ar: "الأفعال الناقصة" },
        objective: { ar: "تعبّر عن القدرة والضرورة والرغبة." },
        context: { ar: "تنظّم أسبوعك: ماذا يجب أن تفعل وماذا تستطيع وماذا تريد." },
        canDo: { ar: "أستطيع قول ما أستطيعه وما يجب عليّ وما أريده." },
        vocabulary: [
          { de: "können", ar: "يستطيع", en: "can, to be able", wordClass: "verb" },
          { de: "müssen", ar: "يجب عليه", en: "must", wordClass: "verb" },
          { de: "wollen", ar: "يريد", en: "to want", wordClass: "verb" },
          { de: "dürfen", ar: "يُسمح له", en: "may, to be allowed", wordClass: "verb" },
          { de: "helfen", ar: "يساعد", en: "to help", wordClass: "verb" },
          { de: "lernen", ar: "يتعلّم", en: "to learn", wordClass: "verb" },
          { de: "Termin", article: "der", plural: "Termine", ar: "الموعد", en: "appointment", wordClass: "noun", key: "TerminU7" },
          { de: "leider", ar: "للأسف", en: "unfortunately", wordClass: "word" },
          { de: "vielleicht", ar: "ربما", en: "maybe", wordClass: "word" },
          { de: "zusammen", ar: "معاً", en: "together", wordClass: "word", key: "zusammenU7" }
        ],
        sentences: [
          { de: "Ich kann ein bisschen Deutsch sprechen.", ar: "أستطيع التحدث بالألمانية قليلاً.", en: "I can speak a little German.", uses: ["können"] },
          { de: "Am Montag muss ich arbeiten.", ar: "يوم الاثنين يجب أن أعمل.", en: "On Monday I have to work.", uses: ["müssen"] },
          { de: "Wir wollen zusammen lernen.", ar: "نريد أن نتعلّم معاً.", en: "We want to study together.", uses: ["wollen", "lernen"] },
          { de: "Leider kann ich heute nicht kommen.", ar: "للأسف لا أستطيع المجيء اليوم.", en: "Unfortunately I can't come today.", uses: ["leider", "können"] }
        ],
        grammar: {
          slug: "modalverben",
          title: { de: "Modalverben", en: "Modal verbs", ar: "الأفعال الناقصة" },
          summary: { ar: "فعلان في جملة واحدة: الناقص يُصرَّف، والثاني مصدر في النهاية." },
          rules: [
            {
              slug: "satzklammer",
              title: { de: "Modalverb zweite Position, Infinitiv am Ende", en: "Modal second, infinitive last", ar: "الناقص ثانياً والمصدر أخيراً" },
              explanation: {
                ar: "هذه بنية أساسية في الألمانية تسمّى «قوس الجملة». الفعل الناقص المصرَّف يأخذ المركز الثاني، والفعل الثاني يبقى مصدراً ويذهب إلى آخر الجملة تماماً: «Ich muss heute früh aufstehen». لاحظ أن الفعل المنفصل يبقى موصولاً هنا لأنه في صيغة المصدر.",
                en: "The modal is conjugated in position two; the other verb stays an infinitive at the very end."
              },
              formation: { de: "Ich kann … sprechen. · Ich muss … arbeiten. · Wir wollen … lernen." },
              usage: { ar: "ich وer لهما نفس الصيغة في الأفعال الناقصة: ich kann / er kann." },
              mistake: { ar: "خطأ شائع: «Ich kann sprechen Deutsch». المصدر يجب أن يكون آخر كلمة: «Ich kann Deutsch sprechen»." },
              examples: [
                { de: "Kannst du mir helfen?", ar: "هل يمكنك مساعدتي؟" },
                { de: "Ich muss um sechs Uhr aufstehen.", ar: "يجب أن أستيقظ الساعة السادسة." },
                { de: "Hier darf man nicht rauchen.", ar: "لا يُسمح بالتدخين هنا." }
              ]
            },
            {
              slug: "formen",
              title: { de: "Die Formen", en: "The forms", ar: "التصريف" },
              explanation: {
                ar: "الأفعال الناقصة تغيّر حرف العلة في المفرد، وتعود إليه في الجمع. احفظ الصيغ الثلاث الأولى وستتعرّف على الباقي.",
                en: "Modals change their stem vowel in the singular and return to it in the plural."
              },
              formation: { de: "können: ich kann, du kannst, er kann, wir können · müssen: ich muss, du musst, er muss · wollen: ich will, du willst, er will" },
              examples: [
                { de: "Wir können am Samstag kommen.", ar: "نستطيع المجيء يوم السبت." },
                { de: "Du musst noch üben.", ar: "عليك أن تتمرّن أكثر." }
              ]
            }
          ]
        },
        exercises: [
          { type: "multiple_choice", answer: "Ich kann gut Deutsch sprechen.",
            options: ["Ich kann gut Deutsch sprechen.", "Ich kann sprechen gut Deutsch.", "Ich sprechen kann gut Deutsch."],
            practises: ["satzklammer"], instruction: { ar: "أي جملة صحيحة؟" }, prompt: { de: "können + Deutsch sprechen" } },
          { type: "type_answer", answer: "muss", practises: ["formen"],
            instruction: { ar: "أكمل بالصيغة الصحيحة من müssen." }, prompt: { de: "Ich ___ heute arbeiten." } },
          { type: "type_answer", answer: "kannst", practises: ["formen"],
            instruction: { ar: "أكمل بالصيغة الصحيحة من können." }, prompt: { de: "___ du mir helfen?" } },
          { type: "type_answer", answer: "wollen", practises: ["formen"],
            instruction: { ar: "أكمل بالصيغة الصحيحة من wollen." }, prompt: { de: "Wir ___ zusammen lernen." } },
          { type: "multiple_choice", answer: "aufstehen", options: ["aufstehen", "stehe auf", "auf stehen"],
            practises: ["satzklammer"], instruction: { ar: "أكمل: Ich muss früh ___." }, prompt: { de: "Ich muss früh ___." } },
          { type: "type_answer", answer: "leider", practises: ["leider"],
            instruction: { ar: "اكتب الكلمة الألمانية." }, prompt: { ar: "للأسف" } },
          { type: "self_assessed",
            instruction: { ar: "اكتب أربع جمل: شيء تستطيعه، شيء يجب عليك، شيء تريده، شيء لا يُسمح به." },
            prompt: { de: "Ich kann … Ich muss … Ich will … Man darf nicht …" } }
        ],
        review: { ar: "قوس الجملة: الناقص ثانياً، المصدر آخر كلمة. ich وer متطابقان." },
        mistakes: [{ ar: "«Ich kann sprechen Deutsch» خطأ — المصدر في النهاية." }]
      }
    ]
  },

  /* ==================================================================== unit 8 */
  {
    slug: "termine-und-gesundheit", ordering: 8,
    title: { de: "Termine und Gesundheit", en: "Appointments and health", ar: "المواعيد والصحة" },
    objective: { ar: "تحجز موعداً، وتصف ألماً، وتحكي عمّا حدث بصيغة الماضي." },
    lessons: [
      {
        slug: "a1-l17-beim-arzt", ordering: 1,
        title: { de: "Beim Arzt", en: "At the doctor's", ar: "عند الطبيب" },
        objective: { ar: "تصف ما يؤلمك وتفهم نصيحة الطبيب." },
        context: { ar: "تشعر بالمرض وتذهب إلى العيادة." },
        canDo: { ar: "أستطيع وصف أعراضي عند الطبيب." },
        vocabulary: [
          { de: "Arzt", article: "der", plural: "Ärzte", ar: "الطبيب", en: "doctor", wordClass: "noun" },
          { de: "Kopf", article: "der", plural: "Köpfe", ar: "الرأس", en: "head", wordClass: "noun" },
          { de: "Bauch", article: "der", plural: "Bäuche", ar: "البطن", en: "stomach", wordClass: "noun" },
          { de: "Hals", article: "der", plural: "Hälse", ar: "الحلق؛ الرقبة", en: "throat, neck", wordClass: "noun" },
          { de: "Schmerzen", article: "die", ar: "الآلام", en: "pain", wordClass: "noun" },
          { de: "krank", ar: "مريض", en: "ill", wordClass: "adjective" },
          { de: "Fieber", article: "das", ar: "الحمّى", en: "fever", wordClass: "noun" },
          { de: "Medikament", article: "das", plural: "Medikamente", ar: "الدواء", en: "medicine", wordClass: "noun" },
          { de: "weh|tun", ar: "يؤلم", en: "to hurt", wordClass: "verb", key: "wehtun" },
          { de: "sich aus|ruhen", ar: "يستريح", en: "to rest", wordClass: "verb", key: "ausruhen" }
        ],
        sentences: [
          { de: "Mein Kopf tut weh.", ar: "رأسي يؤلمني.", en: "My head hurts.", uses: ["Kopf", "wehtun"] },
          { de: "Ich habe Fieber und Halsschmerzen.", ar: "عندي حمّى وألم في الحلق.", en: "I have a fever and a sore throat.", uses: ["Fieber", "Hals"] },
          { de: "Seit wann sind Sie krank?", ar: "منذ متى وأنت مريض؟", en: "Since when have you been ill?", uses: ["krank"] },
          { de: "Nehmen Sie dieses Medikament.", ar: "خذ هذا الدواء.", en: "Take this medicine.", uses: ["Medikament"] }
        ],
        grammar: {
          slug: "koerper-und-schmerzen",
          title: { de: "Über Schmerzen sprechen", en: "Talking about pain", ar: "التعبير عن الألم" },
          summary: { ar: "ثلاث طرق شائعة لقول «يؤلمني»." },
          rules: [
            {
              slug: "wehtun",
              title: { de: "weh|tun und Schmerzen haben", en: "wehtun and Schmerzen haben", ar: "wehtun وSchmerzen haben" },
              explanation: {
                ar: "للتعبير عن الألم ثلاث بنى شائعة. الأولى: «Mein Kopf tut weh» — الفعل منفصل، وtut في المركز الثاني وweh في النهاية. الثانية: «Ich habe Kopfschmerzen» — تركيب كلمة واحدة من العضو + Schmerzen. الثالثة والأبسط: «Ich bin krank». الثانية هي الأكثر استعمالاً عند الطبيب.",
                en: "Three ways: Mein Kopf tut weh, Ich habe Kopfschmerzen, Ich bin krank."
              },
              formation: { de: "Mein Hals tut weh. · Ich habe Halsschmerzen. · Meine Füße tun weh." },
              mistake: { ar: "خطأ شائع: «Ich habe weh». الصواب: «Mein Kopf tut weh» أو «Ich habe Kopfschmerzen»." },
              examples: [
                { de: "Mein Bauch tut weh.", ar: "بطني يؤلمني." },
                { de: "Ich habe seit gestern Zahnschmerzen.", ar: "عندي ألم في الأسنان منذ أمس." }
              ]
            }
          ]
        },
        listening: {
          slug: "l17-beim-arzt", activityType: "dialogue",
          title: { de: "In der Praxis", en: "At the practice", ar: "في العيادة" },
          instruction: { ar: "اقرأ الحوار وحدّد الأعراض والنصيحة." },
          speakers: ["Ärztin", "Amir"],
          lines: [
            { speaker: "Ärztin", de: "Guten Tag. Was fehlt Ihnen?", ar: "طاب يومك. ما الذي تشكو منه؟" },
            { speaker: "Amir", de: "Mein Hals tut weh und ich habe Fieber.", ar: "حلقي يؤلمني وعندي حمّى." },
            { speaker: "Ärztin", de: "Seit wann haben Sie das?", ar: "منذ متى وأنت هكذا؟" },
            { speaker: "Amir", de: "Seit zwei Tagen.", ar: "منذ يومين." },
            { speaker: "Ärztin", de: "Sie müssen sich ausruhen und viel trinken.", ar: "يجب أن تستريح وتشرب كثيراً." },
            { speaker: "Ärztin", de: "Nehmen Sie dieses Medikament dreimal am Tag.", ar: "خذ هذا الدواء ثلاث مرات يومياً." }
          ]
        },
        exercises: [
          { type: "type_answer", answer: "weh", practises: ["wehtun"],
            instruction: { ar: "أكمل الجملة." }, prompt: { de: "Mein Kopf tut ___." } },
          { type: "multiple_choice", answer: "Ich habe Halsschmerzen.",
            options: ["Ich habe Halsschmerzen.", "Ich habe weh Hals.", "Mein Hals hat Schmerzen weh."],
            practises: ["wehtun"], instruction: { ar: "أي جملة صحيحة؟" }, prompt: { de: "Hals + Schmerzen" } },
          { type: "type_answer", answer: "der Arzt", practises: ["Arzt"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "الطبيب" } },
          { type: "type_answer", answer: "das Fieber", practises: ["Fieber"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "الحمّى" } },
          { type: "type_answer", answer: "krank", practises: ["krank"],
            instruction: { ar: "اكتب الصفة الألمانية." }, prompt: { ar: "مريض" } },
          { type: "multiple_choice", answer: "Seit zwei Tagen", options: ["Seit zwei Tagen", "Seit einer Woche", "Seit gestern"],
            instruction: { ar: "حسب الحوار: منذ متى وأمير مريض؟" }, prompt: { de: "Seit wann?" } },
          { type: "self_assessed",
            instruction: { ar: "اكتب حواراً قصيراً عند الطبيب: العرض، المدة، والنصيحة." },
            prompt: { de: "— Was fehlt Ihnen? — …" } }
        ],
        review: { ar: "«Mein Kopf tut weh» أو «Ich habe Kopfschmerzen». كلاهما صحيح ومستعمل." }
      },
      {
        slug: "a1-l18-perfekt", ordering: 2,
        title: { de: "Was hast du gemacht?", en: "What did you do?", ar: "ماذا فعلت؟" },
        objective: { ar: "تحكي عمّا فعلته أمس أو في عطلة الأسبوع بصيغة الماضي المركّب." },
        context: { ar: "زميل يسألك: كيف كانت عطلتك؟" },
        canDo: { ar: "أستطيع الحديث عن الماضي القريب بجمل بسيطة." },
        vocabulary: [
          { de: "gestern", ar: "أمس", en: "yesterday", wordClass: "word" },
          { de: "Wochenende", article: "das", plural: "Wochenenden", ar: "عطلة نهاية الأسبوع", en: "weekend", wordClass: "noun" },
          { de: "machen", ar: "يفعل", en: "to do, make", wordClass: "verb" },
          { de: "besuchen", ar: "يزور", en: "to visit", wordClass: "verb" },
          { de: "treffen", ar: "يقابل", en: "to meet", wordClass: "verb" },
          { de: "bleiben", ar: "يبقى", en: "to stay", wordClass: "verb" },
          { de: "gehen", ar: "يذهب", en: "to go", wordClass: "verb" },
          { de: "Park", article: "der", plural: "Parks", ar: "الحديقة العامة", en: "park", wordClass: "noun" },
          { de: "schön", ar: "جميل", en: "nice, beautiful", wordClass: "adjective" },
          { de: "müde", ar: "متعب", en: "tired", wordClass: "adjective" }
        ],
        sentences: [
          { de: "Gestern habe ich meine Familie besucht.", ar: "أمس زرت عائلتي.", en: "Yesterday I visited my family.", uses: ["gestern", "besuchen"] },
          { de: "Am Wochenende bin ich zu Hause geblieben.", ar: "في عطلة الأسبوع بقيت في البيت.", en: "At the weekend I stayed home.", uses: ["Wochenende", "bleiben"] },
          { de: "Wir sind in den Park gegangen.", ar: "ذهبنا إلى الحديقة.", en: "We went to the park.", uses: ["gehen", "Park"] },
          { de: "Was hast du am Samstag gemacht?", ar: "ماذا فعلت يوم السبت؟", en: "What did you do on Saturday?", uses: ["machen"] }
        ],
        grammar: {
          slug: "perfekt",
          title: { de: "Das Perfekt", en: "The present perfect", ar: "الماضي المركّب" },
          summary: { ar: "الزمن الذي يستخدمه الألمان للحديث عن الماضي في الكلام اليومي." },
          rules: [
            {
              slug: "perfekt-haben",
              title: { de: "haben + Partizip II", en: "haben + past participle", ar: "haben مع اسم المفعول" },
              explanation: {
                ar: "معظم الأفعال تبني الماضي المركّب بـ haben مصرَّفاً في المركز الثاني، واسم المفعول في آخر الجملة. اسم المفعول للأفعال المنتظمة: ge + جذر + t، مثل machen ← gemacht، besuchen ← besucht (بلا ge لأنها تبدأ بـ be-). الأفعال الشاذة لها صيغ تُحفظ: treffen ← getroffen، essen ← gegessen.",
                en: "Most verbs form the Perfekt with haben plus a participle at the end: ge- + stem + -t."
              },
              formation: { de: "machen → gemacht · lernen → gelernt · besuchen → besucht · treffen → getroffen" },
              usage: { ar: "هذا هو زمن الماضي المستخدم في الحديث. أما «war» و«hatte» فتُستعملان أكثر من صيغتيهما المركّبة." },
              mistake: { ar: "خطأ شائع: «Ich habe gemacht meine Hausaufgaben». اسم المفعول آخر كلمة: «Ich habe meine Hausaufgaben gemacht»." },
              examples: [
                { de: "Ich habe Deutsch gelernt.", ar: "تعلّمت الألمانية." },
                { de: "Wir haben einen Film gesehen.", ar: "شاهدنا فيلماً." }
              ]
            },
            {
              slug: "perfekt-sein",
              title: { de: "sein + Partizip II bei Bewegung", en: "sein for movement and change", ar: "sein مع أفعال الحركة" },
              explanation: {
                ar: "مجموعة مهمة من الأفعال تبني الماضي بـ sein لا haben: أفعال الحركة من مكان إلى مكان (gehen، fahren، kommen، fliegen)، وأفعال تغيّر الحالة (aufstehen، einschlafen)، وثلاثة استثناءات تُحفظ: sein، bleiben، werden. مثال: «Ich bin nach Berlin gefahren»، «Ich bin zu Hause geblieben».",
                en: "Verbs of movement or change of state take sein, plus sein, bleiben and werden."
              },
              formation: { de: "gehen → ist gegangen · fahren → ist gefahren · kommen → ist gekommen · bleiben → ist geblieben" },
              mistake: { ar: "خطأ شائع: «Ich habe nach Berlin gefahren». الصواب «Ich bin nach Berlin gefahren»." },
              examples: [
                { de: "Ich bin gestern spät gekommen.", ar: "أتيت متأخراً أمس." },
                { de: "Sie ist nach Hause gegangen.", ar: "ذهبت إلى البيت." }
              ]
            }
          ]
        },
        exercises: [
          { type: "type_answer", answer: "gemacht", practises: ["perfekt-haben"],
            instruction: { ar: "أكمل باسم المفعول من machen." }, prompt: { de: "Was hast du gestern ___?" } },
          { type: "type_answer", answer: "gelernt", practises: ["perfekt-haben"],
            instruction: { ar: "أكمل باسم المفعول من lernen." }, prompt: { de: "Ich habe Deutsch ___." } },
          { type: "multiple_choice", answer: "bin", options: ["habe", "bin", "war"], practises: ["perfekt-sein"],
            instruction: { ar: "اختر الفعل المساعد الصحيح." }, prompt: { de: "Ich ___ nach Berlin gefahren." } },
          { type: "multiple_choice", answer: "habe", options: ["habe", "bin", "ist"], practises: ["perfekt-haben"],
            instruction: { ar: "اختر الفعل المساعد الصحيح." }, prompt: { de: "Ich ___ meine Familie besucht." } },
          { type: "multiple_choice", answer: "Ich habe einen Film gesehen.",
            options: ["Ich habe einen Film gesehen.", "Ich habe gesehen einen Film.", "Ich gesehen habe einen Film."],
            practises: ["perfekt-haben"], instruction: { ar: "أي جملة صحيحة؟" }, prompt: { de: "sehen + Film" } },
          { type: "type_answer", answer: "geblieben", practises: ["perfekt-sein"],
            instruction: { ar: "أكمل باسم المفعول من bleiben." }, prompt: { de: "Ich bin zu Hause ___." } },
          { type: "type_answer", answer: "das Wochenende", practises: ["Wochenende"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "عطلة نهاية الأسبوع" } },
          { type: "self_assessed",
            instruction: { ar: "اكتب خمس جمل عن عطلتك الماضية مستخدماً haben وsein." },
            prompt: { de: "Am Wochenende habe ich … und ich bin …" } }
        ],
        review: { ar: "haben لمعظم الأفعال، sein للحركة وتغيّر الحالة وbleiben/sein/werden. اسم المفعول آخر كلمة." },
        mistakes: [{ ar: "«Ich habe gefahren» خطأ — الصواب «Ich bin gefahren»." }]
      }
    ]
  }
];
