import { Composition } from "remotion";
import "./fonts";
import { Reel, TOTAL } from "./Reel";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="LitmaTypesReel"
      component={Reel}
      durationInFrames={TOTAL}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
