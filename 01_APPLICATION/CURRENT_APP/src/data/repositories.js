export function createRepositories(database) {
  if (!database) throw new TypeError("A persistence adapter is required");

  return Object.freeze({
    vocabulary: Object.freeze({
      all: () => database.getAll("words"),
      get: id => database.get("words", id),
      save: word => database.put("words", word),
      saveMany: words => database.bulkPut("words", words),
      remove: id => database.delete("words", id),
      clear: () => database.clear("words")
    }),
    cards: Object.freeze({
      all: () => database.getAll("cards"),
      get: key => database.get("cards", key),
      save: card => database.put("cards", card),
      saveMany: cards => database.bulkPut("cards", cards),
      removeMany: keys => database.bulkDelete("cards", keys),
      clear: () => database.clear("cards")
    }),
    attempts: Object.freeze({
      all: () => database.getAll("attempts"),
      add: attempt => database.add("attempts", attempt),
      since: timestamp => database.getAttemptsSince(timestamp),
      byWordId: wordId => database.getByIndex("attempts", "wordId", wordId),
      removeMany: ids => database.bulkDelete("attempts", ids),
      clear: () => database.clear("attempts")
    }),
    metadata: Object.freeze({
      get: (key, fallback = null) => database.getMeta(key, fallback),
      set: (key, value) => database.setMeta(key, value)
    }),
    lifecycle: Object.freeze({
      initialize: () => database.initialize(),
      replaceAll: payload => database.replaceAll(payload)
    })
  });
}
