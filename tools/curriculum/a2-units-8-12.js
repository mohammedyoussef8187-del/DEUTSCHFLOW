/*
 * DeutschFlow A2 — units 8 to 12.
 *
 * The open-content lessons that already sit at A2 cover the situations: services, family,
 * travel, health, housing and work, education, the city. What they do not yet cover is the
 * language that turns situations into conversation — giving a reason, stating an opinion,
 * making a plan conditional, comparing two things, writing to someone you do not know, and
 * telling a story that happened. These units add that, and they are numbered to continue
 * the existing seven rather than to replace them.
 */

export const A2_UNITS = [
  /* ==================================================================== unit 8 */
  {
    slug: "gruende-und-meinungen", ordering: 8,
    title: { de: "Gründe und Meinungen", en: "Reasons and opinions", ar: "الأسباب والآراء" },
    objective: { ar: "تعطي سبباً، وتعبّر عن رأيك، وتربط جملتين بجملة تابعة." },
    lessons: [
      {
        slug: "a2-l08-warum-weil", ordering: 1,
        title: { de: "Warum? — weil, denn, deshalb", en: "Why? weil, denn, deshalb", ar: "لماذا؟ weil وdenn وdeshalb" },
        objective: { ar: "تجيب على سؤال «لماذا» بثلاث طرق مختلفة وتعرف ترتيب الفعل في كل منها." },
        context: { ar: "زميلك يسألك لماذا تتعلّم الألمانية ولماذا تأخّرت اليوم." },
        canDo: { ar: "أستطيع شرح أسبابي في جملة مركّبة." },
        vocabulary: [
          { de: "weil", ar: "لأنّ (تُؤخِّر الفعل)", en: "because", wordClass: "conjunction" },
          { de: "denn", ar: "لأنّ (لا تغيّر الترتيب)", en: "because, for", wordClass: "conjunction" },
          { de: "deshalb", ar: "لذلك", en: "therefore", wordClass: "conjunction" },
          { de: "der Grund", article: "der", plural: "Gründe", ar: "السبب", en: "reason", wordClass: "noun", key: "Grund" },
          { de: "wichtig", ar: "مهم", en: "important", wordClass: "adjective" },
          { de: "brauchen", ar: "يحتاج", en: "to need", wordClass: "verb" },
          { de: "verstehen", ar: "يفهم", en: "to understand", wordClass: "verb" },
          { de: "die Verspätung", article: "die", plural: "Verspätungen", ar: "التأخير", en: "delay", wordClass: "noun", key: "Verspaetung" },
          { de: "beruflich", ar: "مهنيّاً", en: "professionally", wordClass: "adjective" },
          { de: "eigentlich", ar: "في الحقيقة", en: "actually", wordClass: "word" }
        ],
        sentences: [
          { de: "Ich lerne Deutsch, weil ich hier arbeiten möchte.", ar: "أتعلّم الألمانية لأنني أريد العمل هنا.", en: "I'm learning German because I want to work here.", uses: ["weil"] },
          { de: "Ich komme zu spät, denn der Bus hatte Verspätung.", ar: "تأخّرت لأن الحافلة تأخّرت.", en: "I'm late because the bus was delayed.", uses: ["denn", "Verspaetung"] },
          { de: "Der Bus hatte Verspätung, deshalb komme ich zu spät.", ar: "الحافلة تأخّرت، لذلك تأخّرت.", en: "The bus was delayed, so I'm late.", uses: ["deshalb"] },
          { de: "Deutsch ist für mich beruflich wichtig.", ar: "الألمانية مهمة لي مهنيّاً.", en: "German is professionally important for me.", uses: ["beruflich", "wichtig"] }
        ],
        grammar: {
          slug: "nebensatz-weil",
          title: { de: "Der Nebensatz mit weil", en: "Subordinate clauses with weil", ar: "الجملة التابعة مع weil" },
          summary: { ar: "ثلاث أدوات لنفس المعنى، وثلاثة ترتيبات مختلفة للفعل." },
          rules: [
            {
              slug: "weil-verb-ende",
              title: { de: "weil → Verb am Ende", en: "weil sends the verb to the end", ar: "weil تُرسل الفعل إلى النهاية" },
              explanation: {
                ar: "«weil» تبدأ جملة تابعة، وفي الجملة التابعة الألمانية يذهب الفعل المصرَّف إلى آخر الجملة: «Ich lerne Deutsch, weil ich hier arbeiten möchte». لاحظ أن möchte — وهو الفعل المصرَّف — جاء بعد المصدر arbeiten، أي في النهاية تماماً. الفاصلة قبل weil إلزامية.",
                en: "weil starts a subordinate clause; its conjugated verb goes to the very end, after a comma."
              },
              formation: { de: "Hauptsatz, weil + Subjekt + … + Verb. · Ich bleibe zu Hause, weil ich krank bin." },
              usage: { ar: "يمكن أيضاً أن تبدأ الجملة بـ weil، وعندها يأتي الفعل الرئيسي مباشرة بعد الفاصلة: «Weil ich krank bin, bleibe ich zu Hause»." },
              mistake: { ar: "خطأ شائع: «weil ich bin krank». في الجملة التابعة الفعل آخر كلمة: «weil ich krank bin»." },
              examples: [
                { de: "Ich kaufe das nicht, weil es zu teuer ist.", ar: "لن أشتري هذا لأنه غالٍ جداً." },
                { de: "Weil ich müde bin, gehe ich früh ins Bett.", ar: "لأنني متعب، سأنام مبكراً." }
              ]
            },
            {
              slug: "denn-deshalb",
              title: { de: "denn und deshalb", en: "denn and deshalb", ar: "denn وdeshalb" },
              explanation: {
                ar: "«denn» تعني نفس معنى weil لكنها لا تغيّر شيئاً: بعدها جملة رئيسية عادية بالفعل في المركز الثاني. أما «deshalb» فمعناها معكوس — تقدّم النتيجة لا السبب — وهي تشغل المركز الأول، فيأتي الفعل مباشرة بعدها ثم الفاعل.",
                en: "denn keeps normal main-clause order; deshalb states the result and takes first position, so the verb follows it."
              },
              formation: { de: "…, denn ich bin krank. · Ich bin krank, deshalb bleibe ich zu Hause." },
              mistake: { ar: "خطأ شائع: «deshalb ich bleibe zu Hause». بعد deshalb يأتي الفعل: «deshalb bleibe ich»." },
              examples: [
                { de: "Ich gehe nicht mit, denn ich habe keine Zeit.", ar: "لن أذهب معكم، لأنه ليس لديّ وقت." },
                { de: "Ich habe keine Zeit, deshalb gehe ich nicht mit.", ar: "ليس لديّ وقت، لذلك لن أذهب معكم." }
              ]
            }
          ]
        },
        exercises: [
          { type: "multiple_choice", answer: "weil ich krank bin",
            options: ["weil ich krank bin", "weil ich bin krank", "weil bin ich krank"],
            practises: ["weil-verb-ende"], instruction: { ar: "أي جملة تابعة صحيحة؟" },
            prompt: { de: "Ich bleibe zu Hause, ___." } },
          { type: "type_answer", answer: "ist", practises: ["weil-verb-ende"],
            instruction: { ar: "ضع الفعل في مكانه الصحيح." }, prompt: { de: "Ich kaufe es nicht, weil es zu teuer ___." } },
          { type: "multiple_choice", answer: "bleibe ich", options: ["bleibe ich", "ich bleibe", "ich bin bleibe"],
            practises: ["denn-deshalb"], instruction: { ar: "أكمل بعد deshalb." },
            prompt: { de: "Ich bin krank, deshalb ___ zu Hause." } },
          { type: "multiple_choice", answer: "denn", options: ["denn", "weil", "deshalb"],
            practises: ["denn-deshalb"], instruction: { ar: "أي أداة تُبقي ترتيب الجملة الرئيسية؟" },
            prompt: { de: "Ich komme nicht, ___ ich habe keine Zeit." } },
          { type: "order_tokens", answer: "weil ich hier arbeiten möchte",
            tokens: ["weil", "ich", "hier", "arbeiten", "möchte"], practises: ["weil-verb-ende"],
            instruction: { ar: "رتّب الجملة التابعة." }, prompt: { de: "Ich lerne Deutsch, …" } },
          { type: "type_answer", answer: "der Grund", practises: ["Grund"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "السبب" } },
          { type: "type_answer", answer: "die Verspätung", practises: ["Verspaetung"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "التأخير" } },
          { type: "self_assessed",
            instruction: { ar: "اكتب ثلاث جمل بـ weil، وحوّل واحدة منها إلى deshalb." },
            prompt: { de: "Ich lerne Deutsch, weil … / …, deshalb …" } }
        ],
        review: { ar: "weil ← الفعل في النهاية. denn ← لا تغيير. deshalb ← الفعل بعدها مباشرة." },
        mistakes: [{ ar: "«weil ich bin krank» و«deshalb ich bleibe» خطآن في ترتيب الفعل." }]
      },
      {
        slug: "a2-l09-meinung-dass", ordering: 2,
        title: { de: "Ich glaube, dass …", en: "I think that …", ar: "أعتقد أنّ…" },
        objective: { ar: "تعبّر عن رأيك واتفاقك واختلافك بجملة dass." },
        context: { ar: "نقاش في الصف: هل تعلّم اللغة أسهل للأطفال؟" },
        canDo: { ar: "أستطيع قول رأيي والموافقة أو الاعتراض بأدب." },
        vocabulary: [
          { de: "dass", ar: "أنّ", en: "that", wordClass: "conjunction" },
          { de: "die Meinung", article: "die", plural: "Meinungen", ar: "الرأي", en: "opinion", wordClass: "noun", key: "Meinung" },
          { de: "glauben", ar: "يعتقد", en: "to believe", wordClass: "verb" },
          { de: "finden", ar: "يجد؛ يرى", en: "to find, think", wordClass: "verb" },
          { de: "recht haben", ar: "يكون على حق", en: "to be right", wordClass: "phrase", key: "rechthaben" },
          { de: "stimmen", ar: "يكون صحيحاً", en: "to be true", wordClass: "verb" },
          { de: "einverstanden", ar: "موافق", en: "in agreement", wordClass: "adjective" },
          { de: "vielleicht", ar: "ربما", en: "perhaps", wordClass: "word", key: "vielleichtA2" },
          { de: "leicht", ar: "سهل", en: "easy", wordClass: "adjective" },
          { de: "schwierig", ar: "صعب", en: "difficult", wordClass: "adjective" }
        ],
        sentences: [
          { de: "Ich glaube, dass Kinder schneller lernen.", ar: "أعتقد أن الأطفال يتعلّمون أسرع.", en: "I think children learn faster.", uses: ["dass", "glauben"] },
          { de: "Ich finde, dass Deutsch nicht so schwierig ist.", ar: "أرى أن الألمانية ليست بهذه الصعوبة.", en: "I find German isn't that hard.", uses: ["finden", "schwierig"] },
          { de: "Da bin ich nicht ganz einverstanden.", ar: "لست موافقاً تماماً على ذلك.", en: "I don't entirely agree.", uses: ["einverstanden"] },
          { de: "Das stimmt, aber es ist nicht immer so.", ar: "هذا صحيح، لكنه ليس دائماً كذلك.", en: "That's true, but it isn't always so.", uses: ["stimmen"] }
        ],
        grammar: {
          slug: "nebensatz-dass",
          title: { de: "Nebensätze mit dass", en: "dass clauses", ar: "الجملة التابعة مع dass" },
          summary: { ar: "كيف تُدخل رأياً أو معلومة داخل جملتك." },
          rules: [
            {
              slug: "dass-satz",
              title: { de: "dass + Verb am Ende", en: "dass sends the verb to the end", ar: "dass والفعل في النهاية" },
              explanation: {
                ar: "«dass» تعمل مثل weil تماماً من حيث الترتيب: الفعل المصرَّف يذهب إلى آخر الجملة التابعة. تُستعمل بعد أفعال الرأي والمعرفة والقول: glauben، finden، denken، wissen، sagen، hoffen. لاحظ الفارق عن العربية: «أعتقد أنّ الألمانية سهلة» ← «Ich glaube, dass Deutsch leicht ist» — الفعل ist في النهاية.",
                en: "dass behaves like weil: the conjugated verb goes last. Used after glauben, finden, denken, wissen, sagen, hoffen."
              },
              formation: { de: "Ich glaube, dass … ist. · Ich weiß, dass er morgen kommt. · Ich hoffe, dass du Zeit hast." },
              usage: { ar: "في الكلام اليومي يمكن حذف dass، وعندها يبقى الترتيب عادياً: «Ich glaube, Deutsch ist leicht». الصيغتان صحيحتان." },
              mistake: { ar: "خطأ شائع: «Ich glaube, dass Deutsch ist leicht». مع dass الفعل في النهاية." },
              examples: [
                { de: "Ich denke, dass wir genug Zeit haben.", ar: "أظن أن لدينا وقتاً كافياً." },
                { de: "Wissen Sie, dass der Kurs morgen beginnt?", ar: "هل تعلم أن الدورة تبدأ غداً؟" }
              ]
            },
            {
              slug: "zustimmen",
              title: { de: "Zustimmen und widersprechen", en: "Agreeing and disagreeing", ar: "الموافقة والاعتراض" },
              explanation: {
                ar: "في A2 يكفي أن تملك أربع عبارات ثابتة للموافقة والاعتراض، وأن تعرف أن الاعتراض المهذّب يبدأ عادة بموافقة جزئية ثم aber.",
                en: "A small set of fixed phrases; polite disagreement usually starts with partial agreement, then aber."
              },
              formation: { de: "Das stimmt. · Du hast recht. · Da bin ich nicht einverstanden. · Das sehe ich anders." },
              examples: [
                { de: "Das stimmt, aber es ist nicht immer einfach.", ar: "هذا صحيح، لكنه ليس سهلاً دائماً." },
                { de: "Das sehe ich anders.", ar: "أرى الأمر بشكل مختلف." }
              ]
            }
          ]
        },
        listening: {
          slug: "a2-l09-diskussion", activityType: "dialogue",
          title: { de: "Eine kurze Diskussion", en: "A short discussion", ar: "نقاش قصير" },
          instruction: { ar: "اقرأ النقاش ولاحظ كيف يعبّر كلٌّ عن رأيه." },
          speakers: ["Lena", "Amir"],
          lines: [
            { speaker: "Lena", de: "Ich glaube, dass Kinder Sprachen schneller lernen.", ar: "أعتقد أن الأطفال يتعلّمون اللغات أسرع." },
            { speaker: "Amir", de: "Das stimmt, aber Erwachsene lernen systematischer.", ar: "هذا صحيح، لكن الكبار يتعلّمون بطريقة أكثر منهجية." },
            { speaker: "Lena", de: "Da hast du recht. Warum lernst du eigentlich Deutsch?", ar: "أنت محق. لماذا تتعلّم الألمانية أصلاً؟" },
            { speaker: "Amir", de: "Weil ich hier als Ingenieur arbeiten möchte.", ar: "لأنني أريد العمل هنا كمهندس." },
            { speaker: "Lena", de: "Ich finde, dass das ein guter Grund ist.", ar: "أرى أن هذا سبب وجيه." }
          ]
        },
        exercises: [
          { type: "multiple_choice", answer: "dass Deutsch leicht ist",
            options: ["dass Deutsch leicht ist", "dass Deutsch ist leicht", "dass ist Deutsch leicht"],
            practises: ["dass-satz"], instruction: { ar: "أي جملة صحيحة؟" }, prompt: { de: "Ich glaube, ___." } },
          { type: "type_answer", answer: "kommt", practises: ["dass-satz"],
            instruction: { ar: "ضع الفعل في مكانه." }, prompt: { de: "Ich weiß, dass er morgen ___." } },
          { type: "order_tokens", answer: "dass wir genug Zeit haben",
            tokens: ["dass", "wir", "genug", "Zeit", "haben"], practises: ["dass-satz"],
            instruction: { ar: "رتّب الجملة التابعة." }, prompt: { de: "Ich denke, …" } },
          { type: "multiple_choice", answer: "Das stimmt.", options: ["Das stimmt.", "Das stimme.", "Das ist stimmt."],
            practises: ["zustimmen"], instruction: { ar: "أي عبارة موافقة صحيحة؟" }, prompt: { de: "— Deutsch ist nützlich. — ___" } },
          { type: "type_answer", answer: "die Meinung", practises: ["Meinung"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "الرأي" } },
          { type: "type_answer", answer: "schwierig", practises: ["schwierig"],
            instruction: { ar: "اكتب الصفة الألمانية." }, prompt: { ar: "صعب" } },
          { type: "multiple_choice", answer: "Er möchte hier als Ingenieur arbeiten.",
            options: ["Er möchte hier als Ingenieur arbeiten.", "Er hat Kinder.", "Er findet Deutsch zu schwierig."],
            instruction: { ar: "حسب الحوار: لماذا يتعلّم أمير الألمانية؟" }, prompt: { de: "Warum lernt Amir Deutsch?" } },
          { type: "self_assessed",
            instruction: { ar: "اكتب رأيك في أربع جمل: رأي بـ dass، سبب بـ weil، اعتراض مهذّب، وخلاصة." },
            prompt: { de: "Ich finde, dass … weil … Das stimmt, aber …" } }
        ],
        review: { ar: "dass مثل weil: الفعل في النهاية. وحذف dass جائز مع بقاء الترتيب العادي." }
      }
    ]
  },

  /* ==================================================================== unit 9 */
  {
    slug: "plaene-und-bedingungen", ordering: 9,
    title: { de: "Pläne und Bedingungen", en: "Plans and conditions", ar: "الخطط والشروط" },
    objective: { ar: "تتحدث عن المستقبل وتضع شروطاً باستخدام wenn." },
    lessons: [
      {
        slug: "a2-l10-zukunft", ordering: 1,
        title: { de: "Pläne machen", en: "Making plans", ar: "وضع الخطط" },
        objective: { ar: "تعبّر عن نيّتك وخططك المستقبلية." },
        context: { ar: "تخطّط للعام القادم: دورة لغة، عمل، سفر." },
        canDo: { ar: "أستطيع الحديث عن خططي القريبة والبعيدة." },
        vocabulary: [
          { de: "werden", ar: "يصبح؛ (فعل مساعد للمستقبل)", en: "will, to become", wordClass: "verb" },
          { de: "vorhaben", ar: "ينوي", en: "to intend", wordClass: "verb", key: "vorhaben" },
          { de: "planen", ar: "يخطّط", en: "to plan", wordClass: "verb" },
          { de: "die Zukunft", article: "die", ar: "المستقبل", en: "future", wordClass: "noun", key: "Zukunft" },
          { de: "nächstes Jahr", ar: "العام القادم", en: "next year", wordClass: "phrase", key: "naechstesJahr" },
          { de: "die Prüfung", article: "die", plural: "Prüfungen", ar: "الامتحان", en: "exam", wordClass: "noun", key: "Pruefung" },
          { de: "die Stelle", article: "die", plural: "Stellen", ar: "الوظيفة", en: "position, job", wordClass: "noun", key: "Stelle" },
          { de: "umziehen", ar: "ينتقل للسكن", en: "to move house", wordClass: "verb", key: "umziehen" },
          { de: "sparen", ar: "يوفّر المال", en: "to save", wordClass: "verb" },
          { de: "hoffentlich", ar: "آمل أن", en: "hopefully", wordClass: "word" }
        ],
        sentences: [
          { de: "Nächstes Jahr werde ich die B1-Prüfung machen.", ar: "العام القادم سأتقدّم لامتحان B1.", en: "Next year I'll take the B1 exam.", uses: ["werden", "Pruefung", "naechstesJahr"] },
          { de: "Ich habe vor, eine neue Stelle zu suchen.", ar: "أنوي البحث عن وظيفة جديدة.", en: "I intend to look for a new job.", uses: ["vorhaben", "Stelle"] },
          { de: "Im Sommer ziehen wir nach Hamburg um.", ar: "في الصيف سننتقل إلى هامبورغ.", en: "In summer we're moving to Hamburg.", uses: ["umziehen"] },
          { de: "Hoffentlich finde ich bald etwas.", ar: "آمل أن أجد شيئاً قريباً.", en: "Hopefully I'll find something soon.", uses: ["hoffentlich"] }
        ],
        grammar: {
          slug: "zukunft",
          title: { de: "Über die Zukunft sprechen", en: "Talking about the future", ar: "الحديث عن المستقبل" },
          summary: { ar: "الألمانية تتحدث عن المستقبل بالمضارع في أغلب الأحيان." },
          rules: [
            {
              slug: "praesens-zukunft",
              title: { de: "Präsens + Zeitangabe", en: "Present tense plus a time word", ar: "المضارع مع ظرف زمان" },
              explanation: {
                ar: "أهم ما يجب أن تعرفه: الألمان يعبّرون عن المستقبل بالمضارع العادي مع كلمة تدل على الزمن — «Morgen fahre ich nach Berlin»، «Nächstes Jahr mache ich die Prüfung». هذه هي الصيغة الطبيعية في الكلام اليومي، ولا حاجة لـ werden.",
                en: "German normally expresses the future with the present tense plus a time expression."
              },
              formation: { de: "morgen / nächste Woche / nächstes Jahr / im Sommer + Präsens" },
              mistake: { ar: "ليس خطأً استعمال werden، لكن الإفراط فيه يجعل كلامك غير طبيعي. ابدأ بالمضارع." },
              examples: [
                { de: "Am Wochenende besuche ich meine Familie.", ar: "في عطلة الأسبوع سأزور عائلتي." },
                { de: "Nächste Woche beginnt der Kurs.", ar: "الأسبوع القادم تبدأ الدورة." }
              ]
            },
            {
              slug: "werden-futur",
              title: { de: "werden + Infinitiv", en: "werden plus infinitive", ar: "werden مع المصدر" },
              explanation: {
                ar: "عندما تريد التأكيد على المستقبل، أو تعِد بشيء، أو تتنبّأ، تستعمل werden مصرَّفاً في المركز الثاني والمصدر في النهاية — نفس قوس الجملة الذي تعرفه من الأفعال الناقصة. تصريف werden: ich werde, du wirst, er wird, wir werden, ihr werdet, sie werden.",
                en: "werden in position two plus an infinitive at the end, used for emphasis, promises and predictions."
              },
              formation: { de: "Ich werde die Prüfung machen. · Er wird bestimmt kommen. · Wir werden umziehen." },
              mistake: { ar: "خطأ شائع: «Ich werde machen die Prüfung». المصدر آخر كلمة." },
              examples: [
                { de: "Ich werde dir helfen.", ar: "سأساعدك." },
                { de: "Das wird nicht einfach.", ar: "لن يكون هذا سهلاً." }
              ]
            },
            {
              slug: "vorhaben-zu",
              title: { de: "vorhaben und Infinitiv mit zu", en: "vorhaben and the zu-infinitive", ar: "vorhaben والمصدر مع zu" },
              explanation: {
                ar: "بعض الأفعال والتعابير تتبعها جملة مصدرية بـ zu: «Ich habe vor, … zu machen»، «Ich hoffe, … zu finden»، «Es ist wichtig, … zu lernen». القاعدة: zu قبل المصدر مباشرة في آخر الجملة، وفي الفعل المنفصل تدخل zu في المنتصف: einkaufen ← einzukaufen.",
                en: "Some verbs take a zu-infinitive at the end; with separable verbs zu goes inside: einzukaufen."
              },
              formation: { de: "Ich habe vor, eine Stelle zu suchen. · Ich hoffe, bald umzuziehen." },
              mistake: { ar: "خطأ شائع: «Ich habe vor eine Stelle suchen». يجب zu قبل المصدر وفاصلة قبل الجملة المصدرية." },
              examples: [
                { de: "Es ist wichtig, jeden Tag zu üben.", ar: "من المهم أن تتمرّن كل يوم." },
                { de: "Ich versuche, mehr zu sparen.", ar: "أحاول أن أوفّر أكثر." }
              ]
            }
          ]
        },
        exercises: [
          { type: "type_answer", answer: "werde", practises: ["werden-futur"],
            instruction: { ar: "أكمل بالصيغة الصحيحة من werden." }, prompt: { de: "Ich ___ dir helfen." } },
          { type: "type_answer", answer: "wird", practises: ["werden-futur"],
            instruction: { ar: "أكمل بالصيغة الصحيحة من werden." }, prompt: { de: "Er ___ bestimmt kommen." } },
          { type: "multiple_choice", answer: "Ich werde die Prüfung machen.",
            options: ["Ich werde die Prüfung machen.", "Ich werde machen die Prüfung.", "Ich machen werde die Prüfung."],
            practises: ["werden-futur"], instruction: { ar: "أي جملة صحيحة؟" }, prompt: { de: "werden + Prüfung machen" } },
          { type: "type_answer", answer: "zu suchen", practises: ["vorhaben-zu"],
            instruction: { ar: "أكمل الجملة المصدرية." }, prompt: { de: "Ich habe vor, eine Stelle ___." } },
          { type: "multiple_choice", answer: "umzuziehen", options: ["umzuziehen", "zu umziehen", "umziehen zu"],
            practises: ["vorhaben-zu"], instruction: { ar: "ما الصيغة الصحيحة للفعل المنفصل؟" },
            prompt: { de: "Ich hoffe, bald ___." } },
          { type: "type_answer", answer: "die Prüfung", practises: ["Pruefung"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "الامتحان" } },
          { type: "type_answer", answer: "die Zukunft", practises: ["Zukunft"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "المستقبل" } },
          { type: "self_assessed",
            instruction: { ar: "اكتب خطتك للعام القادم في خمس جمل، وأدخل جملة واحدة بـ «Ich habe vor, … zu …»." },
            prompt: { de: "Nächstes Jahr … Ich habe vor, … zu …" } }
        ],
        review: { ar: "المستقبل عادةً بالمضارع + ظرف زمان. werden للتأكيد. zu قبل المصدر، وداخل الفعل المنفصل." }
      },
      {
        slug: "a2-l11-wenn", ordering: 2,
        title: { de: "wenn — Bedingungen und Gewohnheiten", en: "wenn — conditions and habits", ar: "wenn — الشرط والعادة" },
        objective: { ar: "تضع شرطاً وتتحدث عن عادة متكرّرة بجملة wenn." },
        context: { ar: "تتفق مع صديق: إذا كان الطقس جميلاً نخرج، وإلا نبقى." },
        canDo: { ar: "أستطيع ربط شرط بنتيجة." },
        vocabulary: [
          { de: "wenn", ar: "إذا؛ عندما", en: "if, when", wordClass: "conjunction" },
          { de: "dann", ar: "عندئذٍ", en: "then", wordClass: "word" },
          { de: "das Wetter", article: "das", ar: "الطقس", en: "weather", wordClass: "noun", key: "Wetter" },
          { de: "regnen", ar: "تمطر", en: "to rain", wordClass: "verb" },
          { de: "die Zeit", article: "die", plural: "Zeiten", ar: "الوقت", en: "time", wordClass: "noun", key: "ZeitA2" },
          { de: "immer", ar: "دائماً", en: "always", wordClass: "word", key: "immerA2" },
          { de: "meistens", ar: "غالباً", en: "mostly", wordClass: "word" },
          { de: "sonst", ar: "وإلا", en: "otherwise", wordClass: "word" },
          { de: "der Ausflug", article: "der", plural: "Ausflüge", ar: "الرحلة القصيرة", en: "outing", wordClass: "noun", key: "Ausflug" },
          { de: "absagen", ar: "يُلغي", en: "to cancel", wordClass: "verb", key: "absagen" }
        ],
        sentences: [
          { de: "Wenn das Wetter schön ist, machen wir einen Ausflug.", ar: "إذا كان الطقس جميلاً نقوم برحلة.", en: "If the weather is nice, we'll go on a trip.", uses: ["wenn", "Wetter", "Ausflug"] },
          { de: "Wenn es regnet, bleiben wir zu Hause.", ar: "إذا أمطرت نبقى في البيت.", en: "If it rains, we stay home.", uses: ["regnen"] },
          { de: "Wenn ich Zeit habe, lerne ich abends Deutsch.", ar: "عندما يكون لديّ وقت أتعلّم الألمانية مساءً.", en: "When I have time, I study German in the evening.", uses: ["wenn", "ZeitA2"] },
          { de: "Sonst müssen wir den Ausflug absagen.", ar: "وإلا سنضطر لإلغاء الرحلة.", en: "Otherwise we'll have to cancel the trip.", uses: ["sonst", "absagen"] }
        ],
        grammar: {
          slug: "wenn-satz",
          title: { de: "Der wenn-Satz", en: "The wenn clause", ar: "جملة wenn" },
          summary: { ar: "شرط أو عادة، وفي الحالتين الفعل في النهاية." },
          rules: [
            {
              slug: "wenn-position",
              title: { de: "wenn zuerst → Verb–Verb in der Mitte", en: "wenn first: two verbs meet in the middle", ar: "إذا بدأت بـ wenn التقى الفعلان" },
              explanation: {
                ar: "«wenn» جملة تابعة، فالفعل في نهايتها. وإذا وضعتَها أولاً فإنها تحتلّ المركز الأول من الجملة كلها، فيأتي بعد الفاصلة مباشرةً فعلُ الجملة الرئيسية. النتيجة شكل مميّز: فعلان متجاوران حول الفاصلة — «Wenn das Wetter schön **ist**, **machen** wir einen Ausflug». يمكن إضافة dann بعد الفاصلة دون تغيير: «…, dann machen wir…».",
                en: "wenn is subordinate, so its verb is last; when the wenn clause comes first, the main verb follows the comma — two verbs around the comma."
              },
              formation: { de: "Wenn …, [dann] Verb + Subjekt. · Verb + Subjekt …, wenn … Verb." },
              usage: { ar: "«wenn» تعني «إذا» للشرط، و«عندما» للعادة المتكرّرة في الحاضر. للماضي مرة واحدة تُستعمل «als» لا wenn." },
              mistake: { ar: "خطأ شائع: «Wenn das Wetter schön ist, wir machen einen Ausflug». بعد الفاصلة يأتي الفعل: «machen wir»." },
              examples: [
                { de: "Wenn du willst, komme ich mit.", ar: "إذا أردت سآتي معك." },
                { de: "Ich rufe dich an, wenn ich fertig bin.", ar: "سأتصل بك عندما أنتهي." }
              ]
            }
          ]
        },
        exercises: [
          { type: "multiple_choice", answer: "machen wir", options: ["machen wir", "wir machen", "wir werden machen"],
            practises: ["wenn-position"], instruction: { ar: "أكمل بعد الفاصلة." },
            prompt: { de: "Wenn das Wetter schön ist, ___ einen Ausflug." } },
          { type: "type_answer", answer: "regnet", practises: ["wenn-position"],
            instruction: { ar: "ضع الفعل في مكانه." }, prompt: { de: "Wenn es ___, bleiben wir zu Hause." } },
          { type: "order_tokens", answer: "wenn ich Zeit habe", tokens: ["wenn", "ich", "Zeit", "habe"],
            practises: ["wenn-position"], instruction: { ar: "رتّب الجملة التابعة." },
            prompt: { de: "Ich lerne Deutsch, …" } },
          { type: "multiple_choice", answer: "als", options: ["als", "wenn", "dann"],
            practises: ["wenn-position"], instruction: { ar: "أي أداة للماضي مرة واحدة؟" },
            prompt: { de: "___ ich zehn Jahre alt war, …" } },
          { type: "type_answer", answer: "das Wetter", practises: ["Wetter"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "الطقس" } },
          { type: "type_answer", answer: "sonst", practises: ["sonst"],
            instruction: { ar: "اكتب الكلمة الألمانية." }, prompt: { ar: "وإلا" } },
          { type: "self_assessed",
            instruction: { ar: "اكتب ثلاث جمل شرطية عن أسبوعك القادم." },
            prompt: { de: "Wenn …, dann …" } }
        ],
        review: { ar: "wenn ← الفعل في النهاية؛ وإذا جاءت أولاً فالفعل الرئيسي بعد الفاصلة مباشرة." },
        mistakes: [{ ar: "«Wenn …, wir machen» خطأ. الصواب «Wenn …, machen wir»." }]
      }
    ]
  },

  /* =================================================================== unit 10 */
  {
    slug: "vergleichen-und-beschreiben", ordering: 10,
    title: { de: "Vergleichen und beschreiben", en: "Comparing and describing", ar: "المقارنة والوصف" },
    objective: { ar: "تقارن بين شيئين وتصفهما بصفات مصرَّفة." },
    lessons: [
      {
        slug: "a2-l12-vergleich", ordering: 1,
        title: { de: "größer, besser, am besten", en: "bigger, better, best", ar: "أكبر، أفضل، الأفضل" },
        objective: { ar: "تقارن بين شيئين وتحدّد الأفضل." },
        context: { ar: "تختار بين شقتين وبين مدينتين." },
        canDo: { ar: "أستطيع المقارنة وتبرير اختياري." },
        vocabulary: [
          { de: "größer", ar: "أكبر", en: "bigger", wordClass: "adjective", key: "groesser" },
          { de: "besser", ar: "أفضل", en: "better", wordClass: "adjective" },
          { de: "teuer", ar: "غالٍ", en: "expensive", wordClass: "adjective" },
          { de: "billig", ar: "رخيص", en: "cheap", wordClass: "adjective" },
          { de: "ruhig", ar: "هادئ", en: "quiet", wordClass: "adjective" },
          { de: "laut", ar: "صاخب", en: "loud", wordClass: "adjective" },
          { de: "als", ar: "من (في المقارنة)", en: "than", wordClass: "conjunction" },
          { de: "genauso wie", ar: "تماماً مثل", en: "just as … as", wordClass: "phrase", key: "genausowie" },
          { de: "der Unterschied", article: "der", plural: "Unterschiede", ar: "الفرق", en: "difference", wordClass: "noun", key: "Unterschied" },
          { de: "sich entscheiden", ar: "يقرّر", en: "to decide", wordClass: "verb", key: "entscheiden" }
        ],
        sentences: [
          { de: "Die zweite Wohnung ist größer als die erste.", ar: "الشقة الثانية أكبر من الأولى.", en: "The second flat is bigger than the first.", uses: ["groesser", "als"] },
          { de: "Hamburg ist teurer, aber Köln ist ruhiger.", ar: "هامبورغ أغلى، لكن كولونيا أهدأ.", en: "Hamburg is more expensive, but Cologne is quieter.", uses: ["teuer", "ruhig"] },
          { de: "Diese Wohnung ist genauso teuer wie die andere.", ar: "هذه الشقة غالية تماماً مثل الأخرى.", en: "This flat is just as expensive as the other.", uses: ["genausowie"] },
          { de: "Das ist die beste Lösung.", ar: "هذا هو الحل الأفضل.", en: "That's the best solution.", uses: ["besser"] }
        ],
        grammar: {
          slug: "komparativ",
          title: { de: "Komparativ und Superlativ", en: "Comparative and superlative", ar: "اسم التفضيل" },
          summary: { ar: "درجتان فوق الصفة، وقاعدة واحدة تقريباً بلا استثناءات كثيرة." },
          rules: [
            {
              slug: "komparativ-er-als",
              title: { de: "-er + als", en: "-er plus als", ar: "‎-er مع als" },
              explanation: {
                ar: "درجة المقارنة تُبنى بإضافة ‎-er إلى الصفة، وأداة المقارنة هي «als» لا «wie»: «klein ← kleiner als». الصفات القصيرة ذات حرف العلة a/o/u تأخذ Umlaut: alt ← älter، groß ← größer، jung ← jünger. للتساوي نستعمل «genauso … wie».",
                en: "Add -er and compare with als; short adjectives with a/o/u take an umlaut. Equality uses genauso … wie."
              },
              formation: { de: "klein → kleiner · alt → älter · groß → größer · gut → besser · viel → mehr · gern → lieber" },
              mistake: { ar: "خطأ شائع: «größer wie». المقارنة تستعمل als؛ وwie فقط للتساوي: «so groß wie»." },
              examples: [
                { de: "Berlin ist größer als Köln.", ar: "برلين أكبر من كولونيا." },
                { de: "Ich trinke lieber Tee als Kaffee.", ar: "أفضّل الشاي على القهوة." }
              ]
            },
            {
              slug: "superlativ",
              title: { de: "am …-sten", en: "am …-sten", ar: "صيغة التفضيل المطلق" },
              explanation: {
                ar: "أعلى درجة لها شكلان. بعد الفعل نستعمل «am + الصفة + ‎-sten»: «Diese Wohnung ist am billigsten». وقبل الاسم نستعمل الصفة المصرَّفة مع أداة التعريف: «die billigste Wohnung». الصيغ الشاذة قليلة وتُحفظ: gut ← am besten، viel ← am meisten، gern ← am liebsten.",
                en: "am …-sten after a verb, die/der/das …-ste before a noun; a few irregulars are learned."
              },
              formation: { de: "billig → am billigsten / die billigste · gut → am besten / die beste · groß → am größten" },
              examples: [
                { de: "Im Winter sind die Tage am kürzesten.", ar: "في الشتاء تكون الأيام أقصر ما تكون." },
                { de: "Das ist der beste Kurs.", ar: "هذه أفضل دورة." }
              ]
            }
          ]
        },
        exercises: [
          { type: "type_answer", answer: "größer", practises: ["komparativ-er-als"],
            instruction: { ar: "اكتب درجة المقارنة من groß." }, prompt: { de: "Berlin ist ___ als Köln." } },
          { type: "multiple_choice", answer: "als", options: ["als", "wie", "so"],
            practises: ["komparativ-er-als"], instruction: { ar: "أي أداة للمقارنة؟" },
            prompt: { de: "Diese Wohnung ist teurer ___ die andere." } },
          { type: "type_answer", answer: "besser", practises: ["komparativ-er-als"],
            instruction: { ar: "اكتب درجة المقارنة من gut." }, prompt: { de: "Heute geht es mir ___." } },
          { type: "type_answer", answer: "am besten", practises: ["superlativ"],
            instruction: { ar: "اكتب صيغة التفضيل من gut بعد الفعل." }, prompt: { de: "Dieser Kurs gefällt mir ___." } },
          { type: "multiple_choice", answer: "am billigsten", options: ["am billigsten", "der billigste", "billiger als"],
            practises: ["superlativ"], instruction: { ar: "أي صيغة تأتي بعد الفعل؟" }, prompt: { de: "Diese Wohnung ist ___." } },
          { type: "type_answer", answer: "der Unterschied", practises: ["Unterschied"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "الفرق" } },
          { type: "type_answer", answer: "ruhig", practises: ["ruhig"],
            instruction: { ar: "اكتب الصفة الألمانية." }, prompt: { ar: "هادئ" } },
          { type: "self_assessed",
            instruction: { ar: "قارن بين مدينتين تعرفهما في خمس جمل، واستعمل صيغة تفضيل واحدة." },
            prompt: { de: "… ist größer als … , aber … ist am …" } }
        ],
        review: { ar: "‎-er + als للمقارنة، genauso … wie للتساوي، am …-sten لأعلى درجة." },
        mistakes: [{ ar: "«größer wie» خطأ شائع جداً — الصواب «größer als»." }]
      },
      {
        slug: "a2-l13-adjektive", ordering: 2,
        title: { de: "Adjektivendungen", en: "Adjective endings", ar: "نهايات الصفة" },
        objective: { ar: "تصف اسماً بصفة مصرَّفة قبله." },
        context: { ar: "تصف إعلان شقة: «شقة صغيرة هادئة بمطبخ جديد»." },
        canDo: { ar: "أستطيع استخدام الصفة قبل الاسم بشكل صحيح." },
        vocabulary: [
          { de: "neu", ar: "جديد", en: "new", wordClass: "adjective" },
          { de: "alt", ar: "قديم؛ كبير في السن", en: "old", wordClass: "adjective" },
          { de: "modern", ar: "حديث", en: "modern", wordClass: "adjective" },
          { de: "gemütlich", ar: "مريح ودافئ", en: "cosy", wordClass: "adjective", key: "gemuetlich" },
          { de: "die Anzeige", article: "die", plural: "Anzeigen", ar: "الإعلان", en: "advert", wordClass: "noun", key: "Anzeige" },
          { de: "der Balkon", article: "der", plural: "Balkone", ar: "الشرفة", en: "balcony", wordClass: "noun", key: "Balkon" },
          { de: "die Lage", article: "die", plural: "Lagen", ar: "الموقع", en: "location", wordClass: "noun", key: "Lage" },
          { de: "hell", ar: "مضيء", en: "bright", wordClass: "adjective", key: "hellA2" },
          { de: "dunkel", ar: "معتم", en: "dark", wordClass: "adjective" },
          { de: "günstig", ar: "بسعر مناسب", en: "reasonably priced", wordClass: "adjective", key: "guenstig" }
        ],
        sentences: [
          { de: "Wir suchen eine kleine, helle Wohnung.", ar: "نبحث عن شقة صغيرة مضيئة.", en: "We're looking for a small, bright flat.", uses: ["hellA2"] },
          { de: "Die Wohnung hat einen großen Balkon.", ar: "الشقة فيها شرفة كبيرة.", en: "The flat has a big balcony.", uses: ["Balkon"] },
          { de: "Das ist eine sehr gute Lage.", ar: "هذا موقع جيد جداً.", en: "That's a very good location.", uses: ["Lage"] },
          { de: "Ich habe eine interessante Anzeige gefunden.", ar: "وجدت إعلاناً مثيراً للاهتمام.", en: "I found an interesting advert.", uses: ["Anzeige"] }
        ],
        grammar: {
          slug: "adjektivendungen",
          title: { de: "Adjektive vor dem Nomen", en: "Adjectives before the noun", ar: "الصفة قبل الاسم" },
          summary: { ar: "الصفة بعد الفعل لا تتغيّر؛ وقبل الاسم تأخذ نهاية." },
          rules: [
            {
              slug: "praedikativ-attributiv",
              title: { de: "Nach dem Verb ohne Endung", en: "No ending after the verb", ar: "بعد الفعل بلا نهاية" },
              explanation: {
                ar: "هذا أول ما يجب أن يستقرّ: الصفة التي تأتي بعد sein أو werden أو bleiben لا تتغيّر أبداً — «Die Wohnung ist klein»، «Die Wohnungen sind klein». التصريف يحدث فقط عندما تقف الصفة مباشرة قبل الاسم: «eine kleine Wohnung».",
                en: "After sein/werden/bleiben the adjective never changes; endings appear only directly before a noun."
              },
              formation: { de: "Die Wohnung ist klein. → eine kleine Wohnung" },
              mistake: { ar: "خطأ شائع: «Die Wohnung ist kleine». بعد sein بلا نهاية." },
              examples: [
                { de: "Das Zimmer ist hell.", ar: "الغرفة مضيئة." },
                { de: "Das ist ein helles Zimmer.", ar: "هذه غرفة مضيئة." }
              ]
            },
            {
              slug: "nach-ein",
              title: { de: "Nach ein / kein / mein", en: "After ein, kein, mein", ar: "بعد ein وkein وmein" },
              explanation: {
                ar: "بعد ein وkein وأدوات الملكية، الصفة تحمل المعلومة التي لا تحملها الأداة. في المفرد المرفوع: المذكّر ‎-er، المحايد ‎-es، المؤنث ‎-e. وفي المنصوب يتغيّر المذكّر فقط: «einen großen Balkon». في الجمع النهاية دائماً ‎-en.",
                en: "After ein/kein/mein: -er (m), -es (n), -e (f) in the nominative; masculine accusative takes -en; plural always -en."
              },
              formation: { de: "ein neuer Kurs · ein neues Zimmer · eine neue Wohnung · einen neuen Balkon · meine neuen Bücher" },
              mistake: { ar: "خطأ شائع: «ein neue Kurs». المذكّر المرفوع بعد ein يأخذ ‎-er: «ein neuer Kurs»." },
              examples: [
                { de: "Wir haben eine neue Wohnung.", ar: "لدينا شقة جديدة." },
                { de: "Sie sucht einen ruhigen Platz.", ar: "تبحث عن مكان هادئ." }
              ]
            },
            {
              slug: "nach-der",
              title: { de: "Nach der / die / das", en: "After der, die, das", ar: "بعد der وdie وdas" },
              explanation: {
                ar: "بعد أداة التعريف الأمر أسهل: النهاية إمّا ‎-e أو ‎-en فقط. ‎-e في المفرد المرفوع الثلاثة وفي المؤنث والمحايد المنصوب؛ و‎-en في كل ما عدا ذلك، بما فيه الجمع كلّه.",
                en: "After the definite article only -e or -en occur: -e in the nominative singular and neuter/feminine accusative, -en elsewhere."
              },
              formation: { de: "der neue Kurs · das neue Zimmer · die neue Wohnung · den neuen Kurs · die neuen Kurse" },
              examples: [
                { de: "Der neue Kurs beginnt im Mai.", ar: "الدورة الجديدة تبدأ في مايو." },
                { de: "Ich nehme den günstigen Tarif.", ar: "سآخذ التعرفة الأرخص." }
              ]
            }
          ]
        },
        exercises: [
          { type: "multiple_choice", answer: "klein", options: ["klein", "kleine", "kleines"],
            practises: ["praedikativ-attributiv"], instruction: { ar: "اختر الصيغة الصحيحة." },
            prompt: { de: "Die Wohnung ist ___." } },
          { type: "type_answer", answer: "kleine", practises: ["nach-ein"],
            instruction: { ar: "أكمل نهاية الصفة." }, prompt: { de: "Wir suchen eine ___ Wohnung. (klein)" } },
          { type: "multiple_choice", answer: "neuer", options: ["neuer", "neue", "neues"],
            practises: ["nach-ein"], instruction: { ar: "اختر النهاية الصحيحة." }, prompt: { de: "Das ist ein ___ Kurs." } },
          { type: "type_answer", answer: "großen", practises: ["nach-ein"],
            instruction: { ar: "أكمل نهاية الصفة (منصوب مذكّر)." }, prompt: { de: "Die Wohnung hat einen ___ Balkon. (groß)" } },
          { type: "type_answer", answer: "neue", practises: ["nach-der"],
            instruction: { ar: "أكمل نهاية الصفة." }, prompt: { de: "Der ___ Kurs beginnt im Mai. (neu)" } },
          { type: "multiple_choice", answer: "neuen", options: ["neuen", "neue", "neuer"],
            practises: ["nach-der"], instruction: { ar: "اختر النهاية الصحيحة." }, prompt: { de: "Ich nehme den ___ Tarif." } },
          { type: "type_answer", answer: "der Balkon", practises: ["Balkon"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "الشرفة" } },
          { type: "self_assessed",
            instruction: { ar: "اكتب إعلاناً قصيراً لشقة في أربع جمل، مستخدماً ثلاث صفات قبل أسماء." },
            prompt: { de: "Schöne, helle Wohnung mit …" } }
        ],
        review: { ar: "بعد sein بلا نهاية. بعد ein: er/es/e. بعد der: e أو en. الجمع دائماً en." }
      }
    ]
  },

  /* =================================================================== unit 11 */
  {
    slug: "kommunikation-und-alltag", ordering: 11,
    title: { de: "Kommunikation und Alltag", en: "Communication and daily life", ar: "التواصل والحياة اليومية" },
    objective: { ar: "تكتب رسالة رسمية وتستخدم الأفعال الانعكاسية وترتيب المفعولين." },
    lessons: [
      {
        slug: "a2-l14-email", ordering: 1,
        title: { de: "Eine E-Mail schreiben", en: "Writing an email", ar: "كتابة رسالة إلكترونية" },
        objective: { ar: "تكتب رسالة رسمية قصيرة: تحية، سبب، طلب، خاتمة." },
        context: { ar: "تكتب إلى مدرسة اللغة لتسأل عن دورة وتطلب تأجيل موعد." },
        canDo: { ar: "أستطيع كتابة رسالة رسمية بسيطة." },
        vocabulary: [
          { de: "die E-Mail", article: "die", plural: "E-Mails", ar: "الرسالة الإلكترونية", en: "email", wordClass: "noun", key: "EMail" },
          { de: "sehr geehrte Damen und Herren", ar: "سيداتي سادتي المحترمين", en: "Dear Sir or Madam", wordClass: "phrase", key: "sehrgeehrte" },
          { de: "mit freundlichen Grüßen", ar: "مع أطيب التحيات", en: "Kind regards", wordClass: "phrase", key: "mfg" },
          { de: "die Anfrage", article: "die", plural: "Anfragen", ar: "الاستفسار", en: "enquiry", wordClass: "noun", key: "Anfrage" },
          { de: "sich informieren", ar: "يستعلم", en: "to find out about", wordClass: "verb", key: "informieren" },
          { de: "verschieben", ar: "يؤجّل", en: "to postpone", wordClass: "verb" },
          { de: "der Anhang", article: "der", plural: "Anhänge", ar: "المرفق", en: "attachment", wordClass: "noun", key: "Anhang" },
          { de: "die Antwort", article: "die", plural: "Antworten", ar: "الرد", en: "reply", wordClass: "noun", key: "Antwort" },
          { de: "im Voraus", ar: "مقدّماً", en: "in advance", wordClass: "phrase", key: "imVoraus" },
          { de: "die Rückmeldung", article: "die", plural: "Rückmeldungen", ar: "الإفادة", en: "feedback, response", wordClass: "noun", key: "Rueckmeldung" }
        ],
        sentences: [
          { de: "Sehr geehrte Damen und Herren, ich interessiere mich für Ihren Deutschkurs.", ar: "سيداتي سادتي، أنا مهتم بدورتكم للغة الألمانية.", en: "Dear Sir or Madam, I'm interested in your German course.", uses: ["sehrgeehrte"] },
          { de: "Ich möchte mich über die Preise informieren.", ar: "أودّ الاستعلام عن الأسعار.", en: "I would like to find out about the prices.", uses: ["informieren"] },
          { de: "Können wir den Termin auf Freitag verschieben?", ar: "هل يمكننا تأجيل الموعد إلى الجمعة؟", en: "Can we move the appointment to Friday?", uses: ["verschieben"] },
          { de: "Vielen Dank im Voraus für Ihre Antwort.", ar: "شكراً مقدّماً على ردّكم.", en: "Many thanks in advance for your reply.", uses: ["imVoraus", "Antwort"] }
        ],
        grammar: {
          slug: "formelle-email",
          title: { de: "Der Aufbau einer formellen E-Mail", en: "Structure of a formal email", ar: "بنية الرسالة الرسمية" },
          summary: { ar: "أربعة أجزاء ثابتة، وضمير Sie، وفعل مهذّب." },
          rules: [
            {
              slug: "email-aufbau",
              title: { de: "Anrede, Grund, Bitte, Gruß", en: "Salutation, reason, request, sign-off", ar: "التحية، السبب، الطلب، الخاتمة" },
              explanation: {
                ar: "الرسالة الرسمية الألمانية لها هيكل ثابت يُتوقّع منك: تحية («Sehr geehrte Damen und Herren,» إذا لم تعرف الاسم، أو «Sehr geehrter Herr Meier,» / «Sehr geehrte Frau Meier,»)، ثم سبب الكتابة في جملة، ثم الطلب، ثم الخاتمة «Mit freundlichen Grüßen» واسمك. بعد الفاصلة في التحية تبدأ الجملة التالية بحرف صغير.",
                en: "A fixed four-part structure: salutation, reason, request, sign-off; the line after the salutation comma starts lower case."
              },
              formation: { de: "Sehr geehrte Damen und Herren,\\nich schreibe Ihnen, weil …\\nKönnten Sie mir bitte … ?\\nMit freundlichen Grüßen\\nAmir Hassan" },
              usage: { ar: "استعمل Sie وIhnen وIhr دائماً في الرسالة الرسمية، وبحرف كبير." },
              mistake: { ar: "خطأ شائع: بدء الرسالة بـ «Hallo» إلى جهة رسمية، أو كتابة «ihnen» بحرف صغير." },
              examples: [
                { de: "Ich schreibe Ihnen, weil ich mich für den Kurs interessiere.", ar: "أكتب إليكم لأنني مهتم بالدورة." },
                { de: "Könnten Sie mir bitte die Preise schicken?", ar: "هل يمكنكم إرسال الأسعار لي من فضلكم؟" }
              ]
            },
            {
              slug: "hoeflich-koennten",
              title: { de: "Könnten Sie …? — die höfliche Bitte", en: "Könnten Sie …? the polite request", ar: "الطلب المهذّب" },
              explanation: {
                ar: "«Könnten Sie …?» و«Würden Sie …?» أكثر تهذيباً من «Können Sie». في A2 يكفي أن تحفظهما كصيغتين جاهزتين — بنية الجملة نفسها هي قوس الجملة: الفعل المصرَّف أولاً، والمصدر في النهاية.",
                en: "Könnten Sie …? and Würden Sie …? are the polite request forms; learn them as fixed patterns."
              },
              formation: { de: "Könnten Sie mir bitte helfen? · Würden Sie mir den Termin bestätigen?" },
              examples: [
                { de: "Könnten Sie den Termin verschieben?", ar: "هل يمكنكم تأجيل الموعد؟" },
                { de: "Ich würde gern am Kurs teilnehmen.", ar: "أودّ المشاركة في الدورة." }
              ]
            }
          ]
        },
        reading: {
          slug: "a2-l14-anfrage",
          title: { de: "Anfrage an eine Sprachschule", en: "Enquiry to a language school", ar: "استفسار إلى مدرسة لغة" },
          passage: {
            de: "Sehr geehrte Damen und Herren,\n\nich habe Ihre Anzeige im Internet gelesen und interessiere mich für Ihren Deutschkurs A2. Ich arbeite von Montag bis Freitag, deshalb suche ich einen Abendkurs.\n\nKönnten Sie mir bitte schreiben, wann der nächste Kurs beginnt und wie viel er kostet? Ich möchte auch wissen, ob es einen Einstufungstest gibt.\n\nVielen Dank im Voraus für Ihre Rückmeldung.\n\nMit freundlichen Grüßen\nAmir Hassan"
          },
          translation: {
            ar: "سيداتي سادتي المحترمين،\n\nقرأت إعلانكم على الإنترنت وأنا مهتم بدورتكم للألمانية مستوى A2. أعمل من الاثنين إلى الجمعة، لذلك أبحث عن دورة مسائية.\n\nهل يمكنكم أن تكتبوا لي متى تبدأ الدورة القادمة وكم تكلّف؟ أودّ أيضاً أن أعرف ما إذا كان هناك اختبار تحديد مستوى.\n\nشكراً مقدّماً على إفادتكم.\n\nمع أطيب التحيات\nأمير حسن"
          }
        },
        exercises: [
          { type: "multiple_choice", answer: "Sehr geehrte Damen und Herren,",
            options: ["Sehr geehrte Damen und Herren,", "Hallo zusammen,", "Liebe Freunde,"],
            practises: ["email-aufbau"], instruction: { ar: "أي تحية مناسبة لرسالة رسمية؟" },
            prompt: { de: "An eine Sprachschule:" } },
          { type: "multiple_choice", answer: "Mit freundlichen Grüßen",
            options: ["Mit freundlichen Grüßen", "Tschüss", "Bis bald"],
            practises: ["email-aufbau"], instruction: { ar: "أي خاتمة رسمية؟" }, prompt: { de: "Zum Schluss:" } },
          { type: "type_answer", answer: "Ihnen", practises: ["email-aufbau"],
            instruction: { ar: "أكمل بضمير المخاطب الرسمي في حالة الجر." }, prompt: { de: "Ich schreibe ___, weil …" } },
          { type: "multiple_choice", answer: "einen Abendkurs", options: ["einen Abendkurs", "einen Morgenkurs", "einen Onlinekurs"],
            instruction: { ar: "حسب الرسالة: أي دورة يبحث عنها أمير؟" }, prompt: { de: "Was sucht Amir?" } },
          { type: "multiple_choice", answer: "Weil er von Montag bis Freitag arbeitet.",
            options: ["Weil er von Montag bis Freitag arbeitet.", "Weil der Kurs billiger ist.", "Weil die Schule weit ist."],
            instruction: { ar: "حسب الرسالة: لماذا؟" }, prompt: { de: "Warum sucht er das?" } },
          { type: "type_answer", answer: "die Antwort", practises: ["Antwort"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "الرد" } },
          { type: "type_answer", answer: "verschieben", practises: ["verschieben"],
            instruction: { ar: "اكتب الفعل الألماني." }, prompt: { ar: "يؤجّل" } },
          { type: "self_assessed",
            instruction: { ar: "اكتب رسالة رسمية من ستة أسطر تسأل فيها عن دورة وتطلب تأجيل موعد. التزم بالأجزاء الأربعة." },
            prompt: { de: "Sehr geehrte Damen und Herren, …" } }
        ],
        review: { ar: "تحية ← سبب ← طلب ← خاتمة. Sie/Ihnen بحرف كبير. Könnten Sie…? للطلب المهذّب." }
      },
      {
        slug: "a2-l15-reflexiv", ordering: 2,
        title: { de: "Sich freuen, sich ärgern", en: "Reflexive verbs", ar: "الأفعال الانعكاسية وترتيب المفعولين" },
        objective: { ar: "تستخدم الأفعال الانعكاسية وترتّب المفعول به والمفعول لأجله." },
        context: { ar: "تحكي عن روتين صباحك ومشاعرك تجاه خبر." },
        canDo: { ar: "أستطيع وصف روتيني ومشاعري." },
        vocabulary: [
          { de: "sich freuen", ar: "يفرح", en: "to be glad", wordClass: "verb", key: "freuen" },
          { de: "sich ärgern", ar: "ينزعج", en: "to be annoyed", wordClass: "verb", key: "aergern" },
          { de: "sich waschen", ar: "يغتسل", en: "to wash oneself", wordClass: "verb", key: "waschen" },
          { de: "sich treffen", ar: "يلتقي", en: "to meet", wordClass: "verb", key: "treffenA2" },
          { de: "sich beeilen", ar: "يستعجل", en: "to hurry", wordClass: "verb", key: "beeilen" },
          { de: "schenken", ar: "يُهدي", en: "to give as a present", wordClass: "verb" },
          { de: "erklären", ar: "يشرح", en: "to explain", wordClass: "verb", key: "erklaeren" },
          { de: "leihen", ar: "يُعير", en: "to lend", wordClass: "verb" },
          { de: "das Geschenk", article: "das", plural: "Geschenke", ar: "الهدية", en: "present", wordClass: "noun", key: "Geschenk" },
          { de: "die Nachricht", article: "die", plural: "Nachrichten", ar: "الخبر؛ الرسالة", en: "message, news", wordClass: "noun", key: "Nachricht" }
        ],
        sentences: [
          { de: "Ich freue mich über deine Nachricht.", ar: "أنا سعيد برسالتك.", en: "I'm glad about your message.", uses: ["freuen", "Nachricht"] },
          { de: "Wir treffen uns um sieben vor dem Kino.", ar: "سنلتقي الساعة السابعة أمام السينما.", en: "We're meeting at seven in front of the cinema.", uses: ["treffenA2"] },
          { de: "Ich schenke meiner Schwester ein Buch.", ar: "أُهدي أختي كتاباً.", en: "I'm giving my sister a book.", uses: ["schenken", "Geschenk"] },
          { de: "Kannst du es mir erklären?", ar: "هل يمكنك أن تشرحه لي؟", en: "Can you explain it to me?", uses: ["erklaeren"] }
        ],
        grammar: {
          slug: "reflexiv-und-objekte",
          title: { de: "Reflexivverben und die Objektfolge", en: "Reflexive verbs and object order", ar: "الأفعال الانعكاسية وترتيب المفعولين" },
          summary: { ar: "ضمير يعود على الفاعل، وقاعدة واحدة لترتيب مفعولين." },
          rules: [
            {
              slug: "reflexivpronomen",
              title: { de: "mich, dich, sich", en: "mich, dich, sich", ar: "ضمائر الانعكاس" },
              explanation: {
                ar: "بعض الأفعال الألمانية تحتاج ضميراً يعود على الفاعل، وهو جزء من الفعل لا يمكن حذفه: «Ich freue mich»، «Er ärgert sich». الضمائر: mich, dich, sich, uns, euch, sich. الصعوبة الحقيقية هي أن الفعل قد يكون انعكاسياً بالألمانية دون أن يكون كذلك بالعربية، لذلك يُحفظ الضمير مع الفعل.",
                en: "Some verbs require a pronoun referring back to the subject: mich, dich, sich, uns, euch, sich."
              },
              formation: { de: "ich freue mich · du freust dich · er freut sich · wir freuen uns · ihr freut euch · sie freuen sich" },
              usage: { ar: "الضمير يأتي مباشرة بعد الفعل المصرَّف عادةً: «Ich freue mich sehr»، وفي السؤال بعد الفاعل: «Freust du dich?»." },
              mistake: { ar: "خطأ شائع: «Ich freue über deine Nachricht» بحذف mich. الضمير إلزامي." },
              examples: [
                { de: "Beeil dich, der Bus kommt!", ar: "أسرع، الحافلة قادمة!" },
                { de: "Ich ärgere mich über den Lärm.", ar: "أنزعج من الضجيج." }
              ]
            },
            {
              slug: "dativ-akkusativ",
              title: { de: "Wem? vor Was?", en: "Person before thing", ar: "الشخص قبل الشيء" },
              explanation: {
                ar: "أفعال مثل geben، schenken، schicken، erklären، leihen، zeigen تأخذ مفعولين: شخصاً في حالة الجر وشيئاً في حالة النصب. القاعدة العملية: إذا كانا اسمين فالشخص أولاً — «Ich schenke meiner Schwester ein Buch». أما إذا صار الشيء ضميراً فإنه يسبق: «Ich schenke es meiner Schwester» و«Ich schenke es ihr».",
                en: "With two objects, a noun person comes first; but a pronoun thing moves in front of everything."
              },
              formation: { de: "Ich gebe dem Kind das Buch. → Ich gebe es dem Kind. → Ich gebe es ihm." },
              mistake: { ar: "خطأ شائع: «Ich gebe dem Kind es». الضمير المنصوب يسبق دائماً: «Ich gebe es dem Kind»." },
              examples: [
                { de: "Kannst du mir das Buch leihen?", ar: "هل يمكنك أن تُعيرني الكتاب؟" },
                { de: "Er erklärt es uns noch einmal.", ar: "سيشرحه لنا مرة أخرى." }
              ]
            }
          ]
        },
        exercises: [
          { type: "type_answer", answer: "mich", practises: ["reflexivpronomen"],
            instruction: { ar: "أكمل بضمير الانعكاس." }, prompt: { de: "Ich freue ___ über deine Nachricht." } },
          { type: "type_answer", answer: "uns", practises: ["reflexivpronomen"],
            instruction: { ar: "أكمل بضمير الانعكاس." }, prompt: { de: "Wir treffen ___ um sieben." } },
          { type: "multiple_choice", answer: "dich", options: ["dich", "sich", "dir"],
            practises: ["reflexivpronomen"], instruction: { ar: "اختر الضمير الصحيح." }, prompt: { de: "Beeil ___!" } },
          { type: "multiple_choice", answer: "Ich gebe es dem Kind.",
            options: ["Ich gebe es dem Kind.", "Ich gebe dem Kind es.", "Ich gebe das Kind es."],
            practises: ["dativ-akkusativ"], instruction: { ar: "أي ترتيب صحيح؟" }, prompt: { de: "geben + es + dem Kind" } },
          { type: "order_tokens", answer: "Ich schenke meiner Schwester ein Buch",
            tokens: ["Ich", "schenke", "meiner", "Schwester", "ein", "Buch"], practises: ["dativ-akkusativ"],
            instruction: { ar: "رتّب الجملة." }, prompt: { de: "schenken · Schwester · Buch" } },
          { type: "type_answer", answer: "mir", practises: ["dativ-akkusativ"],
            instruction: { ar: "أكمل بضمير الجر." }, prompt: { de: "Kannst du ___ das Buch leihen?" } },
          { type: "type_answer", answer: "das Geschenk", practises: ["Geschenk"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "الهدية" } },
          { type: "self_assessed",
            instruction: { ar: "اكتب خمس جمل عن صباحك ومشاعرك، مستخدماً ثلاثة أفعال انعكاسية." },
            prompt: { de: "Morgens wasche ich mich … Ich freue mich, wenn …" } }
        ],
        review: { ar: "ضمير الانعكاس إلزامي. مفعولان: الشخص أولاً، إلا إذا كان الشيء ضميراً فيسبق." },
        mistakes: [{ ar: "«Ich gebe dem Kind es» خطأ — الضمير المنصوب يتقدّم." }]
      }
    ]
  },

  /* =================================================================== unit 12 */
  {
    slug: "erzaehlen-und-rueckblick", ordering: 12,
    title: { de: "Erzählen und Rückblick", en: "Narrating and looking back", ar: "الحكاية والاسترجاع" },
    objective: { ar: "تحكي قصة من ماضيك بصيغتَي الماضي المناسبتين." },
    lessons: [
      {
        slug: "a2-l16-praeteritum", ordering: 1,
        title: { de: "war, hatte, konnte", en: "war, hatte, konnte", ar: "الماضي البسيط" },
        objective: { ar: "تستخدم صيغة الماضي البسيط للأفعال التي تُستعمل بها فعلاً." },
        context: { ar: "تحكي عن عطلة قديمة وعن سنتك الأولى في ألمانيا." },
        canDo: { ar: "أستطيع الحديث عن ماضٍ أبعد من الأمس." },
        vocabulary: [
          { de: "war", ar: "كان", en: "was", wordClass: "verb", key: "war" },
          { de: "hatte", ar: "كان لديه", en: "had", wordClass: "verb", key: "hatte" },
          { de: "konnte", ar: "استطاع", en: "could", wordClass: "verb", key: "konnte" },
          { de: "musste", ar: "اضطرّ", en: "had to", wordClass: "verb", key: "musste" },
          { de: "damals", ar: "آنذاك", en: "back then", wordClass: "word", key: "damals" },
          { de: "früher", ar: "سابقاً", en: "in the past", wordClass: "word", key: "frueher" },
          { de: "das Erlebnis", article: "das", plural: "Erlebnisse", ar: "التجربة؛ الحدث", en: "experience", wordClass: "noun", key: "Erlebnis" },
          { de: "die Erinnerung", article: "die", plural: "Erinnerungen", ar: "الذكرى", en: "memory", wordClass: "noun", key: "Erinnerung" },
          { de: "als", ar: "عندما (للماضي)", en: "when (past)", wordClass: "conjunction", key: "alsPast" },
          { de: "plötzlich", ar: "فجأة", en: "suddenly", wordClass: "word", key: "ploetzlich" }
        ],
        sentences: [
          { de: "Damals war ich noch Student.", ar: "آنذاك كنت ما زلت طالباً.", en: "Back then I was still a student.", uses: ["damals", "war"] },
          { de: "Wir hatten keine Wohnung und wenig Geld.", ar: "لم يكن لدينا شقة وكان المال قليلاً.", en: "We had no flat and little money.", uses: ["hatte"] },
          { de: "Ich konnte fast kein Deutsch sprechen.", ar: "لم أكن أستطيع التحدث بالألمانية تقريباً.", en: "I could hardly speak any German.", uses: ["konnte"] },
          { de: "Als ich in Deutschland ankam, war alles neu.", ar: "عندما وصلت إلى ألمانيا كان كل شيء جديداً.", en: "When I arrived in Germany, everything was new.", uses: ["alsPast"] }
        ],
        grammar: {
          slug: "praeteritum",
          title: { de: "Das Präteritum", en: "The simple past", ar: "الماضي البسيط" },
          summary: { ar: "لا تحفظه كله — احفظ الأفعال التي تُستعمل به فعلاً في الكلام." },
          rules: [
            {
              slug: "sein-haben-praeteritum",
              title: { de: "war und hatte", en: "war and hatte", ar: "war وhatte" },
              explanation: {
                ar: "في الكلام اليومي يستعمل الألمان الماضي المركّب (Perfekt) لمعظم الأفعال، لكنّ هناك استثناءات ثابتة تُقال دائماً بالماضي البسيط: sein وhaben والأفعال الناقصة. لهذا تسمع «Ich war müde» لا «Ich bin müde gewesen». هذه هي كل ما تحتاجه في A2.",
                en: "Spoken German uses the Perfekt for most verbs but the simple past for sein, haben and the modals."
              },
              formation: { de: "sein: ich war, du warst, er war, wir waren · haben: ich hatte, du hattest, er hatte, wir hatten" },
              mistake: { ar: "«Ich bin gestern krank gewesen» ليست خاطئة، لكن الطبيعي هو «Ich war gestern krank»." },
              examples: [
                { de: "Wo warst du gestern?", ar: "أين كنت أمس؟" },
                { de: "Wir hatten viel Spaß.", ar: "استمتعنا كثيراً." }
              ]
            },
            {
              slug: "modal-praeteritum",
              title: { de: "konnte, musste, wollte", en: "konnte, musste, wollte", ar: "الأفعال الناقصة في الماضي" },
              explanation: {
                ar: "الأفعال الناقصة تُبنى في الماضي البسيط بحذف الـ Umlaut وإضافة ‎-te: können ← konnte، müssen ← musste، wollen ← wollte، dürfen ← durfte. بنية الجملة تبقى كما هي: الناقص في المركز الثاني والمصدر في النهاية.",
                en: "Modals drop the umlaut and add -te; sentence structure is unchanged."
              },
              formation: { de: "können → konnte · müssen → musste · wollen → wollte · dürfen → durfte" },
              examples: [
                { de: "Ich musste jeden Tag arbeiten.", ar: "كان عليّ العمل كل يوم." },
                { de: "Wir wollten nach Berlin fahren.", ar: "أردنا السفر إلى برلين." }
              ]
            },
            {
              slug: "als-wenn",
              title: { de: "als oder wenn?", en: "als or wenn?", ar: "als أم wenn؟" },
              explanation: {
                ar: "الفارق يربك المتعلمين لأن العربية تستعمل «عندما» للحالتين. القاعدة: «als» لحدث واحد في الماضي — «Als ich ankam, …». و«wenn» للتكرار في الماضي أو الحاضر، وللشرط — «Wenn ich Zeit habe, …». وكلتاهما جملة تابعة، فالفعل في النهاية.",
                en: "als for a single past event, wenn for repetition and conditions; both send the verb to the end."
              },
              formation: { de: "Als ich Kind war, … (einmal) · Wenn ich Kind war, … (jedes Mal / falsch für einmal)" },
              mistake: { ar: "خطأ شائع: «Wenn ich in Deutschland ankam» لحدث واحد. الصواب «Als ich … ankam»." },
              examples: [
                { de: "Als ich klein war, wohnten wir in Kairo.", ar: "عندما كنت صغيراً كنا نسكن في القاهرة." },
                { de: "Immer wenn es regnete, blieben wir drinnen.", ar: "كلما أمطرت كنا نبقى في الداخل." }
              ]
            }
          ]
        },
        exercises: [
          { type: "type_answer", answer: "war", practises: ["sein-haben-praeteritum"],
            instruction: { ar: "أكمل بصيغة الماضي من sein." }, prompt: { de: "Damals ___ ich noch Student." } },
          { type: "type_answer", answer: "hatten", practises: ["sein-haben-praeteritum"],
            instruction: { ar: "أكمل بصيغة الماضي من haben." }, prompt: { de: "Wir ___ wenig Geld." } },
          { type: "type_answer", answer: "konnte", practises: ["modal-praeteritum"],
            instruction: { ar: "أكمل بصيغة الماضي من können." }, prompt: { de: "Ich ___ fast kein Deutsch sprechen." } },
          { type: "type_answer", answer: "musste", practises: ["modal-praeteritum"],
            instruction: { ar: "أكمل بصيغة الماضي من müssen." }, prompt: { de: "Ich ___ jeden Tag arbeiten." } },
          { type: "multiple_choice", answer: "Als", options: ["Als", "Wenn", "Wann"],
            practises: ["als-wenn"], instruction: { ar: "حدث واحد في الماضي — أي أداة؟" },
            prompt: { de: "___ ich in Deutschland ankam, war alles neu." } },
          { type: "multiple_choice", answer: "Wenn", options: ["Wenn", "Als", "Dann"],
            practises: ["als-wenn"], instruction: { ar: "تكرار في الماضي — أي أداة؟" },
            prompt: { de: "Immer ___ es regnete, blieben wir drinnen." } },
          { type: "type_answer", answer: "die Erinnerung", practises: ["Erinnerung"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "الذكرى" } },
          { type: "self_assessed",
            instruction: { ar: "اكتب خمس جمل عن سنتك الأولى في مكان جديد، مستخدماً war وhatte وفعلاً ناقصاً في الماضي." },
            prompt: { de: "Damals war ich … Ich hatte … Ich musste …" } }
        ],
        review: { ar: "الماضي البسيط للأفعال sein وhaben والناقصة فقط. als لحدث واحد، wenn للتكرار والشرط." },
        mistakes: [{ ar: "«Wenn ich ankam» لحدث واحد خطأ — الصواب «Als ich ankam»." }]
      },
      {
        slug: "a2-l17-geschichte", ordering: 2,
        title: { de: "Eine Geschichte erzählen", en: "Telling a story", ar: "أن تحكي قصة" },
        objective: { ar: "تجمع كل ما تعلّمته في A2 لتحكي حدثاً كاملاً مرتّباً." },
        context: { ar: "تحكي لزميلك ما حدث لك في أول يوم عمل." },
        canDo: { ar: "أستطيع سرد حدث كامل بترتيب زمني واضح." },
        vocabulary: [
          { de: "zuerst", ar: "أولاً", en: "first", wordClass: "word", key: "zuerst" },
          { de: "danach", ar: "بعد ذلك", en: "after that", wordClass: "word", key: "danach" },
          { de: "später", ar: "لاحقاً", en: "later", wordClass: "word", key: "spaeter" },
          { de: "schließlich", ar: "في النهاية", en: "finally", wordClass: "word", key: "schliesslich" },
          { de: "zum Glück", ar: "لحسن الحظ", en: "luckily", wordClass: "phrase", key: "zumGlueck" },
          { de: "leider", ar: "للأسف", en: "unfortunately", wordClass: "word", key: "leiderA2" },
          { de: "passieren", ar: "يحدث", en: "to happen", wordClass: "verb", key: "passieren" },
          { de: "vergessen", ar: "ينسى", en: "to forget", wordClass: "verb", key: "vergessen" },
          { de: "der Kollege", article: "der", plural: "Kollegen", ar: "الزميل", en: "colleague", wordClass: "noun", key: "Kollege" },
          { de: "der erste Arbeitstag", article: "der", ar: "أول يوم عمل", en: "first day at work", wordClass: "phrase", key: "ersterArbeitstag" }
        ],
        sentences: [
          { de: "Zuerst bin ich zu spät aufgestanden.", ar: "أولاً استيقظت متأخراً.", en: "First I got up too late.", uses: ["zuerst"] },
          { de: "Danach habe ich den Bus verpasst.", ar: "بعد ذلك فاتتني الحافلة.", en: "After that I missed the bus.", uses: ["danach"] },
          { de: "Zum Glück war mein Chef sehr freundlich.", ar: "لحسن الحظ كان مديري لطيفاً جداً.", en: "Luckily my boss was very friendly.", uses: ["zumGlueck"] },
          { de: "Schließlich hat alles gut geklappt.", ar: "في النهاية سار كل شيء على ما يرام.", en: "In the end everything worked out.", uses: ["schliesslich"] }
        ],
        grammar: {
          slug: "erzaehlen",
          title: { de: "Eine Geschichte aufbauen", en: "Structuring a story", ar: "بناء الحكاية" },
          summary: { ar: "كلمات ترتيب، وقاعدة واحدة صارمة: الفعل يبقى ثانياً." },
          rules: [
            {
              slug: "verb-zweite-position",
              title: { de: "Zeitangabe zuerst → Verb bleibt zweit", en: "Time first, verb still second", ar: "الظرف أولاً والفعل ثانياً" },
              explanation: {
                ar: "هذه القاعدة تُختبر في كل حكاية: عندما تبدأ الجملة بكلمة ترتيب مثل zuerst أو danach أو gestern، فإنها تشغل المركز الأول، ولذلك يجب أن يأتي الفعل المصرَّف مباشرة بعدها ثم الفاعل: «Danach **habe ich** den Bus verpasst». المركز الثاني للفعل هو أثبت قاعدة في الجملة الألمانية الرئيسية.",
                en: "Starting with a time expression fills position one, so the conjugated verb comes next, then the subject."
              },
              formation: { de: "Zuerst bin ich … · Danach habe ich … · Später war ich … · Schließlich hat alles geklappt." },
              mistake: { ar: "خطأ شائع: «Danach ich habe den Bus verpasst». الصواب «Danach habe ich»." },
              examples: [
                { de: "Gestern bin ich früh aufgestanden.", ar: "أمس استيقظت مبكراً." },
                { de: "Um acht Uhr hat der Kurs angefangen.", ar: "الساعة الثامنة بدأت الدورة." }
              ]
            },
            {
              slug: "perfekt-praeteritum-mischen",
              title: { de: "Perfekt für Ereignisse, Präteritum für Zustände", en: "Perfekt for events, Präteritum for states", ar: "المركّب للأحداث والبسيط للحالات" },
              explanation: {
                ar: "الحكاية الطبيعية تمزج الزمنين: الأحداث تُروى بالماضي المركّب («ich habe verpasst»، «ich bin aufgestanden»)، والحالات والخلفية بالماضي البسيط («es war kalt»، «ich hatte Angst»، «ich konnte nicht»). إذا أتقنت هذا المزيج بدا كلامك ألمانياً حقيقياً لا ترجمة.",
                en: "Events in the Perfekt, background states in the Präteritum — that mix is what makes a story sound German."
              },
              formation: { de: "Ich bin aufgestanden. (Ereignis) · Es war schon spät. (Zustand)" },
              examples: [
                { de: "Ich habe den Bus verpasst, aber zum Glück war der Chef freundlich.", ar: "فاتتني الحافلة، لكن لحسن الحظ كان المدير لطيفاً." },
                { de: "Wir sind spät angekommen, weil wir keinen Parkplatz hatten.", ar: "وصلنا متأخرين لأننا لم نجد موقفاً." }
              ]
            }
          ]
        },
        reading: {
          slug: "a2-l17-erster-arbeitstag",
          title: { de: "Mein erster Arbeitstag", en: "My first day at work", ar: "أول يوم عمل لي" },
          passage: {
            de: "Mein erster Arbeitstag war im September. Ich war sehr nervös, weil ich noch niemanden kannte.\n\nZuerst bin ich zu spät aufgestanden. Danach habe ich den Bus verpasst und musste zwanzig Minuten warten. Als ich endlich ankam, hatte die Besprechung schon angefangen.\n\nZum Glück war mein Chef sehr freundlich. Er hat mir alles ruhig erklärt und mich den Kollegen vorgestellt. Später haben wir zusammen Mittag gegessen.\n\nSchließlich hat alles gut geklappt. Heute lache ich über diesen Tag, aber damals war er wirklich stressig."
          },
          translation: {
            ar: "كان أول يوم عمل لي في سبتمبر. كنت متوتراً جداً لأنني لم أكن أعرف أحداً بعد.\n\nأولاً استيقظت متأخراً. بعد ذلك فاتتني الحافلة واضطررت للانتظار عشرين دقيقة. وعندما وصلت أخيراً كان الاجتماع قد بدأ.\n\nلحسن الحظ كان مديري لطيفاً جداً. شرح لي كل شيء بهدوء وعرّفني على الزملاء. لاحقاً تناولنا الغداء معاً.\n\nفي النهاية سار كل شيء على ما يرام. اليوم أضحك على ذلك اليوم، لكنه آنذاك كان مرهقاً حقاً."
          }
        },
        exercises: [
          { type: "multiple_choice", answer: "habe ich", options: ["habe ich", "ich habe", "ich bin"],
            practises: ["verb-zweite-position"], instruction: { ar: "أكمل بعد ظرف الزمان." },
            prompt: { de: "Danach ___ den Bus verpasst." } },
          { type: "order_tokens", answer: "Zuerst bin ich zu spät aufgestanden",
            tokens: ["Zuerst", "bin", "ich", "zu", "spät", "aufgestanden"], practises: ["verb-zweite-position"],
            instruction: { ar: "رتّب الجملة." }, prompt: { de: "zuerst · aufstehen · zu spät" } },
          { type: "multiple_choice", answer: "war", options: ["war", "ist gewesen", "habe gewesen"],
            practises: ["perfekt-praeteritum-mischen"], instruction: { ar: "أي صيغة طبيعية للحالة؟" },
            prompt: { de: "Zum Glück ___ mein Chef freundlich." } },
          { type: "multiple_choice", answer: "Als", options: ["Als", "Wenn", "Dann"],
            instruction: { ar: "حدث واحد في الماضي." }, prompt: { de: "___ ich endlich ankam, …" } },
          { type: "multiple_choice", answer: "Er hat den Bus verpasst.",
            options: ["Er hat den Bus verpasst.", "Er ist mit dem Auto gefahren.", "Er ist zu früh gekommen."],
            instruction: { ar: "حسب النص: ماذا حدث بعد أن استيقظ متأخراً؟" }, prompt: { de: "Was ist danach passiert?" } },
          { type: "multiple_choice", answer: "Er war freundlich und hat alles erklärt.",
            options: ["Er war freundlich und hat alles erklärt.", "Er war sehr ärgerlich.", "Er war nicht da."],
            instruction: { ar: "حسب النص: كيف كان المدير؟" }, prompt: { de: "Wie war der Chef?" } },
          { type: "type_answer", answer: "der Kollege", practises: ["Kollege"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "الزميل" } },
          { type: "self_assessed",
            instruction: { ar: "احكِ يوماً لا تنساه في ثماني جمل. استعمل zuerst وdanach وschließlich، وامزج المركّب مع war/hatte." },
            prompt: { de: "Zuerst … Danach … Zum Glück … Schließlich …" } }
        ],
        review: { ar: "ابدأ بظرف زمان والفعل يبقى ثانياً. الأحداث بالمركّب، الحالات بـ war/hatte." },
        mistakes: [{ ar: "«Danach ich habe» خطأ — الفعل دائماً في المركز الثاني." }]
      }
    ]
  }
];
