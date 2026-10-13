<h1 align="center">Melody Dream Journey · 乐梦之路</h1>

<p align="center"><strong>Give me a song. I'll give you a dream to walk through.</strong></p>
<p align="center">An editable music visualizer, told through a little traveler's eyes.</p>
<p align="center"><strong>English</strong> · <a href="README_CN.md">简体中文</a></p>
<p align="center"><a href="#a-few-places-to-get-lost">Scenes</a> · <a href="#quick-start">Quick start</a> · <a href="#make-it-your-own">Make it yours</a> · <a href="#the-road-ahead">Road ahead</a> · <a href="LICENSE">MIT</a></p>

![A golden flowering tree beside a red bridge, beneath the moon](docs/images/showcase/golden-tree-2.png)

Some songs leave a place behind: a street still warm from the sun, a light in the rain, a tree you wish you could stand beneath a little longer.

**Melody Dream Journey** gives those places a small world to live in. A little traveler follows a continuous road through miniature streets and moonlit water. Watch from above, step into their eyes, or let the camera find its way. Bring your own music, shape the scenery, and keep the moments that feel like yours.

This release is an **editable browser Demo**. Built-in journeys, local audio, scene editing, immersive viewing and saved examples work without an account, API key or model. Song interpretation and automatic cinematic direction are optional experiments. The application interface is currently in Chinese; the guide below includes its button labels.

## What you can do

| Experience | In this Demo |
| --- | --- |
| Walk through a song | Play local MP3/WAV, import LRC lyrics, scrub the timeline and arrange chapters along one continuous route. |
| See one world from different angles | Overhead and first-person views share the same world and timeline; an automatic camera mode is also available. |
| Give a scene your own mood | Edit light, weather, clothing, travel speed, layout seed, chapters, components and atmospheres. |
| Let the interface disappear | Enter immersion, collapse the corner controls or hide them completely for clean screenshots. |
| Keep a journey worth revisiting | Open a curated original, make an editable copy, save named local versions and export or restore example packages. |

## A few places to get lost

Actual screenshots from the running Demo, grouped by scene. Each row keeps the supplied views together; open an image for the full-size capture. These illustrate the current visual vocabulary and authored examples, rather than guaranteed output for any song.

### A street holding the last of the sun

Follow the little traveler through warm façades and familiar corners. Switch from the miniature overview to street level without rebuilding the world.

<table>
  <tr><td width="33%"><img src="docs/images/showcase/city-dusk-1.png" alt="Dusk street, overhead view"></td><td width="33%"><img src="docs/images/showcase/city-dusk-2.png" alt="Dusk street, first-person view"></td><td width="33%"><img src="docs/images/showcase/city-dusk-3.png" alt="Dusk street, wider camera view"></td></tr>
  <tr><td align="center">Above the street</td><td align="center">Through the traveler's eyes</td><td align="center">The wider journey</td></tr>
</table>

### When the windows become stars

Evening gives way to lamplight. Chapters and atmosphere settings let the same journey change its light and color as it unfolds.

<table>
  <tr><td width="33%"><img src="docs/images/showcase/city-night-1.png" alt="Night street, overhead view"></td><td width="33%"><img src="docs/images/showcase/city-night-2.png" alt="Night street, first-person view"></td><td width="33%"><img src="docs/images/showcase/city-night-3.png" alt="Night street, wider camera view"></td></tr>
  <tr><td align="center">A ribbon of lamplight</td><td align="center">A familiar corner</td><td align="center">The city after dark</td></tr>
</table>

### A moonlit path beside the flowers

A continuous waterside route, flowering trees, benches and a distant pavilion. Pause the timeline and change viewpoints to find your own composition.

<table>
  <tr><td width="33%"><img src="docs/images/showcase/moonlit-river-1.png" alt="Moonlit waterside path, overhead view"></td><td width="33%"><img src="docs/images/showcase/moonlit-river-2.png" alt="Flower-lined path, first-person view"></td><td width="33%"><img src="docs/images/showcase/moonlit-river-3.png" alt="Moonlit waterside route, wide view"></td></tr>
  <tr><td align="center">The turn by the water</td><td align="center">Flowers beside the path</td><td align="center">A little world beneath the moon</td></tr>
</table>

### Somewhere warm, while the rain goes on

The curated tavern sequence brings the traveler inside for a lingering look. Its overhead view opens the room to inspection; first-person viewing brings you beside the table, with the rain beyond the doorway.

<table>
  <tr><td width="33%"><img src="docs/images/showcase/rainy-tavern-1.png" alt="Rainy tavern with the roof cut away, overhead view"></td><td width="33%"><img src="docs/images/showcase/rainy-tavern-2.png" alt="Warm tavern interior with rain outside, first-person view"></td><td width="33%"><img src="docs/images/showcase/rainy-tavern-3.png" alt="Tavern interior, alternate overhead capture"></td></tr>
  <tr><td align="center">A room along the road</td><td align="center">Shelter from the rain</td><td align="center">Another look inside</td></tr>
</table>

### Stay a little longer beneath the golden tree

Beyond the tavern, a red bridge leads the eye toward a flowering osmanthus and the moon. This is the second highlight in the preserved **Rainy Tavern · Golden Osmanthus** example.

<table>
  <tr><td width="50%"><img src="docs/images/showcase/golden-tree-1.png" alt="Golden osmanthus and red bridge, overhead view"></td><td width="50%"><img src="docs/images/showcase/golden-tree-2.png" alt="Golden osmanthus beneath the moon, first-person view"></td></tr>
  <tr><td align="center">The bridge and the little traveler</td><td align="center">A moment beneath the tree</td></tr>
</table>

The curated example is a **96-second, manually arranged silent journey**: tavern at **29s**, golden tree at **74s**. It contains no recording or lyrics of *Chengdu*, and is not a demonstration of automatic song interpretation.

## Quick start

Install **Node.js 24** and **pnpm 11.25.0**, then:

```sh
git clone https://github.com/Gary-CF/Melody-Dream-Journey.git
cd Melody-Dream-Journey
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Vite, usually `http://127.0.0.1:5173`. Use a desktop browser with WebGL support. Open the served page rather than double-clicking `index.html`.

For a first visit, select **精选示例** (Featured examples), then **查看原版** (View original). Jump to either highlight, press play, or enter immersion. **返回主页** brings you back; **复制并编辑** opens an independent editable copy.

## Make it your own

1. **Choose your music.** Use **导入音乐** to load a local MP3/WAV. Add LRC lyrics, or paste text and adjust its approximate timing.
2. **Shape the journey.** Use **旅程设置** for appearance and route settings, **场景编排** for chapters, and **旅程创作台** for reusable content and creative tools.
3. **Find a viewpoint.** Choose overhead, first-person or automatic camera. Spatial pace and pauses do not change audio playback speed.
4. **Keep a version.** In **精选示例**, name and save the current journey. Each saved version includes its plan, embedded component and atmosphere libraries, source metadata and the saved moment. Export the example package for a portable backup.

Saved examples live in this browser, with up to **20 versions / 2MB per package**. Clearing browser data removes them. Audio is not embedded in exported plans or examples; reselect your recording when you need it. A future renderer may replay the same plan with visual differences. [More about examples and saving →](docs/featured-examples.md) *(Chinese)*

### Leave only the scenery

Click the immersion button on the right. The logo and editing panels disappear; camera and playback controls move into a collapsible corner panel. Browser fullscreen is requested when available.

| In immersion | Action |
| --- | --- |
| `H` | Hide or restore all controls; clicking the scene also restores them. |
| `1` / `2` / `3` | Overhead / first-person / automatic camera. |
| `Space` | Play or pause, unless a focused control is handling the key. |
| `Esc` | Exit immersion. |

For matching screenshots, **pause first**, hide the controls, then switch viewpoints. The world and the paused timeline stay in place.

## Optional: song interpretation

The basic Demo needs no model. To explore lyric interpretation and per-song creative proposals, copy `.env.example` to `.env.local`, configure an already installed Ollama model, and restart `pnpm dev`:

```dotenv
NARRATIVE_PROVIDER=ollama
NARRATIVE_BASE_URL=http://127.0.0.1:11434
NARRATIVE_MODEL=your-installed-model-tag
CREATIVE_MODEL=your-installed-creative-model-tag
```

Models are not bundled or automatically downloaded. Without a configured service, analysis falls back to acoustic pre-arrangement. Loudness and onset cues do not amount to melody recognition or lyric understanding.

Audio is decoded locally. If you configure a remote compatible service, lyrics and acoustic summaries are sent to that service; the audio file itself is not. Keep credentials in `.env.local`, never in `VITE_` variables or Git.

## The road ahead

The longer dream is for each song to have its own journey: an understanding of the whole song and its changing passages, followed by one or two cinematic moments with anticipation, revelation, time to linger and an afterglow.

- **A stronger director:** connect lyrical meaning, essential imagery and climax design into a reliable, visibly convincing result. This is still experimental.
- **A library that grows with purpose:** reuse scenes, atmospheres and components first; retain reviewed additions as reusable, versioned content.
- **More places to dream:** nature, places shaped by different eras, trains, animals, fireworks, meteors, Earthrise and journeys across dream worlds remain future work.

This Demo does not yet promise a finished film for an arbitrary song or provide user-facing video export. The screenshots show what can be authored and replayed today.

## Build and contribute

Built with **Vite · TypeScript · Three.js · browser audio**. A modular monolith keeps domain rules, application orchestration, adapters and rendering separate. Content has three layers: **scenes** define space, **atmospheres** define mood and weather, and **components** supply reusable objects. Model output is validated data, never arbitrary JavaScript.

```sh
pnpm test
pnpm check:architecture
pnpm build
pnpm preview
```

`dist/` can be served statically for viewing, editing and local audio. Optional model endpoints require the development server or a separately deployed backend. Publishing the repository alone does not deploy a live site or an AI service.

Small contributions are welcome: one visible or usable improvement, a short reproduction, and checks suited to the change. Please keep song-specific exceptions out of general logic and preserve the shared world and audio clock.

[Source baseline](SOURCE.json) · [Recorded validation](VALIDATION.json) · [Report an issue](https://github.com/Gary-CF/Melody-Dream-Journey/issues)

## License and credits

Code and project-authored documentation are available under [MIT](LICENSE). Dependencies retain their own licenses; see [third-party notices](THIRD_PARTY_NOTICES.md). Bring music and lyrics you have permission to use; no commercial recordings are bundled.

All gallery images are screenshots supplied by the project author. README organization takes inspiration from [video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft); its code, artwork and demo media are not included here.
