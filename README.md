# Der Smaragdsplitter

Ein komplettes 3D-Action-Adventure im Browser — Zelda-inspiriert, aber vollständig eigenständig:
eigene Welt, eigene Story, eigene Grafik, eigener Sound. Keine Engine, keine Bibliotheken,
keine Assets von Dritten. Reines WebGL + JavaScript, alles handgeschrieben.

**▶ [Jetzt spielen](https://madd1in.github.io/emerald-shard/)**

## Die Geschichte

Ein Dieb hat den Smaragdsplitter aus dem Schrein von Ardun geraubt und sich in die Ruine der
Ahnen im Norden verkrochen. Ohne den Splitter welkt das Land. Hol ihn zurück.

## Steuerung

| Taste | Aktion |
|---|---|
| `W A S D` | Bewegen (kamerarelativ) |
| Maus | Kamera — Klick fängt den Mauszeiger |
| `Leertaste` / Linksklick | Schwerthieb |
| `Shift` | Ausweichrolle (kurz unverwundbar) |
| `E` | Reden / Truhe öffnen / Ruine betreten / Tür aufschließen |
| `K` | Schild halten — blockt Frontalangriffe |
| `Q` | Bombe werfen |
| `F` | Pfeil schießen |
| `M` | Musik an/aus · `Esc` Pause |

## Inhalt

- **Offene Overworld** — Dorf Ardun mit NPCs und Dialogen, Wald, See mit Insel, Bergpass, Ozeanrand
- **Kampfsystem** — Schwertkombo mit Trefferkegel, Rückstoß, i-Frames, Ausweichrolle, Schildblock
- **Vier Gegnertypen** — Chuchu (hüpft), Moblin (telegrafierter Keulenschlag), Keese (fliegt), Steingolem (Boss)
- **Bossfight** — Ansturm → Bodenschlag mit Schockwelle → Betäubungsfenster; nur dann verwundbar
- **Dungeon** — vier Räume, verschlossene Tür mit Schlüssel, Töpfe, Fackeln, Bosstor
- **Items** — Schwert, Schild, Bogen mit Pfeilen, Bomben (sprengen rissiges Gestein frei), Herzcontainer, Rubine
- **Sammeln** — Gras schneiden und Töpfe zerschlagen für Rubine, Herzen und Pfeile
- **HUD** — Herzleiste, Inventar, Live-Minikarte, Bossleiste, Dialogfenster

## Technik

Kein Three.js, kein Build-Schritt — einfach `index.html` öffnen.

- `js/engine.js` — Matrixmathematik, WebGL-Renderer mit Cel-Shading und Nebel, prozeduraler Mesh-Builder, Web-Audio-Synthesizer (alle Klänge und Musik zur Laufzeit erzeugt)
- `js/world.js` — Höhenfeld-Terrain, Vegetation, Dorf, prozedural erzeugter Dungeon, Kollision inkl. Steigungs- und Wassertiefenprüfung
- `js/entities.js` — Charaktermodelle aus Primitiven mit Skelettanimation, Gegner-KI
- `js/game.js` — Spielschleife, Kampf, Items, Kamera mit Wandkollision, HUD, Minikarte

## Lokal starten

```bash
python -m http.server 8099
```

Dann `http://localhost:8099` öffnen. (Direktes Öffnen der Datei funktioniert auch.)

---

Eigenständiges Werk, inspiriert vom Genre der Action-Adventures. Steht in keiner Verbindung
zu Nintendo und enthält keinerlei fremde Inhalte.
