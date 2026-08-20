# DeutschFlow 4.1.0

تطبيق حفظ الكلمات والتراكيب الألمانية بواجهة عربية RTL، يعمل دون إنترنت،
ويحفظ كل البيانات محلياً في IndexedDB.

## البنية

```
version.js                  ← المصدر الوحيد لرقم النسخة (الصفحة + عامل الخدمة)
index.html                  ← القشرة، مسارات نسبية بالكامل
sw.js                       ← تخزين مسبق كامل + تحديث لا يقاطع الجلسة
styles.css
manifest.webmanifest
data/seed-data.js           ← 2,820 مدخلاً — لا يُعدَّل
src/core.js                 ← تطبيع، تحقق من الإجابات، تدقيق، حساب البطاقات
src/db.js                   ← IndexedDB + الهجرة
src/learning.js             ← الجدولة والجلسات والأسئلة
src/io.js                   ← استيراد/تصدير + سياسة الاحتفاظ
src/ui.js                   ← العرض
src/controller.js           ← الحالة والأحداث والإقلاع
src/register-sw.js          ← تسجيل عامل الخدمة ومسار التحديث الآمن
tests/                      ← 82 اختباراً على Node
build/build-standalone.js   ← بناء نسخة الملف الواحد
deploy/standalone-index.html
```

## الأوامر

```bash
npm install     # fake-indexeddb (للاختبارات فقط — التطبيق نفسه بلا تبعيات)
npm run check   # فحص صياغة كل ملفات JavaScript
npm test        # تشغيل الاختبارات
npm run build   # إعادة بناء نسخة الملف الواحد
```

## التشغيل محلياً

عامل الخدمة يحتاج سياقاً آمناً:

```bash
python3 -m http.server 8000
# ثم افتح http://localhost:8000
```

أو افتح `deploy/standalone-index.html` مباشرة (بلا PWA ولا عامل خدمة).

## قواعد ثابتة

- لا صوت ولا Text-to-Speech ولا اختبارات استماع. النطق العربي المكتوب مساعدة بصرية فقط.
- لا اختيارات معنى عشوائية — الاستدعاء والكتابة هما الأساس (Hard+).
- الإعادات وكشف الإجابة والعروض التعليمية لا تُحتسب أسئلة مخططة.
- `data/seed-data.js` لا يُعدَّل إلا في مهمة بيانات صريحة.
- لا تُحذف بيانات مستخدم أثناء أي ترقية.

راجع `CHANGELOG.md` و`MIGRATION-NOTES.md` و`TEST-RESULTS.txt`.
