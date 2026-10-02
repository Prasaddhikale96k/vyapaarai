"use client";

import { OBJECTS, CHAT_OWNER_SCRIPT, CHAT_AI_SCRIPT } from "./constants";
import Obj from "./objects/Obj";
import Bill from "./objects/Bill";
import ChatChip from "./objects/ChatChip";
import HealthRing from "./objects/HealthRing";
import AiHub from "./objects/AiHub";
import MicWave from "./objects/MicWave";
import Jar from "./objects/Jar";
import Diya from "./objects/Diya";
import Coin from "./objects/Coin";
import OverdueStamp from "./objects/OverdueStamp";
import UpiChip from "./objects/UpiChip";
import RuledPaper from "./layers/RuledPaper";
import Aurora from "./layers/Aurora";
import GrowthLine from "./layers/GrowthLine";
import Constellation from "./layers/Constellation";
import Grain from "./layers/Grain";
import LightLeak from "./layers/LightLeak";
import Spotlight from "./layers/Spotlight";
import ToastFeed from "./layers/ToastFeed";

/**
 * HeroStage — the "Living Ledger" camera + layers + world objects.
 * Server-renderable poster frame: every object at its calm resting pose,
 * decorative layers aria-hidden + pointer-events-none, zero layout impact.
 */
function artFor(id: string) {
  switch (id) {
    case "bill":
      return <Bill />;
    case "chat-owner":
      return <ChatChip kind="owner" line={CHAT_OWNER_SCRIPT[0]} />;
    case "chat-ai":
      return <ChatChip kind="ai" line={CHAT_AI_SCRIPT[0]} />;
    case "health":
      return <HealthRing />;
    case "hub":
      return <AiHub />;
    case "mic":
      return <MicWave />;
    case "jar":
      return <Jar />;
    case "diya":
      return <Diya />;
    case "coin-big":
      return <Coin tone="#D4A017" />;
    case "coin-mid":
      return <Coin tone="#E8771A" />;
    case "coin-small":
      return <Coin tone="#D4A017" />;
    case "stamp":
      return <OverdueStamp />;
    case "upi":
      return <UpiChip />;
    default:
      return null;
  }
}

export default function HeroStage() {
  return (
    <div data-hf="stage" className="hf-stage" aria-hidden="true">
      <RuledPaper />
      <Aurora />
      <GrowthLine />
      <Constellation />
      {OBJECTS.map((spec) => (
        <Obj key={spec.id} spec={spec}>
          {artFor(spec.id)}
        </Obj>
      ))}
      <Grain />
      <LightLeak />
      <Spotlight />
      <ToastFeed />
    </div>
  );
}
