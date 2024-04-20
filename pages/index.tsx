import Canvas from "@/components/canvas";
import { FontMangerProvider } from "@/components/font-manager";

export default function Home() {
  return (
    <main>
      <FontMangerProvider>
        <Canvas/>
      </FontMangerProvider>
    </main>
  );
}
