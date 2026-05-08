# Styra Overlay Admin från Elgato Stream Deck

Scoreboard exponerar en HTTP-endpoint på `/Overlay` som låter externa verktyg (t.ex. Stream Deck) sätta av och på overlay-element och panels utan att ett browserfönster behöver vara i fokus.

## Förutsättningar

- Scoreboard körs lokalt (standard: `http://localhost:8000`)
- Stream Deck-mjukvaran har stöd för att öppna en URL, t.ex. via:
  - Inbyggd action **System → Website** (öppnar browser – enklaste alternativet)
  - Plugin **BarRaider's Super Macro** eller **HTTP Request** (öppnar URL i bakgrunden – rekommenderat)

---

## Endpoint

```
GET http://localhost:8000/Overlay?<parameter>
```

Svarar med JSON:
```json
{ "status": "ok", "message": "..." }
```

---

## Parametrar

### Toggla ett element (av/på)

```
?toggle=<nyckel>
```

| URL | Effekt |
|-----|--------|
| `/Overlay?toggle=Clock` | Togglar klockan |
| `/Overlay?toggle=Score` | Togglar poängtavlan |
| `/Overlay?toggle=ShowJammers` | Togglar visning av jammers |
| `/Overlay?toggle=ShowLineups` | Togglar full lineup |
| `/Overlay?toggle=ShowNames` | Togglar spelarnamn |
| `/Overlay?toggle=ShowPenaltyClocks` | Togglar penalty-klockor |

---

### Sätta ett specifikt värde

```
?set=<nyckel>&value=<värde>
```

| URL | Effekt |
|-----|--------|
| `/Overlay?set=Clock&value=true` | Slår på klockan |
| `/Overlay?set=Score&value=false` | Stänger av poäng |
| `/Overlay?set=Scaling&value=150` | Sätter skalning till 150 % |
| `/Overlay?set=BackgroundColor&value=%2300ff00` | Sätter bakgrundsfärg till grön |

> **Obs:** URL-koda specialtecken, t.ex. `#` → `%23`, `&` → `%26`.

---

### Panels

#### Toggla en panel (visa om dold, dölj om aktiv)

```
?panel=<värde>
```

| URL | Effekt |
|-----|--------|
| `/Overlay?panel=PPJBox` | Togglar "Points per Jam" |
| `/Overlay?panel=RosterTeam1` | Togglar Roster (lag 1) |
| `/Overlay?panel=RosterTeam2` | Togglar Roster (lag 2) |
| `/Overlay?panel=PenaltyTeam1` | Togglar Penalty (lag 1) |
| `/Overlay?panel=PenaltyTeam2` | Togglar Penalty (lag 2) |
| `/Overlay?panel=LowerThird` | Togglar Lower Third |
| `/Overlay?panel=Upcoming` | Togglar Upcoming |
| `/Overlay?panel=FinalScore` | Togglar Final Score Reveal |

#### Sätt en panel direkt (utan toggle)

```
?set-panel=<värde>
```

#### Dölj aktiv panel

```
?clear-panel
```

---

## Exempel – Stream Deck-konfiguration

### Med "Website"-action (öppnar browser)

1. Lägg till en **System → Website**-knapp.
2. Ange URL: `http://localhost:8000/Overlay?panel=PPJBox`

### Med HTTP-plugin (bakgrundsbegäran, rekommenderat)

1. Installera t.ex. **BarRaider's Super Macro** från Stream Deck Store.
2. Välj action **HTTP GET Request**.
3. Ange URL: `http://localhost:8000/Overlay?toggle=Clock`

---

## Tillgängliga nyckelnamn

Nyckelnamnen motsvarar suffixet i `ScoreBoard.Settings.Setting(Overlay.Interactive.<nyckel>)`.

| Nyckel | Beskrivning |
|--------|-------------|
| `Clock` | Klocka |
| `Score` | Poäng |
| `ShowJammers` | Visa jammers |
| `ShowLineups` | Visa full lineup |
| `ShowNames` | Visa spelarnamn |
| `ShowPenaltyClocks` | Visa penalty-klockor |
| `Panel` | Aktiv panel (se panelvärden ovan) |
| `Scaling` | Skalning i procent (50–200) |
| `BackgroundColor` | Bakgrundsfärg (`transparent` eller `#00ff00`) |
| `ClockAfterTimeout` | Klocka efter timeout (`Lineup` eller `Timeout`) |
| `LowerThird.Line1` | Lower Third – rad 1 |
| `LowerThird.Line2` | Lower Third – rad 2 |
| `LowerThird.Style` | Lower Third – stil (`ColourDefault`, `ColourTeam1`, `ColourTeam2`) |
