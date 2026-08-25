/*
 * DeutschFlow A1 — units 1 to 4.
 *
 * Original teaching material written for this project. The progression is the ordinary
 * beginner one: say who you are, handle numbers and time, talk about people, then describe
 * an ordinary day. Grammar arrives when a learner needs it to say something they now want
 * to say, not as a syllabus of its own.
 *
 * Arabic carries the explanation, German carries the language, and every example is a
 * sentence somebody would really say.
 */

export const UNITS_1_2 = [
  /* ==================================================================== unit 1 */
  {
    slug: "erste-schritte", ordering: 1,
    title: { de: "Erste Schritte", en: "First steps", ar: "الخطوات الأولى" },
    objective: {
      ar: "تحيّي، تعرّف بنفسك، وتسأل عن اسم الآخرين وبلدهم.",
      en: "Greet people, introduce yourself, ask who someone is and where they are from."
    },
    lessons: [
      {
        slug: "a1-l01-hallo", ordering: 1,
        title: { de: "Hallo! Ich heiße …", en: "Hello! My name is …", ar: "مرحباً! اسمي…" },
        objective: {
          ar: "تستطيع أن تحيّي شخصاً وتقول اسمك وتسأل عن اسمه.",
          en: "You can greet someone, say your name, and ask for theirs."
        },
        context: {
          ar: "أول يوم في دورة اللغة. تجلس بجانب شخص لا تعرفه، وتريد أن تبدأ الحديث.",
          en: "First day of a language course. You sit next to someone you do not know."
        },
        canDo: { ar: "أستطيع أن أعرّف بنفسي وأسأل عن اسم شخص آخر." },
        vocabulary: [
          { de: "hallo", ar: "مرحباً", en: "hello", wordClass: "word" },
          { de: "guten Morgen", ar: "صباح الخير", en: "good morning", wordClass: "phrase" },
          { de: "guten Tag", ar: "طاب يومك", en: "good day", wordClass: "phrase" },
          { de: "guten Abend", ar: "مساء الخير", en: "good evening", wordClass: "phrase" },
          { de: "tschüss", ar: "إلى اللقاء", en: "bye", wordClass: "word" },
          { de: "auf Wiedersehen", ar: "إلى اللقاء (رسمي)", en: "goodbye (formal)", wordClass: "phrase" },
          { de: "heißen", ar: "يُدعى؛ اسمه", en: "to be called", wordClass: "verb" },
          { de: "Name", article: "der", plural: "Namen", ar: "الاسم", en: "name", wordClass: "noun" },
          { de: "bitte", ar: "من فضلك؛ تفضّل", en: "please; you're welcome", wordClass: "word" },
          { de: "danke", ar: "شكراً", en: "thank you", wordClass: "word" }
        ],
        sentences: [
          { de: "Hallo, ich heiße Amir.", ar: "مرحباً، اسمي أمير.", en: "Hello, my name is Amir.", uses: ["hallo", "heißen"] },
          { de: "Wie heißt du?", ar: "ما اسمك؟", en: "What is your name?", uses: ["heißen"] },
          { de: "Guten Morgen, Frau Weber!", ar: "صباح الخير يا سيدة فيبر!", en: "Good morning, Ms Weber!", uses: ["guten Morgen"] },
          { de: "Danke, und tschüss!", ar: "شكراً، وإلى اللقاء!", en: "Thanks, and bye!", uses: ["danke", "tschüss"] }
        ],
        grammar: {
          slug: "praesens-sein-heissen",
          title: { de: "sein und heißen im Präsens", en: "sein and heißen in the present", ar: "الفعلان sein وheißen في المضارع" },
          summary: { ar: "أهم فعلين في بداية التعلّم: «يكون» و«يُدعى»." },
          rules: [
            {
              slug: "heissen",
              title: { de: "heißen — ich heiße, du heißt", en: "heißen — to be called", ar: "heißen — أن يُدعى" },
              explanation: {
                ar: "الفعل في الألمانية يتغيّر حسب الفاعل. مع «ich» ينتهي بـ e، ومع «du» ينتهي بـ st، ومع «er/sie» ينتهي بـ t. لاحظ أن heißen يعني حرفياً «يُدعى»، فتقول «ich heiße Amir» أي «أُدعى أمير».",
                en: "German verbs change their ending with the subject: -e for ich, -st for du, -t for er/sie."
              },
              formation: { de: "ich heiße · du heißt · er/sie heißt · wir heißen · ihr heißt · sie/Sie heißen" },
              usage: { ar: "استخدمه للسؤال عن الاسم وللإجابة عليه." },
              mistake: {
                ar: "خطأ شائع: «ich heiße ist Amir». لا تجمع بين heiße وist. الصواب: «ich heiße Amir» أو «mein Name ist Amir»."
              },
              examples: [
                { de: "Ich heiße Sara.", ar: "اسمي سارة." },
                { de: "Wie heißt du?", ar: "ما اسمك؟" },
                { de: "Er heißt Jonas.", ar: "اسمه يوناس." }
              ]
            },
            {
              slug: "sein",
              title: { de: "sein — ich bin, du bist", en: "sein — to be", ar: "sein — أن يكون" },
              explanation: {
                ar: "sein فعل شاذ ولا يتبع القاعدة، لذلك تُحفظ صيغه. تحتاجه لتقول من أنت ومن أين أنت وكيف حالك.",
                en: "sein is irregular, so its forms are learned by heart."
              },
              formation: { de: "ich bin · du bist · er/sie ist · wir sind · ihr seid · sie/Sie sind" },
              mistake: { ar: "خطأ شائع: «ich bin heiße Amir». اختر واحداً فقط: bin أو heiße." },
              examples: [
                { de: "Ich bin Student.", ar: "أنا طالب." },
                { de: "Du bist sehr nett.", ar: "أنت لطيف جداً." },
                { de: "Wir sind aus Kairo.", ar: "نحن من القاهرة." }
              ]
            }
          ]
        },
        listening: {
          slug: "l01-erstes-gespraech", activityType: "dialogue",
          title: { de: "Im Sprachkurs", en: "In the language course", ar: "في دورة اللغة" },
          instruction: { ar: "اقرأ الحوار، ثم أعد قراءته بصوت مرتفع مع الانتباه إلى نهايات الأفعال." },
          speakers: ["Amir", "Lena"],
          lines: [
            { speaker: "Amir", de: "Hallo! Ich heiße Amir.", ar: "مرحباً! اسمي أمير." },
            { speaker: "Lena", de: "Hallo Amir, ich bin Lena.", ar: "مرحباً أمير، أنا لينا." },
            { speaker: "Amir", de: "Freut mich! Bist du auch neu hier?", ar: "سعدت بلقائك! هل أنت جديدة هنا أيضاً؟" },
            { speaker: "Lena", de: "Ja, das ist mein erster Tag.", ar: "نعم، هذا أول يوم لي." },
            { speaker: "Amir", de: "Meiner auch. Bis später!", ar: "ويومي الأول أيضاً. إلى اللقاء لاحقاً!" }
          ]
        },
        exercises: [
          { type: "type_answer", answer: "heiße", practises: ["heißen"],
            instruction: { ar: "أكمل بالصيغة الصحيحة من heißen." },
            prompt: { de: "Ich ___ Amir." } },
          { type: "type_answer", answer: "heißt", practises: ["heißen"],
            instruction: { ar: "أكمل بالصيغة الصحيحة من heißen." },
            prompt: { de: "Wie ___ du?" } },
          { type: "multiple_choice", answer: "bin", options: ["bin", "bist", "ist"], practises: ["sein"],
            instruction: { ar: "اختر الصيغة الصحيحة." },
            prompt: { de: "Ich ___ Lena." } },
          { type: "multiple_choice", answer: "ist", options: ["bin", "bist", "ist"], practises: ["sein"],
            instruction: { ar: "اختر الصيغة الصحيحة." },
            prompt: { de: "Er ___ mein Freund." } },
          { type: "type_answer", answer: "danke", practises: ["danke"],
            instruction: { ar: "اكتب الكلمة الألمانية." }, prompt: { ar: "شكراً" } },
          { type: "type_answer", answer: "guten Morgen", practises: ["guten Morgen"],
            instruction: { ar: "اكتب العبارة الألمانية." }, prompt: { ar: "صباح الخير" } },
          { type: "multiple_choice", answer: "Auf Wiedersehen", options: ["Auf Wiedersehen", "Guten Morgen", "Danke"],
            instruction: { ar: "أي عبارة تقولها عند المغادرة بشكل رسمي؟" }, prompt: { de: "…" } },
          { type: "self_assessed",
            instruction: { ar: "اكتب تعريفاً قصيراً بنفسك: التحية، اسمك، وسؤال عن اسم الآخر." },
            prompt: { de: "Stell dich vor. (2–3 Sätze)" } }
        ],
        review: { ar: "التحيات تتغيّر حسب وقت اليوم. الفعل يتغيّر حسب الفاعل: ich heiße / du heißt / er heißt." },
        mistakes: [{ ar: "لا تقل «ich bin heiße». اختر bin أو heiße فقط." }]
      },
      {
        slug: "a1-l02-woher", ordering: 2,
        title: { de: "Woher kommst du?", en: "Where are you from?", ar: "من أين أنت؟" },
        objective: {
          ar: "تسأل عن البلد والمدينة واللغة، وتجيب عن نفسك.",
          en: "Ask and answer where someone is from and what languages they speak."
        },
        context: { ar: "في استراحة الدورة، يسألك زميل عن بلدك ولغتك." },
        canDo: { ar: "أستطيع أن أقول من أين أنا وأي لغات أتحدث." },
        vocabulary: [
          { de: "kommen", ar: "يأتي", en: "to come", wordClass: "verb" },
          { de: "wohnen", ar: "يسكن", en: "to live (reside)", wordClass: "verb" },
          { de: "sprechen", ar: "يتحدّث", en: "to speak", wordClass: "verb" },
          { de: "Land", article: "das", plural: "Länder", ar: "البلد", en: "country", wordClass: "noun" },
          { de: "Stadt", article: "die", plural: "Städte", ar: "المدينة", en: "city", wordClass: "noun" },
          { de: "Sprache", article: "die", plural: "Sprachen", ar: "اللغة", en: "language", wordClass: "noun" },
          { de: "Deutschland", ar: "ألمانيا", en: "Germany", wordClass: "noun" },
          { de: "Ägypten", ar: "مصر", en: "Egypt", wordClass: "noun" },
          { de: "Arabisch", ar: "العربية", en: "Arabic", wordClass: "noun" },
          { de: "Deutsch", ar: "الألمانية", en: "German", wordClass: "noun" }
        ],
        sentences: [
          { de: "Ich komme aus Ägypten.", ar: "أنا من مصر.", en: "I come from Egypt.", uses: ["kommen", "Ägypten"] },
          { de: "Wo wohnst du jetzt?", ar: "أين تسكن الآن؟", en: "Where do you live now?", uses: ["wohnen"] },
          { de: "Ich wohne in Berlin.", ar: "أسكن في برلين.", en: "I live in Berlin.", uses: ["wohnen"] },
          { de: "Ich spreche Arabisch und ein bisschen Deutsch.", ar: "أتحدّث العربية وقليلاً من الألمانية.", en: "I speak Arabic and a little German.", uses: ["sprechen", "Arabisch", "Deutsch"] }
        ],
        grammar: {
          slug: "w-fragen",
          title: { de: "W-Fragen", en: "W-questions", ar: "أسئلة الاستفهام" },
          summary: { ar: "أدوات السؤال التي تبدأ بحرف W، وترتيب الكلمات بعدها." },
          rules: [
            {
              slug: "w-wort-position",
              title: { de: "W-Wort + Verb + Person", en: "Question word first", ar: "أداة السؤال أولاً" },
              explanation: {
                ar: "في السؤال بأداة استفهام يأتي الترتيب: أداة السؤال، ثم الفعل، ثم الفاعل. الفعل دائماً في المركز الثاني. مثال: «Woher kommst du؟» — أداة (Woher) + فعل (kommst) + فاعل (du).",
                en: "Question word, then verb, then subject. The verb is always in second position."
              },
              formation: { de: "Wie? Wo? Woher? Was? Wer? Wann? — W-Wort + Verb + Subjekt" },
              mistake: { ar: "خطأ شائع: «Woher du kommst?». الفعل يجب أن يسبق الفاعل: «Woher kommst du?»" },
              examples: [
                { de: "Woher kommst du?", ar: "من أين أنت؟" },
                { de: "Wo wohnst du?", ar: "أين تسكن؟" },
                { de: "Was sprichst du?", ar: "ماذا تتحدّث؟" },
                { de: "Wer ist das?", ar: "من هذا؟" }
              ]
            },
            {
              slug: "aus-in",
              title: { de: "aus und in", en: "aus and in", ar: "aus وin" },
              explanation: {
                ar: "«aus» للأصل: من أين أتيت. «in» للمكان الحالي: أين تسكن الآن. الخلط بينهما يغيّر المعنى تماماً.",
                en: "aus = origin; in = where you are now."
              },
              examples: [
                { de: "Ich komme aus Syrien.", ar: "أنا من سوريا." },
                { de: "Ich wohne in Hamburg.", ar: "أسكن في هامبورغ." }
              ]
            }
          ]
        },
        exercises: [
          { type: "type_answer", answer: "Woher",
            instruction: { ar: "أكمل بأداة السؤال المناسبة." }, prompt: { de: "___ kommst du? — Aus Ägypten." } },
          { type: "type_answer", answer: "Wo",
            instruction: { ar: "أكمل بأداة السؤال المناسبة." }, prompt: { de: "___ wohnst du? — In Berlin." } },
          { type: "multiple_choice", answer: "aus", options: ["aus", "in", "nach"],
            instruction: { ar: "اختر حرف الجر الصحيح." }, prompt: { de: "Ich komme ___ Kairo." } },
          { type: "multiple_choice", answer: "in", options: ["aus", "in", "von"],
            instruction: { ar: "اختر حرف الجر الصحيح." }, prompt: { de: "Ich wohne ___ München." } },
          { type: "type_answer", answer: "spreche", practises: ["sprechen"],
            instruction: { ar: "أكمل بالصيغة الصحيحة من sprechen." }, prompt: { de: "Ich ___ Arabisch." } },
          { type: "type_answer", answer: "die Stadt", practises: ["Stadt"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "المدينة" } },
          { type: "type_answer", answer: "das Land", practises: ["Land"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "البلد" } },
          { type: "self_assessed",
            instruction: { ar: "اكتب ثلاث جمل: من أين أنت، أين تسكن، وأي لغات تتحدث." },
            prompt: { de: "Woher kommst du? Wo wohnst du? Was sprichst du?" } }
        ],
        review: { ar: "aus = الأصل، in = السكن الحالي. في سؤال W يأتي الفعل ثانياً دائماً." },
        mistakes: [{ ar: "«Woher du kommst?» خطأ — الصواب «Woher kommst du?»" }]
      },
      {
        slug: "a1-l03-alphabet", ordering: 3,
        title: { de: "Buchstabieren und Kontakt", en: "Spelling and contact details", ar: "التهجئة وبيانات التواصل" },
        objective: {
          ar: "تتهجّى اسمك، وتفهم عنواناً ورقم هاتف وبريداً إلكترونياً.",
          en: "Spell your name and understand an address, phone number and email."
        },
        context: { ar: "في مكتب التسجيل، يطلبون منك تهجئة اسمك وإعطاء بياناتك." },
        canDo: { ar: "أستطيع تهجئة اسمي وإعطاء بيانات التواصل." },
        vocabulary: [
          { de: "buchstabieren", ar: "يتهجّى", en: "to spell", wordClass: "verb" },
          { de: "Adresse", article: "die", plural: "Adressen", ar: "العنوان", en: "address", wordClass: "noun" },
          { de: "Straße", article: "die", plural: "Straßen", ar: "الشارع", en: "street", wordClass: "noun" },
          { de: "Telefonnummer", article: "die", plural: "Telefonnummern", ar: "رقم الهاتف", en: "phone number", wordClass: "noun" },
          { de: "E-Mail", article: "die", plural: "E-Mails", ar: "البريد الإلكتروني", en: "email", wordClass: "noun" },
          { de: "Formular", article: "das", plural: "Formulare", ar: "الاستمارة", en: "form", wordClass: "noun" },
          { de: "schreiben", ar: "يكتب", en: "to write", wordClass: "verb" },
          { de: "wiederholen", ar: "يعيد؛ يكرّر", en: "to repeat", wordClass: "verb" },
          { de: "langsam", ar: "ببطء", en: "slowly", wordClass: "word" },
          { de: "noch einmal", ar: "مرة أخرى", en: "once more", wordClass: "phrase" }
        ],
        sentences: [
          { de: "Wie buchstabiert man das?", ar: "كيف تُتهجّى هذه الكلمة؟", en: "How do you spell that?", uses: ["buchstabieren"] },
          { de: "Können Sie das bitte wiederholen?", ar: "هل يمكنك التكرار من فضلك؟", en: "Could you repeat that, please?", uses: ["wiederholen"] },
          { de: "Bitte langsam!", ar: "ببطء من فضلك!", en: "Slowly, please!", uses: ["langsam"] },
          { de: "Meine Adresse ist Hauptstraße 12.", ar: "عنواني هو شارع هاوبت 12.", en: "My address is Hauptstraße 12.", uses: ["Adresse", "Straße"] }
        ],
        grammar: {
          slug: "alphabet-umlaute",
          title: { de: "Das Alphabet und die Umlaute", en: "The alphabet and umlauts", ar: "الأبجدية والحروف المعدّلة" },
          summary: { ar: "أسماء الحروف الألمانية، والحروف الخاصة ä ö ü ß." },
          rules: [
            {
              slug: "umlaute",
              title: { de: "ä, ö, ü und ß", en: "ä, ö, ü and ß", ar: "الحروف ä وö وü وß" },
              explanation: {
                ar: "الألمانية تضيف أربعة رموز على اللاتينية. ä تُنطق قريبة من «إيه» المفتوحة، ö تُنطق بشفتين مستديرتين مع صوت «إيه»، ü تُنطق بشفتين مستديرتين مع صوت «إي». أما ß فهي حرف s قوي ولا تأتي أبداً في بداية الكلمة. عند التهجئة تقول: a-Umlaut، o-Umlaut، u-Umlaut، و«Eszett» للـ ß.",
                en: "German adds ä, ö, ü and ß. ß is a sharp s and never begins a word."
              },
              formation: { de: "ä = a-Umlaut · ö = o-Umlaut · ü = u-Umlaut · ß = Eszett" },
              mistake: { ar: "خطأ شائع: كتابة «Strasse» بدل «Straße». الشكلان مقبولان، لكن ß هي الأصل في ألمانيا." },
              examples: [
                { de: "Mein Name ist Müller: M-Ü-L-L-E-R.", ar: "اسمي مولر: M-Ü-L-L-E-R." },
                { de: "Ich wohne in der Bäckerstraße.", ar: "أسكن في شارع بيكر." }
              ]
            }
          ]
        },
        reading: {
          title: { de: "Ein Formular", en: "A form", ar: "استمارة" },
          de: "Anmeldung Sprachkurs A1\nName: Amir Hassan\nStraße: Hauptstraße 12\nStadt: Berlin\nTelefon: 030 555 21 44\nE-Mail: amir.hassan@mail.de\nSprachen: Arabisch, Englisch, ein bisschen Deutsch",
          ar: "استمارة تسجيل في دورة A1: الاسم، الشارع، المدينة، الهاتف، البريد، اللغات."
        },
        exercises: [
          { type: "type_answer", answer: "buchstabieren", practises: ["buchstabieren"],
            instruction: { ar: "اكتب الفعل الألماني." }, prompt: { ar: "يتهجّى" } },
          { type: "multiple_choice", answer: "Eszett", options: ["Eszett", "S-Umlaut", "Doppel-B"],
            instruction: { ar: "ما اسم الحرف ß عند التهجئة؟" }, prompt: { de: "ß = ?" } },
          { type: "multiple_choice", answer: "die Adresse", options: ["die Adresse", "der Adresse", "das Adresse"],
            practises: ["Adresse"], instruction: { ar: "اختر أداة التعريف الصحيحة." }, prompt: { de: "___ Adresse" } },
          { type: "type_answer", answer: "die Straße", practises: ["Straße"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "الشارع" } },
          { type: "type_answer", answer: "noch einmal", practises: ["noch einmal"],
            instruction: { ar: "اكتب العبارة الألمانية." }, prompt: { ar: "مرة أخرى" } },
          { type: "multiple_choice", answer: "Berlin", options: ["Berlin", "Hauptstraße 12", "Arabisch"],
            instruction: { ar: "حسب الاستمارة أعلاه: في أي مدينة يسكن أمير؟" }, prompt: { de: "Stadt: ?" } },
          { type: "self_assessed",
            instruction: { ar: "اكتب استمارتك أنت: الاسم، الشارع، المدينة، اللغات." },
            prompt: { de: "Name: … Straße: … Stadt: … Sprachen: …" } }
        ],
        review: { ar: "ß لا تبدأ كلمة أبداً. عند عدم الفهم قل: «Bitte langsam» أو «Noch einmal, bitte»." }
      }
    ]
  },

  /* ==================================================================== unit 2 */
  {
    slug: "zahlen-und-zeit", ordering: 2,
    title: { de: "Zahlen und Zeit", en: "Numbers and time", ar: "الأرقام والوقت" },
    objective: { ar: "تستخدم الأرقام، وتسأل عن الساعة، وتتحدث عن الأيام والتواريخ." },
    lessons: [
      {
        slug: "a1-l04-zahlen", ordering: 1,
        title: { de: "Zahlen von 0 bis 100", en: "Numbers 0 to 100", ar: "الأرقام من ٠ إلى ١٠٠" },
        objective: { ar: "تقرأ وتكتب الأرقام حتى المئة، وتستخدمها في العمر والسعر ورقم الهاتف." },
        context: { ar: "في السوق وفي مكتب التسجيل تحتاج الأرقام باستمرار." },
        canDo: { ar: "أستطيع فهم الأرقام واستخدامها في الحياة اليومية." },
        vocabulary: [
          { de: "eins", ar: "واحد", en: "one", wordClass: "number" },
          { de: "zwei", ar: "اثنان", en: "two", wordClass: "number" },
          { de: "drei", ar: "ثلاثة", en: "three", wordClass: "number" },
          { de: "zehn", ar: "عشرة", en: "ten", wordClass: "number" },
          { de: "zwanzig", ar: "عشرون", en: "twenty", wordClass: "number" },
          { de: "hundert", ar: "مئة", en: "hundred", wordClass: "number" },
          { de: "Zahl", article: "die", plural: "Zahlen", ar: "الرقم", en: "number", wordClass: "noun" },
          { de: "Jahr", article: "das", plural: "Jahre", ar: "السنة", en: "year", wordClass: "noun" },
          { de: "alt", ar: "عمره؛ قديم", en: "old", wordClass: "adjective" },
          { de: "kosten", ar: "يكلّف", en: "to cost", wordClass: "verb" }
        ],
        sentences: [
          { de: "Ich bin dreißig Jahre alt.", ar: "عمري ثلاثون سنة.", en: "I am thirty years old.", uses: ["Jahr", "alt"] },
          { de: "Wie alt bist du?", ar: "كم عمرك؟", en: "How old are you?", uses: ["alt"] },
          { de: "Das kostet zwölf Euro.", ar: "هذا يكلّف اثني عشر يورو.", en: "That costs twelve euros.", uses: ["kosten"] },
          { de: "Meine Nummer ist null drei null …", ar: "رقمي هو صفر ثلاثة صفر…", en: "My number is zero three zero…", uses: ["Zahl"] }
        ],
        grammar: {
          slug: "zahlen-bildung",
          title: { de: "Wie man Zahlen bildet", en: "How numbers are formed", ar: "كيف تُبنى الأرقام" },
          summary: { ar: "الألمانية تقرأ الآحاد قبل العشرات — عكس العربية." },
          rules: [
            {
              slug: "einer-vor-zehner",
              title: { de: "Einer vor Zehner", en: "Units before tens", ar: "الآحاد قبل العشرات" },
              explanation: {
                ar: "هذه أكبر مفاجأة للمبتدئ: الرقم ٢١ يُقرأ «einundzwanzig» أي «واحد وعشرون» — الآحاد أولاً ثم «und» ثم العشرات، وتُكتب كلمة واحدة. الرقم ٤٧ = sieben-und-vierzig. العربية تفعل الشيء نفسه («واحد وعشرون»)، لذلك المنطق مألوف لك.",
                en: "German says the unit before the ten: 21 = einundzwanzig, written as one word."
              },
              formation: { de: "21 = einundzwanzig · 47 = siebenundvierzig · 99 = neunundneunzig" },
              mistake: { ar: "خطأ شائع: «zwanzigeins». الصواب «einundzwanzig»." },
              examples: [
                { de: "Ich bin einundzwanzig.", ar: "عمري واحد وعشرون." },
                { de: "Das Buch kostet dreiunddreißig Euro.", ar: "الكتاب يكلّف ثلاثة وثلاثين يورو." }
              ]
            }
          ]
        },
        exercises: [
          { type: "type_answer", answer: "einundzwanzig",
            instruction: { ar: "اكتب الرقم بالألمانية." }, prompt: { de: "21 = ?" } },
          { type: "type_answer", answer: "siebenundvierzig",
            instruction: { ar: "اكتب الرقم بالألمانية." }, prompt: { de: "47 = ?" } },
          { type: "multiple_choice", answer: "dreizehn", options: ["dreizehn", "dreißig", "dreiunddrei"],
            instruction: { ar: "أي كلمة تعني ١٣؟" }, prompt: { de: "13 = ?" } },
          { type: "multiple_choice", answer: "dreißig", options: ["dreizehn", "dreißig", "dreihundert"],
            instruction: { ar: "أي كلمة تعني ٣٠؟" }, prompt: { de: "30 = ?" } },
          { type: "type_answer", answer: "kostet", practises: ["kosten"],
            instruction: { ar: "أكمل بالصيغة الصحيحة من kosten." }, prompt: { de: "Wie viel ___ das?" } },
          { type: "type_answer", answer: "das Jahr", practises: ["Jahr"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "السنة" } },
          { type: "self_assessed",
            instruction: { ar: "اكتب عمرك ورقم هاتفك بالكلمات الألمانية." },
            prompt: { de: "Wie alt bist du? Wie ist deine Nummer?" } }
        ],
        review: { ar: "الآحاد قبل العشرات: einundzwanzig. انتبه للفرق بين dreizehn (١٣) وdreißig (٣٠)." },
        mistakes: [{ ar: "لا تخلط بين ‎-zehn (١٣–١٩) و‎-zig (٢٠، ٣٠، ٤٠…)." }]
      },
      {
        slug: "a1-l05-uhrzeit", ordering: 2,
        title: { de: "Wie spät ist es?", en: "What time is it?", ar: "كم الساعة؟" },
        objective: { ar: "تسأل عن الساعة وتجيب، وتحدّد موعداً بسيطاً." },
        context: { ar: "تريد أن تعرف موعد بدء الدرس وموعد إغلاق المتجر." },
        canDo: { ar: "أستطيع أن أسأل عن الوقت وأفهم الإجابة." },
        vocabulary: [
          { de: "Uhr", article: "die", plural: "Uhren", ar: "الساعة (الجهاز/التوقيت)", en: "clock; o'clock", wordClass: "noun" },
          { de: "Stunde", article: "die", plural: "Stunden", ar: "الساعة (المدة)", en: "hour", wordClass: "noun" },
          { de: "Minute", article: "die", plural: "Minuten", ar: "الدقيقة", en: "minute", wordClass: "noun" },
          { de: "halb", ar: "نصف", en: "half", wordClass: "word" },
          { de: "Viertel", article: "das", plural: "Viertel", ar: "الربع", en: "quarter", wordClass: "noun" },
          { de: "vor", ar: "قبل", en: "before; to (time)", wordClass: "word" },
          { de: "nach", ar: "بعد", en: "after; past (time)", wordClass: "word" },
          { de: "früh", ar: "مبكّر", en: "early", wordClass: "adjective" },
          { de: "spät", ar: "متأخّر", en: "late", wordClass: "adjective" },
          { de: "beginnen", ar: "يبدأ", en: "to begin", wordClass: "verb" }
        ],
        sentences: [
          { de: "Wie spät ist es?", ar: "كم الساعة؟", en: "What time is it?", uses: ["spät"] },
          { de: "Es ist Viertel nach acht.", ar: "الساعة الثامنة والربع.", en: "It is quarter past eight.", uses: ["Viertel", "nach"] },
          { de: "Der Kurs beginnt um neun Uhr.", ar: "الدرس يبدأ الساعة التاسعة.", en: "The course begins at nine.", uses: ["beginnen", "Uhr"] },
          { de: "Es ist halb sieben.", ar: "الساعة السادسة والنصف.", en: "It is half past six.", uses: ["halb"] }
        ],
        grammar: {
          slug: "uhrzeit",
          title: { de: "Die Uhrzeit", en: "Telling the time", ar: "قراءة الساعة" },
          summary: { ar: "«halb» في الألمانية تشير إلى الساعة القادمة، لا الماضية." },
          rules: [
            {
              slug: "halb",
              title: { de: "halb + nächste Stunde", en: "halb points forward", ar: "halb تشير إلى الساعة التالية" },
              explanation: {
                ar: "هذا الفرق يربك المتعلّم العربي كثيراً. «halb sieben» لا تعني السابعة والنصف، بل السادسة والنصف — أي «نصف الطريق إلى السابعة». القاعدة: halb + الساعة القادمة. للتذكير: فكّر أن الألمان ينظرون إلى الأمام لا إلى الخلف.",
                en: "halb sieben = 6:30, i.e. halfway to seven."
              },
              formation: { de: "halb acht = 7:30 · Viertel nach acht = 8:15 · Viertel vor neun = 8:45" },
              mistake: { ar: "خطأ شائع: ترجمة «halb sieben» بالسابعة والنصف. الصواب: السادسة والنصف." },
              examples: [
                { de: "Es ist halb neun.", ar: "الساعة الثامنة والنصف." },
                { de: "Wir treffen uns um Viertel vor sechs.", ar: "نلتقي في السادسة إلا ربعاً." }
              ]
            },
            {
              slug: "um-praeposition",
              title: { de: "um + Uhrzeit", en: "um + clock time", ar: "um مع الوقت" },
              explanation: { ar: "لتحديد وقت حدث نستخدم «um»: um acht Uhr. ولا نستخدمها مع أجزاء اليوم: نقول «am Morgen» لا «um Morgen»." },
              examples: [
                { de: "Der Film beginnt um zwanzig Uhr.", ar: "الفيلم يبدأ الساعة الثامنة مساءً." },
                { de: "Am Abend bin ich zu Hause.", ar: "في المساء أكون في البيت." }
              ]
            }
          ]
        },
        exercises: [
          { type: "multiple_choice", answer: "6:30", options: ["6:30", "7:30", "7:00"],
            instruction: { ar: "ماذا تعني «halb sieben»؟" }, prompt: { de: "halb sieben = ?" } },
          { type: "multiple_choice", answer: "8:45", options: ["8:45", "9:15", "8:15"],
            instruction: { ar: "ماذا تعني «Viertel vor neun»؟" }, prompt: { de: "Viertel vor neun = ?" } },
          { type: "type_answer", answer: "um", practises: ["um-praeposition"],
            instruction: { ar: "أكمل بحرف الجر الصحيح." }, prompt: { de: "Der Kurs beginnt ___ neun Uhr." } },
          { type: "type_answer", answer: "beginnt", practises: ["beginnen"],
            instruction: { ar: "أكمل بالصيغة الصحيحة من beginnen." }, prompt: { de: "Der Film ___ um acht." } },
          { type: "type_answer", answer: "die Uhr", practises: ["Uhr"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "الساعة" } },
          { type: "multiple_choice", answer: "Wie spät ist es?", options: ["Wie spät ist es?", "Wie alt ist es?", "Wo ist es?"],
            instruction: { ar: "كيف تسأل عن الوقت؟" }, prompt: { de: "…?" } },
          { type: "self_assessed",
            instruction: { ar: "اكتب جدول يومك بثلاثة أوقات: متى تستيقظ، متى يبدأ الدرس، متى تعود." },
            prompt: { de: "Um wie viel Uhr …?" } }
        ],
        review: { ar: "halb + الساعة التالية. um للوقت المحدد، am لأجزاء اليوم." },
        mistakes: [{ ar: "«halb sieben» = ٦:٣٠ وليس ٧:٣٠." }]
      },
      {
        slug: "a1-l06-woche", ordering: 3,
        title: { de: "Tage, Monate, Termine", en: "Days, months, appointments", ar: "الأيام والشهور والمواعيد" },
        objective: { ar: "تسمّي أيام الأسبوع والشهور وتحدّد موعداً." },
        context: { ar: "تريد أن تحجز موعداً وتتفق مع صديق على يوم." },
        canDo: { ar: "أستطيع الاتفاق على يوم وموعد." },
        vocabulary: [
          { de: "Montag", article: "der", ar: "الاثنين", en: "Monday", wordClass: "noun" },
          { de: "Dienstag", article: "der", ar: "الثلاثاء", en: "Tuesday", wordClass: "noun" },
          { de: "Freitag", article: "der", ar: "الجمعة", en: "Friday", wordClass: "noun" },
          { de: "Samstag", article: "der", ar: "السبت", en: "Saturday", wordClass: "noun" },
          { de: "Sonntag", article: "der", ar: "الأحد", en: "Sunday", wordClass: "noun" },
          { de: "Woche", article: "die", plural: "Wochen", ar: "الأسبوع", en: "week", wordClass: "noun" },
          { de: "Monat", article: "der", plural: "Monate", ar: "الشهر", en: "month", wordClass: "noun" },
          { de: "heute", ar: "اليوم", en: "today", wordClass: "word" },
          { de: "morgen", ar: "غداً", en: "tomorrow", wordClass: "word" },
          { de: "Termin", article: "der", plural: "Termine", ar: "الموعد", en: "appointment", wordClass: "noun" }
        ],
        sentences: [
          { de: "Heute ist Montag.", ar: "اليوم الاثنين.", en: "Today is Monday.", uses: ["heute", "Montag"] },
          { de: "Am Freitag habe ich einen Termin.", ar: "يوم الجمعة عندي موعد.", en: "On Friday I have an appointment.", uses: ["Freitag", "Termin"] },
          { de: "Passt dir Dienstag?", ar: "هل يناسبك الثلاثاء؟", en: "Does Tuesday suit you?", uses: ["Dienstag"] },
          { de: "Morgen habe ich keine Zeit.", ar: "غداً ليس عندي وقت.", en: "Tomorrow I have no time.", uses: ["morgen"] }
        ],
        grammar: {
          slug: "am-im-praeposition",
          title: { de: "am, im und um", en: "am, im and um", ar: "am وim وum" },
          summary: { ar: "ثلاثة حروف جر للزمن، لكلٍّ منها مجاله." },
          rules: [
            {
              slug: "am-im-um",
              title: { de: "Zeitangaben richtig verbinden", en: "Choosing the right time preposition", ar: "اختيار حرف الجر الزمني" },
              explanation: {
                ar: "القاعدة بسيطة إذا حفظت المجالات الثلاثة: «um» مع الساعة (um acht Uhr)، «am» مع اليوم وجزء اليوم (am Montag، am Abend)، «im» مع الشهر والفصل (im Mai، im Sommer). استثناء يجب حفظه: «in der Nacht» وليس «am Nacht».",
                en: "um + clock time, am + day or part of day, im + month or season."
              },
              formation: { de: "um 8 Uhr · am Montag · am Abend · im Mai · im Sommer · in der Nacht" },
              mistake: { ar: "خطأ شائع: «in Montag» أو «am Mai». الصواب: «am Montag» و«im Mai»." },
              examples: [
                { de: "Am Samstag arbeite ich nicht.", ar: "يوم السبت لا أعمل." },
                { de: "Im Juli fahre ich nach Ägypten.", ar: "في يوليو أسافر إلى مصر." },
                { de: "Der Termin ist um halb zehn.", ar: "الموعد الساعة التاسعة والنصف." }
              ]
            }
          ]
        },
        listening: {
          slug: "l06-termin", activityType: "dialogue",
          title: { de: "Ein Termin beim Arzt", en: "An appointment at the doctor's", ar: "موعد عند الطبيب" },
          instruction: { ar: "اقرأ الحوار وحدّد اليوم والساعة." },
          speakers: ["Praxis", "Amir"],
          lines: [
            { speaker: "Praxis", de: "Praxis Dr. Klein, guten Tag.", ar: "عيادة د. كلاين، طاب يومك." },
            { speaker: "Amir", de: "Guten Tag, ich hätte gern einen Termin.", ar: "طاب يومك، أريد موعداً من فضلك." },
            { speaker: "Praxis", de: "Passt Ihnen Mittwoch um halb elf?", ar: "هل يناسبك الأربعاء الساعة العاشرة والنصف؟" },
            { speaker: "Amir", de: "Mittwoch ist gut. Um halb elf, ja.", ar: "الأربعاء مناسب. العاشرة والنصف، نعم." },
            { speaker: "Praxis", de: "Wie ist Ihr Name, bitte?", ar: "ما اسمك من فضلك؟" },
            { speaker: "Amir", de: "Hassan. H-A-S-S-A-N.", ar: "حسن. H-A-S-S-A-N." }
          ]
        },
        exercises: [
          { type: "multiple_choice", answer: "am", options: ["am", "im", "um"],
            instruction: { ar: "اختر حرف الجر الصحيح." }, prompt: { de: "___ Montag habe ich Deutsch." } },
          { type: "multiple_choice", answer: "im", options: ["am", "im", "um"],
            instruction: { ar: "اختر حرف الجر الصحيح." }, prompt: { de: "___ August ist es warm." } },
          { type: "multiple_choice", answer: "um", options: ["am", "im", "um"],
            instruction: { ar: "اختر حرف الجر الصحيح." }, prompt: { de: "Der Kurs beginnt ___ neun Uhr." } },
          { type: "type_answer", answer: "der Termin", practises: ["Termin"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "الموعد" } },
          { type: "type_answer", answer: "die Woche", practises: ["Woche"],
            instruction: { ar: "اكتب الكلمة مع أداة التعريف." }, prompt: { ar: "الأسبوع" } },
          { type: "multiple_choice", answer: "Mittwoch", options: ["Mittwoch", "Montag", "Freitag"],
            instruction: { ar: "حسب الحوار: في أي يوم الموعد؟" }, prompt: { de: "Wann ist der Termin?" } },
          { type: "self_assessed",
            instruction: { ar: "اكتب رسالة قصيرة تقترح فيها موعداً: اليوم والساعة." },
            prompt: { de: "Hast du am … Zeit? Vielleicht um …?" } }
        ],
        review: { ar: "um للساعة، am لليوم، im للشهر. واستثناء: in der Nacht." }
      }
    ]
  }
];
