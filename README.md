# Der Smaragdsplitter

Ein komplettes 3D-Action-Adventure im Browser — Zelda-inspiriert, aber vollständig eigenständig:
eigene Welt, eigene Story, eigene Grafik. Keine Engine, keine 3D-Bibliothek, kein Build-Schritt.
Reines WebGL + JavaScript, alles handgeschrieben.

**▶ [Jetzt spielen](https://madd1in.github.io/emerald-shard/)** — Desktop und Handy.

## Die Geschichte

Ein Dieb hat den Smaragdsplitter aus dem Schrein von Ardun geraubt und sich in die Ruine der
Ahnen im Norden verkrochen. Ohne den Splitter welkt das Land. Hol ihn zurück.

## Steuerung

**Tastatur & Maus**

| Taste | Aktion |
|---|---|
| `W A S D` | Bewegen (kamerarelativ) |
| Maus | Kamera — Klick fängt den Mauszeiger |
| `Leertaste` / Linksklick | Schwerthieb |
| `Shift` | Ausweichrolle (kurz unverwundbar) |
| `E` | Reden · Truhe öffnen · Ruine betreten · Tür aufschließen |
| `K` / Rechtsklick | Schild halten — blockt Frontalangriffe |
| `Q` · `F` · `1` | Bombe · Pfeil · Trank |
| `M` · `Esc` | Musik · Pause |

**Touch (Handy/Tablet)** — linke Bildhälfte wischen bewegt (virtueller Stick), rechte Hälfte
dreht die Kamera, Buttons rechts unten für Schwert, Rolle, Aktion, Schild, Bombe, Pfeil und Trank.

## Inhalt

- **Offene Overworld** — Dorf Ardun mit NPCs und Dialogen, Wald, See mit Insel zum Durchwaten,
  Bergpass, Ozeanrand, Feenquelle zum Heilen
- **Tag/Nacht-Zyklus** — wandernde Sonne, Dämmerungsfärbung, Mond und Sternenhimmel;
  nachts sind Gegner aufmerksamer und schneller, Fackeln leuchten
- **Kampfsystem** — Schwertkombo mit Trefferkegel, Rückstoß, i-Frames, Ausweichrolle, Schildblock
- **Fünf Gegnertypen** — Chuchu (hüpft), Moblin (telegrafierter Keulenschlag), Keese (fliegt),
  Octorok (spuckt Steine aus der Distanz), Steingolem (Boss)
- **Bossfight** — Ansturm → Bodenschlag mit Schockwelle → Betäubungsfenster; nur dann verwundbar
- **Dungeon** — vier Räume, verschlossene Tür mit Schlüssel, Töpfe, Fackeln, Bosstor
- **Items** — Schwert, Schild, Bogen, Bomben (sprengen rissiges Gestein frei), Tränke,
  Herzcontainer, Rubine
- **Kramladen** — Rubine gegen Pfeile, Bomben, Tränke und Heilung
- **Zielkompass** — zeigt Richtung und Entfernung zum nächsten Questziel
- **Automatisches Speichern** — Fortschritt landet im Browser (localStorage), „Weiterspielen“ im Titelmenü

## Technik

Kein Three.js, kein npm, kein Build — `index.html` öffnen genügt.

- **Renderer** — eigener WebGL-Renderer mit Cel-Shading (Lichtbänder), Entfernungsnebel,
  Toon-Konturen über umgestülpte Rückflächen, Billboard-Sprites für Flammen und Effekte
- **Texturen** — 4×4-Kachelatlas (512×512), zur Laufzeit per Canvas-2D gezeichnet: Gras,
  Blumenwiese, Erde, Sand, Fels, Ziegel, Planken, Laub, Wasser, Dungeonboden, Schindeln u. a.
  Große Flächen werden beim Aufbau in Kachelstücke unterteilt, damit nichts verzerrt
- **HUD-Sprites** — Icon-Sheet (Herzen, Rubin, Schlüssel, Bombe, Pfeil, Trank, Schwert, Schild),
  ebenfalls prozedural erzeugt und als Data-URL eingebunden
- **Audio** — MP3-Soundtrack mit weichem Crossfade und ortsabhängigem Wechsel (Dorf, Overworld,
  Dungeon, Boss); alle Effektgeräusche werden per Web Audio zur Laufzeit synthetisiert.
  Fehlt eine MP3, springt ein eingebauter mehrspuriger Chiptune-Sequencer ein
- **Welt** — Höhenfeld-Terrain mit Steigungs- und Wassertiefenprüfung, prozedural gesetzte
  Vegetation, gitterbasiert erzeugter Dungeon

### Dateien

| Datei | Inhalt |
|---|---|
| `js/engine.js` | Mathe, WebGL-Renderer, Texturatlas, Mesh-Builder, Sprite-Sheet, Audio, Musik |
| `js/world.js` | Terrain, Dorf, Vegetation, Himmel, Dungeon, Kollision |
| `js/entities.js` | Charaktermodelle mit Animation, Gegner-KI |
| `js/game.js` | Spielschleife, Kampf, Items, Kamera, Tag/Nacht, Touch, HUD, Speichern |

## Lokal starten

```bash
python -m http.server 8099
```

Dann `http://localhost:8099` öffnen.

---

Eigenständiges Werk, inspiriert vom Genre der Action-Adventures. Steht in keiner Verbindung
zu Nintendo und enthält keinerlei fremde Spielinhalte. Die Musikstücke unter `assets/bgm/`
stammen aus der eigenen Sammlung des Projektinhabers.
