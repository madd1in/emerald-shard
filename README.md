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

Schwert **gedrückt halten** lädt den Wirbelangriff auf — losgelassen trifft er rundum.

**Zielhilfen:** Bogen und Bumerang suchen sich automatisch den nächsten Gegner im Blickfeld —
der Held dreht sich dabei mit. Die **Auto-Kamera** schwenkt von selbst hinter dich, sobald du
gut eine Sekunde nicht selbst gedreht hast; manuelles Drehen hat immer Vorrang.
Abschaltbar über den ⟳-Knopf im HUD oder im Pausenmenü.

**Schiebeblöcke** lassen sich auch **ziehen**: Aktionstaste (`E` bzw. AKTION) halten und
rückwärts gehen. Fährt sich ein Block trotzdem in einer Ecke fest, stellt das Spiel ihn
automatisch an den Anfang zurück — und beim Betreten der Ruine steht das Rätsel ohnehin neu.

**Touch (Handy/Tablet)** — linke Bildhälfte wischen bewegt (virtueller Stick), rechte Hälfte
dreht die Kamera. Buttons unten rechts in zwei Reihen: Schwert, Rolle, Aktion sowie Schild,
Bombe, Pfeil, Bumerang und Trank. Startet automatisch im Vollbild und versucht, ins Querformat
zu drehen; die Buttons skalieren mit der Bildschirmgröße.

## Schwierigkeit

Wählbar im Titelbild und jederzeit im Pausenmenü — **Leicht** ist voreingestellt:

| | Startherzen | Schaden an dir | Gegner-Zähigkeit | Unverwundbar nach Treffer |
|---|---|---|---|---|
| Leicht | 4 | halb | −30 % | 1,7 s |
| Normal | 3 | normal | normal | 1,25 s |
| Schwer | 3 | +40 % | +30 % | 0,95 s |

Auf Leicht überlebt man acht Moblin-Treffer statt drei. Dazu gibt es überall Rettungsanker:
Herzen fallen häufiger, bei wenig Energie besonders häufig; die **Fee im Glas** (Laden, 45 Rubine)
weckt dich einmal wieder auf; wer in der Ruine stirbt, beginnt am Ruineneingang statt im Dorf;
und **Reisesteine** zwischen Dorf und Bergpass sparen den langen Rückweg.

## Inhalt

- **Offene Overworld** — Dorf Ardun mit NPCs und Dialogen, Wald, See mit Insel zum Durchwaten,
  Bergpass, Ozeanrand, Feenquelle zum Heilen
- **Tag/Nacht-Zyklus** — wandernde Sonne, Dämmerungsfärbung, Mond und Sternenhimmel;
  nachts sind Gegner aufmerksamer und schneller, Fackeln leuchten, Glühwürmchen tanzen
- **Wetter** — aufziehender Regen mit Donner, Blitzen, gedämpftem Licht und kürzerer Sicht
- **Kampfsystem** — Trefferkegel, Rückstoß, i-Frames, Ausweichrolle, Schildblock und
  **aufladbarer Wirbelangriff**, der rundum trifft
- **Sieben Gegnertypen** — Chuchu (hüpft), Riesen-Chuchu (teilt sich beim Tod), Moblin
  (telegrafierter Keulenschlag), Keese (fliegt), Octorok (spuckt Steine), Stalfos (blockt
  Angriffe von vorn — umgehen oder mit dem Bumerang betäuben), Steingolem (Boss)
- **Bossfight** — Ansturm → Bodenschlag mit Schockwelle → Betäubungsfenster; nur dann verwundbar
- **Dungeon** — Räume mit verschlossener Tür, **Schieberätsel** mit Druckplatten und Gitter,
  Töpfe, Fackeln, Bosstor
- **Kristallhöhle** — zweiter Schauplatz im Wald: leuchtende Kristalle, Stalaktiten und der
  **Kristall-König** als Mini-Boss, der beim Tod zerfällt; dahinter warten 50 Rubine und ein Herzteil
- **Kramladen** — Rubine gegen Pfeile, Bomben, Tränke, Heilung, die **Fee im Glas**
  und das **Schärfen der Klinge** (doppelter Schwertschaden)
- **Items** — Schwert, Schild, Bogen, Bomben (sprengen rissiges Gestein frei), **Bumerang**
  (betäubt Gegner und zieht Fundstücke heran), Tränke, Herzcontainer, Rubine
- **Herzteile** — vier Stück ergeben ein zusätzliches Herz; versteckt in der Welt
- **Hühner** — friedlich, aber wer zu oft zuschlägt, wird von einem Schwarm heimgesucht
- **Zielkompass** — zeigt Richtung und Entfernung zum nächsten Questziel
- **Lebensbalken** über angeschlagenen Gegnern, damit man sieht, was noch steht
- **Automatisches Speichern** — Fortschritt landet im Browser (localStorage), „Weiterspielen“ im Titelmenü

## Technik

Kein Three.js, kein npm, kein Build — `index.html` öffnen genügt.

- **Renderer** — eigener WebGL-Renderer mit Cel-Shading (Lichtbänder), Entfernungsnebel,
  Toon-Konturen über umgestülpte Rückflächen, Billboard-Sprites für Flammen und Effekte
- **Texturen** — 5×5-Kachelatlas (640×640), zur Laufzeit per Canvas-2D gezeichnet: Gras,
  Blumenwiese, Erde, Sand, Fels, Ziegel, Planken, Laub, Wasser, Dungeonboden, Schindeln,
  weicher Lichtschein und Grashalme mit Alphakante. Große Flächen werden beim Aufbau in
  Kachelstücke unterteilt, damit nichts verzerrt
- **Bewuchs & Wind** — zehntausende Grashalme sind fest ins Terrain-Mesh gebacken; ein
  Vertex-Attribut steuert, was sich im Wind wiegt (Halme stark, Laub sanft, Stämme gar nicht)
- **Wasser** — eigenes Netz nur dort, wo Wasser steht, mit eingebackenem Schaumsaum am Ufer
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
