import { Composition } from "remotion";
import type { HookVariant } from "./scenes/Hook";
import { type Music, Trailer } from "./Trailer";
import { Vertical } from "./Vertical";
import { FPS, duration } from "./timing";

const HOOKS: HookVariant[] = ["speed", "evolve", "ai"];
const MUSIC: Music[] = ["phonk", "darksynth"];

export const Root: React.FC = () => (
  <>
    {(["full", "teaser"] as const).flatMap((cut) =>
      HOOKS.flatMap((hook) =>
        MUSIC.map((music) => (
          <Composition
            key={`${cut}-${hook}-${music}`}
            id={`${cut}-${hook}-${music}`}
            component={Trailer}
            defaultProps={{ cut, hook, music }}
            durationInFrames={duration(cut)}
            fps={FPS}
            width={1920}
            height={1080}
          />
        )),
      ),
    )}
    {HOOKS.flatMap((hook) =>
      MUSIC.map((music) => (
        <Composition
          key={`vertical-${hook}-${music}`}
          id={`vertical-${hook}-${music}`}
          component={Vertical}
          defaultProps={{ hook, music }}
          durationInFrames={duration("teaser")}
          fps={FPS}
          width={1080}
          height={1920}
        />
      )),
    )}
  </>
);
