---
change_id: relationship-type-presets
title: The five shared relationship types move into the database, and `other` becomes `friend`
status: implemented
created: 2026-09-11
updated: 2026-09-11
archived_at: null
---

## Notes

Czytelniczka: „a gdzie są zapisane te hardcoded 5 typy relacji które mamy? nie widzę ich w
bazie. **chce je miec w bazie**" oraz „zamiast other zapisz **friend**".

Dziś piątka nie istnieje jako wiersze. Żyje w trzech kopiach tej samej listy:

- `src/types.ts:120` — `RELATIONSHIP_TYPES` (typ TS, Zod, walidacja nazw własnych)
- `src/pages/books/[id].astro:465, 570, 678` — dwa `<select>` i linia „RELATIONSHIP TYPES"
- Postgres — checki `relationships_type_check` oraz `relationship_types_not_shared`

Kierunek (zatwierdzony 2026-09-11): mała tabela słownikowa, nie globalne wiersze w
`relationship_types`.

- `relationship_type_presets (slug pk, label, sort_order)`, pięć wierszy.
- `relationships.type` dostaje FK do niej zamiast checka `relationships_type_check`.
  FK jest NO ACTION, więc presetu w użyciu nie da się usunąć.
- `relationship_types_not_shared` nie może zostać checkiem (check nie umie podzapytania) →
  trigger `before insert or update` z `set search_path = ''`, porównujący
  `lower(btrim(new.name))` z presetami. To jest świadomy koszt tej zmiany: trigger nie
  waliduje wstecznie istniejących wierszy tak jak check — oddajemy odrobinę gwarancji za
  jedno źródło prawdy.
- RLS: `enable`, jedna polityka `for select to authenticated using (true)`, ZERO polityk
  zapisu, `grant select … to authenticated`, `revoke all … from anon`. Czyta każdy zalogowany,
  nie zmienia nikt z aplikacji. Szósty wspólny typ = migracja, i tak ma być przy „wspólnym".
- `RELATIONSHIP_TYPES` w `types.ts` zostaje, ale kurczy się do jednej roli: unia typów w
  kompilacji + Zod. Strona czyta presety z bazy (`order by sort_order`).
- `rls_books.sql` dostaje asercję, że wiersze presetów i lista TS się zgadzają — bez tego
  rozjadą się po cichu, czyli dokładnie problem, który ta zmiana naprawia.

`other` → `friend` wjeżdża W TEJ zmianie, nie osobno. Powód jest ilościowy: po wprowadzeniu
tabeli to jeden UPDATE, a przed nią — migracja przestawiająca dwa checki plus `types.ts`.
Robienie tego wcześniej oznacza napisanie tej samej roboty dwa razy.

Skutek uboczny do zakomunikowania: `relationship_types_not_shared` blokuje własne typy o
nazwach z piątki. Po zamianie czytelnik będzie mógł stworzyć własny typ „other", a nie będzie
mógł „friend".

Do sprawdzenia w planie, nie zakładać: ile wierszy `relationships` ma dziś `type = 'other'` —
lokalnie i na produkcji. Migracja musi je przepisać PRZED podmianą ograniczenia, inaczej
FK/check odrzuci własne dane.

Odrzucony wariant: jedna tabela na wszystko (globalne wiersze w `relationship_types` z
`book_id is null`, likwidacja kolumny `type` i XOR-a). Koncepcyjnie czystszy — jedna kolumna
zamiast pary — ale wymusza `book_id` nullable, politykę RLS wpuszczającą wiersze niczyje,
przebudowę unikalnego indeksu nazw i przepisanie obu ścieżek zapisu oraz indeksu par. Ten sam
efekt dla czytelniczki, kilkukrotnie większy promień rażenia.

Zależność: siada na `one-way-relationships` (SHA 3ec2663), które zmieniło
`relationships_unique_pair_type` na kierunkowy. Zmiana kolumny `type` z checka na FK nie
dotyka tego indeksu, ale obie migracje ruszają tę samą tabelę — kolejność ma znaczenie.
