"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinQuizByRoomCodeAction } from "@/app/actions/participant-quiz";

export default function RoomCodeJoinBar() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) return;

    setErrorMsg(null);
    startTransition(async () => {
      const res = await joinQuizByRoomCodeAction(roomCode.trim());
      if (res.success && res.data) {
        router.push(`/participant/quiz/${res.data.quizId}`);
      } else {
        setErrorMsg(res.error || "Room code not found or inactive.");
      }
    });
  };

  return (
    <div className="bg-[#FFE600] border-4 border-black p-5 shadow-[6px_6px_0px_#000] mb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-block bg-black text-[#FFE600] px-2.5 py-0.5 font-mono text-xs font-black uppercase mb-1 shadow-[2px_2px_0px_#000]">
            ⚡ Instant Room Entrance
          </div>
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight">
            Have a Competition Room Code?
          </h2>
          <p className="text-xs md:text-sm font-medium text-neutral-800">
            Enter the proctor&apos;s Room Code (e.g. <span className="font-mono font-bold">STG2-BIM</span>) to enter the stage lobby immediately.
          </p>
        </div>

        <form onSubmit={handleJoin} className="flex flex-col sm:flex-row items-stretch gap-2 shrink-0">
          <input
            type="text"
            required
            placeholder="ENTER ROOM CODE..."
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            className="bg-white border-3 border-black px-4 py-2 font-mono font-black text-sm uppercase placeholder:normal-case placeholder:font-sans focus:outline-none focus:bg-[#00F0FF]/20 shadow-[3px_3px_0px_#000]"
          />
          <button
            type="submit"
            disabled={isPending || !roomCode.trim()}
            className="bg-black text-[#FFE600] font-black uppercase tracking-wider px-6 py-2 border-3 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-900 active:translate-x-0.5 active:translate-y-0.5 transition-transform disabled:opacity-50 cursor-pointer text-xs"
          >
            {isPending ? "Connecting..." : "Enter Room →"}
          </button>
        </form>
      </div>

      {errorMsg && (
        <div className="mt-3 p-2.5 bg-[#FF5C5C] border-2 border-black font-mono text-xs font-bold text-black shadow-[2px_2px_0px_#000]">
          ⚠️ {errorMsg}
        </div>
      )}
    </div>
  );
}
