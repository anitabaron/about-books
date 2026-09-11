---
change_id: one-way-relationships
title: Relationships become one-way — a connection shows only on the card it was created from
status: implementing
created: 2026-09-11
updated: 2026-09-11
archived_at: null
---

## Notes

Relacje przestają być obustronne. Dziś jeden wiersz w `relationships` renderuje się pod obiema
postaciami, bo `buildConnections` (src/lib/connections.ts:76-79) indeksuje go pod
`character_a_id` ORAZ `character_b_id`. Efekt widoczny w użyciu: „CÓRKA" pojawia się i pod
Agnieszką, i pod Ewą, a karta Alicji puchnie od pięciu luster „MIESZKA W KAMIENICY", których
czytelniczka tam nie chce. Czasem relacja w drugą stronę jest zbędna i to czytelniczka ma
decydować, czy ją notuje — nie automat.

Kierunek JUŻ jest w danych: src/pages/api/characters/[id]/relationships.ts:66 zapisuje
`character_a_id: anchorId`, czyli kartę, z której relacja powstała. Nic nie trzeba migrować w
danych. Zmienia się znaczenie kolumny: `character_a_id` staje się kotwicą, a komentarz w
connections.ts, który dziś wprost tego zabrania, trzeba przepisać.

Zakres:

- src/lib/connections.ts — usunąć pętlę po obu końcach, indeksować tylko pod
  `character_a_id`; przepisać komentarz modułu.
- src/lib/connections.test.ts — testy asercjują obustronność, odwracają się.
- src/pages/api/relationships/[id].ts:68-95 — gałąź anchorIsA/anchorIsB staje się martwa
  (kotwica to zawsze `a`); uprościć.
- Migracja: `relationships_unique_pair_type` normalizuje parę przez least/greatest, żeby A->B
  i B->A kolidowały. Przy relacjach jednostronnych to blokuje dokładnie to, co ma być
  możliwe: dopisanie kierunku powrotnego, gdy ma sens. Indeks schodzi na
  (character_a_id, character_b_id, type, custom_type_id) nulls not distinct.
  `nulls not distinct` ZOSTAJE — bez tego indeks nie odrzuca niczego (zmierzone 2026-09-11).
- supabase/tests/rls_books.sql — cztery asercje duplikatów par opisują dziś semantykę
  nieuporządkowaną; trzeba je przestawić i dodać asercję, że kierunek powrotny jest teraz
  DOZWOLONY.

Mapa (CIRCLE/PERSON) zostaje bez zmian i to jest świadoma decyzja: `toLinks` scala po
nieuporządkowanej parze, `layoutEgo` łapie połączenia po obu końcach, więc linia dalej znaczy
„połączeni", nie „kierunek". Strzałek na diagramie NIE dodajemy w tej zmianie.

Ryzyko „istniejące wiersze przeskoczą na jedną kartę" — ZMIERZONE I ZAMKNIĘTE, 2026-09-11.
Odpytana produkcja (SQL editor, read-only join po `character_a_id`) dla książki
3a2def94-e13f-409f-8c72-fd64bea703ea zwróciła 8 wierszy; `from_a` to kotwica:

| from_a    | typ                 | to_b      |
| --------- | ------------------- | --------- |
| Agnieszka | córka               | Ewa       |
| Agnieszka | mieszka w kamienicy | Alicja    |
| Alicja    | family              | Agnieszka |
| Ewa       | mieszka w kamienicy | Alicja    |
| Kasia     | mieszka w kamienicy | Alicja    |
| Kasia     | mieszka z           | Marta     |
| Maria     | mieszka w kamienicy | Alicja    |
| Marta     | mieszka w kamienicy | Alicja    |

Wszystkie pięć „mieszka w kamienicy" ma lokatorkę jako `a`, Alicję jako `b`. Po zmianie karta
Alicji traci tę listę — czyli dokładnie to, o co prosiła czytelniczka; dojdzie jej tylko
`family -> Agnieszka`. „Córka" zostaje pod Agnieszką i znika spod Ewy. Ręczne przepisywanie
wierszy NIE jest potrzebne. Ten sam zestaw jest oczekiwanym wynikiem manualnej weryfikacji.

Książka na prodzie do weryfikacji:
https://about-books.ab-app.workers.dev/books/3a2def94-e13f-409f-8c72-fd64bea703ea

Nie w zakresie: strzałki na diagramach, sekcja „kto wskazuje na mnie", oraz przeniesienie
pięciu wspólnych typów relacji do bazy (osobna, późniejsza zmiana).
