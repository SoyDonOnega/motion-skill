# Explainer doctrine

Read this before writing the shot script. It decides what each scene shows and how it moves; the engine only executes it.

## The spine

- One idea the viewer understands by the end. Write it as one sentence before anything else.
- Start where the viewer already is: a situation, a person or a question they would ask. The hook asks; the peak answers.
- One concrete example worked through, start to finish: one real input (a number, a sentence, a record) travels through every step to the result. Not a tour of facts.
- The hook and the peak rhyme: the peak scene uses the same shapes and words the hook showed, so the hook's question closes by name.
- The second-to-last scene is the peak (the proof, the worked result), not a wrap-up. The close is one sentence.

## Devices that explain

- **The object is the explanation.** Build a thing whose working is the idea (a pipeline, a ledger, a scale, a machine) and run it.
- **One diagram that grows.** Start from the simplest true picture and add one part per beat, each appearing when it is named. Never drop a finished diagram on screen at once.
- **Continuous transformation.** Each step grows out of the last (a box becomes a row, a number becomes a bar), so the viewer never loses the thread.
- **Before and after.** Same frame, one change, the difference highlighted by inversion (ink background, paper text).
- Labels sit on the part they name and appear with it. No legends.

## Tells (never)

A slide of bullets; icons in circles; three cards in a row; the whole diagram at once; on-screen text that repeats the narration word for word; anything that announces the duration or says "finally".

## Pacing

- Something lands by 0.5 s. A 1.2 s fade-in does not count.
- One element every 3 to 4.5 s inside a scene, highlighted one at a time.
- The last beat of a scene lands at 70 to 85% of its duration: earlier leaves a dead tail, later collides with the exit seam.
- No stretch longer than 4 s without a beat. Fill a gap with content (a callback pulse on an element already on screen, a label), never with ambient motion.
- Without narration: up to about 10 words per line, held 0.5 s + 0.3 s per word.
- With narration: about 2.5 words per second of scene; the voice is the clock. Each part appears when the voice names it. Each clip fills 85 to 94% of its scene; on overrun, lengthen the scene, never speed the voice.

## Seams

How a scene exits decides how the next one enters: same axis, same direction, matched speed, cut mid-motion on both sides. The engine does this from each scene's `data-seam` (the vector it enters with, also used by the previous scene's exit).

| `data-seam` | Meaning | Use |
|---|---|---|
| `left` (default) | the next beat | most seams |
| `up` | elevation: a conclusion rises above what came before | the peak or the close |
| `zoom` | deeper into the same thought | going inside a part shown in the previous scene |

- Pick `left` unless the cut means something else. A reserved vector used everywhere means nothing.
- Never alternate directions on consecutive seams.
- Inside a scene, elements enter with opacity + 24 to 30 px offset on one axis; text rises masked.

## Getting it right

- Every claim, value and step traces to a source. A number the source did not give is left out or marked illustrative.
- Check the logic of each step before animating it: a beautiful wrong diagram is worse than none.
- One data block in the script drives every figure, so the numbers agree with each other across scenes.
