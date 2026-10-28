# 🎡 Nation Roulette

Spin a series of wheels to found a brand-new country on a real world map.

## How to play

1. Open `index.html` in any modern browser (double-click it — no server or internet needed).
2. Press **SPIN!** (or the Space bar) to spin each wheel in order:
   1. Continent
   2. Region (where on the continent)
   3. Landlocked or coastal
   4. Border style — natural & winding, ruler-straight, or mixed
   5. Nation size — microstate up to colossal
   6. Terrain
   7. Population density
   8. Ideology
   9. Government system
   10. Political doctrine
   11. Economic system
   12. Development (HDI)
   13. Main resource
   14. State religion
   15. Military power
   16. Founding era
   17. Stability
3. After the size wheel, your territory is carved out of the map and the view zooms to it.
4. After the last wheel your nation is revealed with its name, flag and stats.

Use **⚡ Auto-spin the rest** to run the remaining wheels quickly, and tick **Fast spins** for short animations.

## The map

- The world map is Natural Earth 1:50m data. Scroll or pinch to zoom, and drag to pan.
- Each nation's flag is painted across its land like a flag map. The 🏳️ button on the map switches to plain colors.
- Click **any** nation for stats. That covers your generated nations and the real countries, which show the land they lost to your nations.
- Generated borders are random and never copy a real border. Coasts follow the real coastline.
  - **Natural & winding** borders wiggle like rivers and ridges.
  - **Ruler-straight** borders are straight survey lines, some running along parallels or meridians, like many African and North American borders.
  - **Mixed** borders combine winding edges with one or two straight cuts.
- Landlocked nations always keep a strip of foreign land between them and the sea.
- New nations never overlap nations you founded earlier, so the world fills up as you play.

## Your nation's stats

- Formal name (it depends on the government, e.g. *People's Republic of …* or *Grand Duchy of …*), demonym, language and motto
- **Flag** built from your spins:
  - ideology sets the main color
  - terrain sets the second color
  - the main resource sets the accent color
  - a wave stripe means the nation is coastal
  - the layout comes from the government type
  - the emblem comes from the religion (or the ideology)
  - monarchies get a crown, ancient and medieval nations get a gold trim, nuclear powers get an atom

  The stats panel explains each part under **Flag symbolism**.
- Area, coastline, terrain, climate (from latitude), highest point, longest river, borders and which real countries lost land
- Population, density, urbanization, life expectancy, literacy, internet use, happiness, major cities (shown on the map)
- HDI, GDP, GDP per capita, growth, inflation, unemployment, Gini, debt, resources, currency
- Leader, ruling party, freedom index, clean-government index, founding year, national day
- Military personnel, defence budget, nuclear warheads
- National animal, time zone, calling code, internet TLD and the side of the road people drive on

Your nations are saved in your browser (localStorage). **My Nations** lists them all, and **Reset World** clears them.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The game page |
| `css/style.css` | Styles |
| `js/generator.js` | Rasterises the world, picks a location, grows the territory, builds the borders |
| `js/wheels.js` | Wheel definitions, the spinning wheel, sound effects |
| `js/lore.js` | Names, flags and statistics |
| `js/main.js` | Map rendering, game flow, stats panels, saving |
| `js/world-data.js` | Natural Earth 1:50m countries (via `world-atlas`) |
| `js/vendor/` | d3 v7.9.0 and topojson-client v3.1.0, plus their licenses |
